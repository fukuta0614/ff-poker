/**
 * ルーム管理API
 * /api/v1/rooms
 */

import { Router, Request, Response, NextFunction } from 'express';
import { GameManagerV2 } from '../../managers/GameManager';
import { GameService } from '../../services/GameService';

export function createRoomsRouter(
  gameManager: GameManagerV2,
  _gameService: GameService
): Router {
  const router = Router();

  /**
   * POST /api/v1/rooms
   * ルーム作成
   */
  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hostName, smallBlind, bigBlind } = req.body;

      // バリデーション
      if (!hostName || typeof hostName !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'hostName is required and must be a string',
          },
        });
      }

      if (typeof smallBlind !== 'number' || smallBlind < 1) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'smallBlind must be a number greater than 0',
          },
        });
      }

      if (typeof bigBlind !== 'number' || bigBlind < smallBlind) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'bigBlind must be a number greater than or equal to smallBlind',
          },
        });
      }

      const room = gameManager.createRoom(hostName, smallBlind, bigBlind);

      res.status(201).json({
        roomId: room.id,
        hostId: room.hostId,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * GET /api/v1/rooms/:roomId
   * ルーム情報取得
   */
  router.get('/:roomId', (req: Request, res: Response, next: NextFunction) => {
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

      res.json({
        id: room.id,
        hostId: room.hostId,
        players: room.players.map((p) => ({
          id: p.id,
          name: p.name,
          chips: p.chips,
          seat: p.seat,
        })),
        state: room.state,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
        dealerIndex: room.dealerIndex,
      });
    } catch (error) {
      return next(error);
    }
  });

  /**
   * POST /api/v1/rooms/:roomId/join
   * ルーム参加
   */
  router.post('/:roomId/join', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomId } = req.params;
      const { playerName } = req.body;

      if (!playerName || typeof playerName !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'playerName is required and must be a string',
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

      const player = gameManager.addPlayer(roomId, playerName);

      res.json({
        roomId,
        playerId: player.id,
        players: room.players.map((p) => ({
          id: p.id,
          name: p.name,
          chips: p.chips,
          seat: p.seat,
        })),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already in progress')) {
          return res.status(400).json({
            error: {
              code: 'GAME_IN_PROGRESS',
              message: error.message,
            },
          });
        }
        if (error.message.includes('full')) {
          return res.status(400).json({
            error: {
              code: 'ROOM_FULL',
              message: error.message,
            },
          });
        }
      }
      return next(error);
    }
  });

  return router;
}
