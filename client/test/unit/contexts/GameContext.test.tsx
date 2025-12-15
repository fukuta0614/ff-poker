/**
 * Unit tests for GameContext
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from '../../../src/contexts/GameContext';
import { apiClient } from '../../../src/services/api';
import { socketClient } from '../../../src/services/socket';

// Mock services
vi.mock('../../../src/services/api');
vi.mock('../../../src/services/socket');

describe('GameContext', () => {
  let mockSocket: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };

    (socketClient.connect as any).mockReturnValue(mockSocket);
    (socketClient.disconnect as any).mockImplementation(() => {});
    (socketClient.joinRoom as any).mockImplementation(() => {});
    (socketClient.leaveRoom as any).mockImplementation(() => {});
    (socketClient.onRoomUpdated as any).mockReturnValue(() => {});
  });

  describe('createRoom', () => {
    it('should create room and set room info', async () => {
      const mockRoomResponse = {
        roomId: 'room-123',
        hostId: 'player-456',
      };

      const mockRoom = {
        roomId: 'room-123',
        state: 'waiting' as const,
        players: [{ id: 'player-456', name: 'Alice', chips: 1000, isFolded: false }],
        smallBlind: 10,
        bigBlind: 20,
      };

      (apiClient.createRoom as any).mockResolvedValue(mockRoomResponse);
      (apiClient.getRoom as any).mockResolvedValue(mockRoom);

      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      await act(async () => {
        await result.current.createRoom('Alice', 10, 20);
      });

      expect(result.current.roomId).toBe('room-123');
      expect(result.current.playerId).toBe('player-456');
      expect(result.current.room).toEqual(mockRoom);
      expect(socketClient.joinRoom).toHaveBeenCalledWith('room-123', 'player-456');
    });

    it('should handle error when creating room', async () => {
      (apiClient.createRoom as any).mockRejectedValue(new Error('Failed to create room'));

      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      let errorThrown = false;
      await act(async () => {
        try {
          await result.current.createRoom('Alice', 10, 20);
        } catch (error) {
          errorThrown = true;
        }
      });

      expect(errorThrown).toBe(true);
      expect(result.current.error).toBe('Failed to create room');
    });
  });

  describe('joinRoom', () => {
    it('should join room and set room info', async () => {
      const mockJoinResponse = {
        playerId: 'player-789',
      };

      const mockRoom = {
        roomId: 'room-123',
        state: 'waiting' as const,
        players: [
          { id: 'player-456', name: 'Alice', chips: 1000, isFolded: false },
          { id: 'player-789', name: 'Bob', chips: 1000, isFolded: false },
        ],
        smallBlind: 10,
        bigBlind: 20,
      };

      (apiClient.joinRoom as any).mockResolvedValue(mockJoinResponse);
      (apiClient.getRoom as any).mockResolvedValue(mockRoom);

      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      await act(async () => {
        await result.current.joinRoom('room-123', 'Bob');
      });

      expect(result.current.roomId).toBe('room-123');
      expect(result.current.playerId).toBe('player-789');
      expect(result.current.room).toEqual(mockRoom);
      expect(socketClient.joinRoom).toHaveBeenCalledWith('room-123', 'player-789');
    });
  });

  describe('startGame', () => {
    it('should start game and set game state', async () => {
      const mockRoomResponse = {
        roomId: 'room-123',
        hostId: 'player-456',
      };

      const mockRoom = {
        roomId: 'room-123',
        state: 'waiting' as const,
        players: [{ id: 'player-456', name: 'Alice', chips: 1000, isFolded: false }],
        smallBlind: 10,
        bigBlind: 20,
      };

      const mockGameState = {
        gameState: {
          players: [
            {
              id: 'player-456',
              chips: 990,
              cumulativeBet: 10,
              isFolded: false,
              hand: { cards: [] },
            },
          ],
          pot: 30,
          communityCards: [],
          currentBet: 20,
          stage: 'preflop' as const,
          currentBettorIndex: 0,
          waitingForAck: false,
        },
      };

      (apiClient.createRoom as any).mockResolvedValue(mockRoomResponse);
      (apiClient.getRoom as any).mockResolvedValue(mockRoom);
      (apiClient.startGame as any).mockResolvedValue(mockGameState);

      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      await act(async () => {
        await result.current.createRoom('Alice', 10, 20);
      });

      await act(async () => {
        await result.current.startGame();
      });

      expect(result.current.gameState).toEqual(mockGameState.gameState);
    });
  });

  describe('executeAction', () => {
    it('should execute action and update game state', async () => {
      const mockRoomResponse = {
        roomId: 'room-123',
        hostId: 'player-456',
      };

      const mockRoom = {
        roomId: 'room-123',
        state: 'in_progress' as const,
        players: [{ id: 'player-456', name: 'Alice', chips: 1000, isFolded: false }],
        smallBlind: 10,
        bigBlind: 20,
      };

      const mockActionResponse = {
        gameState: {
          players: [
            {
              id: 'player-456',
              chips: 980,
              cumulativeBet: 20,
              isFolded: false,
              hand: { cards: [] },
            },
          ],
          pot: 40,
          communityCards: [],
          currentBet: 20,
          stage: 'preflop' as const,
          currentBettorIndex: 1,
          waitingForAck: false,
        },
      };

      (apiClient.createRoom as any).mockResolvedValue(mockRoomResponse);
      (apiClient.getRoom as any).mockResolvedValue(mockRoom);
      (apiClient.executeAction as any).mockResolvedValue(mockActionResponse);

      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      await act(async () => {
        await result.current.createRoom('Alice', 10, 20);
      });

      await act(async () => {
        await result.current.executeAction({ type: 'call' });
      });

      expect(result.current.gameState).toEqual(mockActionResponse.gameState);
      expect(apiClient.executeAction).toHaveBeenCalledWith('room-123', {
        playerId: 'player-456',
        action: { type: 'call' },
      });
    });

    it('should throw error when room ID is not set', async () => {
      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      await expect(
        act(async () => {
          await result.current.executeAction({ type: 'call' });
        })
      ).rejects.toThrow('Room ID or Player ID is not set');
    });
  });

  describe('resetGame', () => {
    it('should reset game state and leave room', async () => {
      const mockRoomResponse = {
        roomId: 'room-123',
        hostId: 'player-456',
      };

      const mockRoom = {
        roomId: 'room-123',
        state: 'waiting' as const,
        players: [{ id: 'player-456', name: 'Alice', chips: 1000, isFolded: false }],
        smallBlind: 10,
        bigBlind: 20,
      };

      (apiClient.createRoom as any).mockResolvedValue(mockRoomResponse);
      (apiClient.getRoom as any).mockResolvedValue(mockRoom);

      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      await act(async () => {
        await result.current.createRoom('Alice', 10, 20);
      });

      act(() => {
        result.current.resetGame();
      });

      expect(result.current.roomId).toBeNull();
      expect(result.current.playerId).toBeNull();
      expect(result.current.room).toBeNull();
      expect(socketClient.leaveRoom).toHaveBeenCalledWith('room-123', 'player-456');
    });
  });

  describe('WebSocket connection', () => {
    it('should connect on mount and disconnect on unmount', () => {
      const { unmount } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      expect(socketClient.connect).toHaveBeenCalled();

      unmount();

      expect(socketClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('room:updated event handler', () => {
    it('should fetch room info on room:updated event', async () => {
      const mockRoomResponse = {
        roomId: 'room-123',
        hostId: 'player-456',
      };

      const mockRoom = {
        roomId: 'room-123',
        state: 'waiting' as const,
        players: [{ id: 'player-456', name: 'Alice', chips: 1000, isFolded: false }],
        smallBlind: 10,
        bigBlind: 20,
      };

      const mockUpdatedRoom = {
        ...mockRoom,
        players: [
          { id: 'player-456', name: 'Alice', chips: 1000, isFolded: false },
          { id: 'player-789', name: 'Bob', chips: 1000, isFolded: false },
        ],
      };

      (apiClient.createRoom as any).mockResolvedValue(mockRoomResponse);
      (apiClient.getRoom as any)
        .mockResolvedValueOnce(mockRoom)
        .mockResolvedValueOnce(mockUpdatedRoom);

      let roomUpdatedCallback: any;
      (socketClient.onRoomUpdated as any).mockImplementation((cb: any) => {
        roomUpdatedCallback = cb;
        return () => {};
      });

      const { result } = renderHook(() => useGame(), {
        wrapper: GameProvider,
      });

      await act(async () => {
        await result.current.createRoom('Alice', 10, 20);
      });

      await act(async () => {
        await roomUpdatedCallback({ roomId: 'room-123', updateType: 'player_joined' });
      });

      await waitFor(() => {
        expect(result.current.room?.players.length).toBe(2);
      });
    });
  });
});
