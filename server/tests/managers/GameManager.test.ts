/**
 * GameManagerV2 のユニットテスト
 */

import { GameManagerV2 } from '../../src/managers/GameManager';
import { GameState } from '@engine/types';

describe('GameManagerV2', () => {
  let gameManager: GameManagerV2;

  beforeEach(() => {
    gameManager = new GameManagerV2();
  });

  describe('createRoom', () => {
    it('should create a room with unique ID', () => {
      const room = gameManager.createRoom('Alice', 10, 20);

      expect(room.id).toMatch(/^room-/);
      expect(room.hostId).toMatch(/^player-/);
      expect(room.players).toHaveLength(1);
      expect(room.players[0].name).toBe('Alice');
      expect(room.smallBlind).toBe(10);
      expect(room.bigBlind).toBe(20);
      expect(room.state).toBe('waiting');
    });

    it('should set host as first player with seat 0', () => {
      const room = gameManager.createRoom('Bob', 5, 10);

      expect(room.players[0].id).toBe(room.hostId);
      expect(room.players[0].seat).toBe(0);
      expect(room.players[0].chips).toBe(1000);
    });

    it('should create multiple rooms with different IDs', () => {
      const room1 = gameManager.createRoom('Alice', 10, 20);
      const room2 = gameManager.createRoom('Bob', 5, 10);

      expect(room1.id).not.toBe(room2.id);
      expect(room1.hostId).not.toBe(room2.hostId);
    });
  });

  describe('getRoom', () => {
    it('should return room by ID', () => {
      const created = gameManager.createRoom('Alice', 10, 20);
      const retrieved = gameManager.getRoom(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent room', () => {
      const retrieved = gameManager.getRoom('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('addPlayer', () => {
    it('should add player to room', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      const player = gameManager.addPlayer(room.id, 'Bob');

      expect(player.name).toBe('Bob');
      expect(player.seat).toBe(1);
      expect(player.chips).toBe(1000);

      const updatedRoom = gameManager.getRoom(room.id);
      expect(updatedRoom?.players).toHaveLength(2);
    });

    it('should assign sequential seat numbers', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      const player1 = gameManager.addPlayer(room.id, 'Bob');
      const player2 = gameManager.addPlayer(room.id, 'Charlie');

      expect(player1.seat).toBe(1);
      expect(player2.seat).toBe(2);
    });

    it('should throw error for non-existent room', () => {
      expect(() => {
        gameManager.addPlayer('non-existent', 'Bob');
      }).toThrow('Room not found');
    });

    it('should throw error if game is in progress', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.setRoomState(room.id, 'in_progress');

      expect(() => {
        gameManager.addPlayer(room.id, 'Bob');
      }).toThrow('Cannot join room: game already in progress');
    });

    it('should throw error if room is full', () => {
      const room = gameManager.createRoom('Alice', 10, 20);

      // Add 8 more players (total 9, which is max)
      for (let i = 0; i < 8; i++) {
        gameManager.addPlayer(room.id, `Player${i}`);
      }

      expect(() => {
        gameManager.addPlayer(room.id, 'TooMany');
      }).toThrow('Room is full');
    });
  });

  describe('removePlayer', () => {
    it('should remove player from room', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      const player = gameManager.addPlayer(room.id, 'Bob');

      gameManager.removePlayer(room.id, player.id);

      const updatedRoom = gameManager.getRoom(room.id);
      expect(updatedRoom?.players).toHaveLength(1);
    });

    it('should delete room when last player leaves', () => {
      const room = gameManager.createRoom('Alice', 10, 20);

      gameManager.removePlayer(room.id, room.hostId);

      const retrievedRoom = gameManager.getRoom(room.id);
      expect(retrievedRoom).toBeUndefined();
    });

    it('should throw error for non-existent room', () => {
      expect(() => {
        gameManager.removePlayer('non-existent', 'player-123');
      }).toThrow('Room not found');
    });
  });

  describe('gameState management', () => {
    it('should set and get game state', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      const mockGameState: Partial<GameState> = {
        stage: 'preflop',
        currentBet: 20,
        totalPot: 30,
      } as any;

      gameManager.setGameState(room.id, mockGameState as GameState);
      const retrieved = gameManager.getGameState(room.id);

      expect(retrieved).toEqual(mockGameState);
    });

    it('should return undefined for non-existent game state', () => {
      const retrieved = gameManager.getGameState('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('advanceDealerIndex', () => {
    it('should advance dealer index', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');
      gameManager.addPlayer(room.id, 'Charlie');

      expect(room.dealerIndex).toBe(0);

      gameManager.advanceDealerIndex(room.id);
      const updatedRoom = gameManager.getRoom(room.id);
      expect(updatedRoom?.dealerIndex).toBe(1);
    });

    it('should wrap around dealer index', () => {
      const room = gameManager.createRoom('Alice', 10, 20);
      gameManager.addPlayer(room.id, 'Bob');
      gameManager.addPlayer(room.id, 'Charlie');

      gameManager.advanceDealerIndex(room.id); // 0 -> 1
      gameManager.advanceDealerIndex(room.id); // 1 -> 2
      gameManager.advanceDealerIndex(room.id); // 2 -> 0

      const updatedRoom = gameManager.getRoom(room.id);
      expect(updatedRoom?.dealerIndex).toBe(0);
    });
  });
});
