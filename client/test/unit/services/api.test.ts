/**
 * Unit tests for API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, ApiError } from '../../../src/services/api';

// Mock fetch
global.fetch = vi.fn();

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRoom', () => {
    it('should create a room successfully', async () => {
      const mockResponse = {
        roomId: 'room-123',
        hostId: 'player-456',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.createRoom({
        hostName: 'Alice',
        smallBlind: 10,
        bigBlind: 20,
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostName: 'Alice',
            smallBlind: 10,
            bigBlind: 20,
          }),
        })
      );
    });

    it('should throw ApiError on failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: 'INVALID_REQUEST', message: 'Invalid request' }),
      });

      await expect(
        apiClient.createRoom({
          hostName: '',
          smallBlind: 10,
          bigBlind: 20,
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('joinRoom', () => {
    it('should join a room successfully', async () => {
      const mockResponse = {
        playerId: 'player-789',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.joinRoom('room-123', { playerName: 'Bob' });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/room-123/join'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ playerName: 'Bob' }),
        })
      );
    });
  });

  describe('getRoom', () => {
    it('should get room info successfully', async () => {
      const mockRoom = {
        roomId: 'room-123',
        state: 'waiting',
        players: [],
        smallBlind: 10,
        bigBlind: 20,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoom,
      });

      const result = await apiClient.getRoom('room-123');

      expect(result).toEqual(mockRoom);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/room-123'),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('startGame', () => {
    it('should start game successfully', async () => {
      const mockResponse = {
        gameState: {
          players: [],
          pot: 0,
          communityCards: [],
          currentBet: 0,
          stage: 'preflop',
          currentBettorIndex: 0,
          waitingForAck: false,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.startGame('room-123');

      expect(result.gameState).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/room-123/start'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('executeAction', () => {
    it('should execute action successfully', async () => {
      const mockResponse = {
        gameState: {
          players: [],
          pot: 100,
          communityCards: [],
          currentBet: 20,
          stage: 'preflop',
          currentBettorIndex: 1,
          waitingForAck: false,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.executeAction('room-123', {
        playerId: 'player-123',
        action: { type: 'call' },
      });

      expect(result.gameState.pot).toBe(100);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/room-123/action'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            playerId: 'player-123',
            action: { type: 'call' },
          }),
        })
      );
    });
  });

  describe('getGameState', () => {
    it('should get game state successfully', async () => {
      const mockResponse = {
        gameState: {
          players: [],
          pot: 50,
          communityCards: [],
          currentBet: 10,
          stage: 'flop',
          currentBettorIndex: 0,
          waitingForAck: false,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiClient.getGameState('room-123', 'player-123');

      expect(result.gameState).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rooms/room-123/state?playerId=player-123'),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('ApiError', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError('Test error', 'TEST_CODE', { foo: 'bar' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('ApiError');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
