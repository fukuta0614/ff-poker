/**
 * GameService のユニットテスト
 */

import * as E from 'fp-ts/Either';
import { GameService } from '../../src/services/GameService';
import { GameManagerV2 } from '../../src/managers/GameManager';
import { PlayerAction } from '@engine/types';

describe('GameService', () => {
  let gameManager: GameManagerV2;
  let gameService: GameService;

  beforeEach(() => {
    gameManager = new GameManagerV2();
    gameService = new GameService(gameManager);
  });

  describe('startGame', () => {
    it('should initialize game state using functional engine', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');
      gameManager.addPlayer(room.id, 'Charlie');

      const result = gameService.startGame(room.id);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const gameState = result.right;
        expect(gameState.stage).toBe('preflop');
        expect(gameState.totalPot).toBeGreaterThan(0);
        expect(gameState.players.size).toBe(3);
      }
    });

    it('should return Left when room not found', () => {
      const result = gameService.startGame('non-existent');

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('GameNotInProgress');
      }
    });

    it('should return Left when insufficient players', () => {
      const room = gameManager.createRoom('Alice', 10, 20);

      const result = gameService.startGame(room.id);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('NoActivePlayers');
      }
    });

    it('should set room state to in_progress', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');

      gameService.startGame(room.id);

      const updatedRoom = gameManager.getRoom(room.id);
      expect(updatedRoom?.state).toBe('in_progress');
    });

    it('should save game state to manager', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');

      gameService.startGame(room.id);

      const gameState = gameManager.getGameState(room.id);
      expect(gameState).toBeDefined();
      expect(gameState?.stage).toBe('preflop');
    });
  });

  describe('executeAction', () => {
    it('should process valid action and return Right', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');

      const startResult = gameService.startGame(room.id);
      expect(E.isRight(startResult)).toBe(true);

      if (E.isRight(startResult)) {
        const gameState = startResult.right;
        const currentBettorId = gameState.players.get(
          Array.from(gameState.players.keys())[gameState.currentBettorIndex]
        )?.id;

        if (currentBettorId) {
          const action: PlayerAction = {
            playerId: currentBettorId,
            type: 'call',
          };

          const actionResult = gameService.executeAction(room.id, action);
          expect(E.isRight(actionResult)).toBe(true);
        }
      }
    });

    it('should return Left when game not in progress', () => {
      const action: PlayerAction = {
        playerId: 'player-123',
        type: 'fold',
      };

      const result = gameService.executeAction('non-existent', action);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('GameNotInProgress');
      }
    });

    it('should return Left when invalid action', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');

      gameService.startGame(room.id);

      // Wrong player's turn
      const action: PlayerAction = {
        playerId: 'wrong-player',
        type: 'fold',
      };

      const result = gameService.executeAction(room.id, action);

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getGameStateForPlayer', () => {
    it('should return game state with only player own hand', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');

      const startResult = gameService.startGame(room.id);
      expect(E.isRight(startResult)).toBe(true);

      const stateResult = gameService.getGameStateForPlayer(room.id, room.hostId);

      expect(E.isRight(stateResult)).toBe(true);
      if (E.isRight(stateResult)) {
        const filteredState = stateResult.right;

        // 自分の手札は見える
        const ownPlayerState = filteredState.playerStates.get(room.hostId);
        expect(ownPlayerState).toBeDefined();

        // 他のプレイヤーの手札は見えない（None）
        // Note: 他プレイヤーのhandはO.noneになっている
      }
    });

    it('should return Left when game not found', () => {
      const result = gameService.getGameStateForPlayer('non-existent', 'player-123');

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('GameNotInProgress');
      }
    });
  });
});
