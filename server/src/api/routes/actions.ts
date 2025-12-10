/**
 * ゲームアクションAPI
 * /api/v1/rooms/:roomId/actions, /api/v1/rooms/:roomId/start, /api/v1/rooms/:roomId/state
 */

import { Router, Request, Response, NextFunction } from 'express';
import * as E from 'fp-ts/Either';
import { GameManagerV2 } from '../../managers/GameManager';
import { GameService } from '../../services/GameService';
import { PlayerAction, GameError, GameState } from '@engine/types';

/**
 * GameErrorをHTTPレスポンスに変換
 */
function formatGameError(error: GameError): { code: string; message: string } {
  switch (error.type) {
    case 'InvalidTurn':
      return {
        code: 'INVALID_TURN',
        message: `Invalid turn: expected ${error.expectedPlayerId}, got ${error.playerId}`,
      };
    case 'PlayerNotFound':
      return {
        code: 'PLAYER_NOT_FOUND',
        message: `Player not found: ${error.playerId}`,
      };
    case 'PlayerAlreadyFolded':
      return {
        code: 'PLAYER_ALREADY_FOLDED',
        message: `Player already folded: ${error.playerId}`,
      };
    case 'InvalidAction':
      return {
        code: 'INVALID_ACTION',
        message: `Invalid action ${error.action}: ${error.reason}`,
      };
    case 'InsufficientChips':
      return {
        code: 'INSUFFICIENT_CHIPS',
        message: `Insufficient chips: required ${error.required}, available ${error.available}`,
      };
    case 'InvalidBetAmount':
      return {
        code: 'INVALID_BET_AMOUNT',
        message: `Invalid bet amount: ${error.amount} (minimum: ${error.minimum})`,
      };
    case 'GameNotInProgress':
      return {
        code: 'GAME_NOT_IN_PROGRESS',
        message: `Game is not in progress (current stage: ${error.currentStage})`,
      };
    case 'NoActivePlayers':
      return {
        code: 'NO_ACTIVE_PLAYERS',
        message: 'No active players',
      };
    case 'WaitingForAcknowledgment':
      return {
        code: 'WAITING_FOR_ACKNOWLEDGMENT',
        message: 'Game is waiting for acknowledgment from all players',
      };
    case 'AcknowledgmentNotExpected':
      return {
        code: 'ACKNOWLEDGMENT_NOT_EXPECTED',
        message: `Acknowledgment not expected from player: ${error.playerId}`,
      };
    case 'AcknowledgmentAlreadyReceived':
      return {
        code: 'ACKNOWLEDGMENT_ALREADY_RECEIVED',
        message: `Acknowledgment already received from player: ${error.playerId}`,
      };
    case 'AcknowledgmentTimeout':
      return {
        code: 'ACKNOWLEDGMENT_TIMEOUT',
        message: 'Acknowledgment timeout',
      };
    default:
      return {
        code: 'UNKNOWN_ERROR',
        message: 'Unknown game error',
      };
  }
}

/**
 * GameStateをJSON形式に変換
 */
function serializeGameState(state: GameState): any {
  return {
    stage: state.stage,
    dealerIndex: state.dealerIndex,
    currentBettorIndex: state.currentBettorIndex,
    currentBet: state.currentBet,
    minRaiseAmount: state.minRaiseAmount,
    totalPot: state.totalPot,
    communityCards: Array.from(state.communityCards),
    waitingForAck: state.waitingForAck,
    ackState: state.ackState && 'value' in state.ackState ? {
      expectedAcks: Array.from(state.ackState.value.expectedAcks),
      receivedAcks: Array.from(state.ackState.value.receivedAcks),
      startedAt: state.ackState.value.startedAt,
      description: state.ackState.value.description,
    } : undefined,
    players: Array.from(state.players.values()).map((player) => {
      const playerState = state.playerStates.get(player.id);
      return {
        id: player.id,
        name: player.name,
        chips: player.chips,
        seat: player.seat,
        bet: playerState?.bet ?? 0,
        cumulativeBet: playerState?.cumulativeBet ?? 0,
        isFolded: playerState?.isFolded ?? false,
        hasActed: playerState?.hasActed ?? false,
        hand: playerState?.hand && 'value' in playerState.hand ? playerState.hand.value : undefined,
      };
    }),
    pots: state.pots.map((pot) => ({
      amount: pot.amount,
      eligiblePlayers: Array.from(pot.eligiblePlayers),
    })),
  };
}

export function createActionsRouter(
  gameManager: GameManagerV2,
  gameService: GameService
): Router {
  const router = Router();

  /**
   * POST /api/v1/rooms/:roomId/start
   * ゲーム開始
   */
  router.post('/:roomId/start', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomId } = req.params;

      const room = gameManager.getRoom(roomId);
      if (!room) {
        return res.status(404).json({
          error: {
            code: 'ROOM_NOT_FOUND',
            message: `Room not found: ${roomId}`,
          },
        });
      }

      const result = gameService.startGame(roomId);

      if (E.isLeft(result)) {
        const { code, message } = formatGameError(result.left);
        return res.status(400).json({
          error: { code, message },
        });
      }

      res.json({
        gameState: serializeGameState(result.right),
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/v1/rooms/:roomId/actions
   * プレイヤーアクション実行
   */
  router.post('/:roomId/actions', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomId } = req.params;
      const { playerId, action } = req.body;

      // バリデーション
      if (!playerId || typeof playerId !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'playerId is required and must be a string',
          },
        });
      }

      if (!action || typeof action !== 'object') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'action is required and must be an object',
          },
        });
      }

      if (!action.type || !['fold', 'check', 'call', 'raise', 'allin', 'acknowledge'].includes(action.type)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'action.type must be one of: fold, check, call, raise, allin, acknowledge',
          },
        });
      }

      const room = gameManager.getRoom(roomId);
      if (!room) {
        return res.status(404).json({
          error: {
            code: 'ROOM_NOT_FOUND',
            message: `Room not found: ${roomId}`,
          },
        });
      }

      const playerAction: PlayerAction = {
        playerId,
        type: action.type,
        amount: action.amount,
      };

      const result = gameService.executeAction(roomId, playerAction);

      if (E.isLeft(result)) {
        const { code, message } = formatGameError(result.left);
        return res.status(400).json({
          error: { code, message },
        });
      }

      res.json({
        success: true,
        gameState: serializeGameState(result.right),
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/v1/rooms/:roomId/state
   * ゲーム状態取得
   */
  router.get('/:roomId/state', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomId } = req.params;
      const { playerId } = req.query;

      if (!playerId || typeof playerId !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'playerId query parameter is required',
          },
        });
      }

      const room = gameManager.getRoom(roomId);
      if (!room) {
        return res.status(404).json({
          error: {
            code: 'ROOM_NOT_FOUND',
            message: `Room not found: ${roomId}`,
          },
        });
      }

      const result = gameService.getGameStateForPlayer(roomId, playerId);

      if (E.isLeft(result)) {
        const { code, message } = formatGameError(result.left);
        return res.status(400).json({
          error: { code, message },
        });
      }

      res.json({
        gameState: serializeGameState(result.right),
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
