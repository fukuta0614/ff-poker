/**
 * Unit tests for Socket client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { io } from 'socket.io-client';
import { socketClient } from '../../../src/services/socket';

// Mock socket.io-client
vi.mock('socket.io-client');

describe('SocketClient', () => {
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    };

    (io as any).mockReturnValue(mockSocket);
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to WebSocket server', () => {
      const socket = socketClient.connect();

      expect(io).toHaveBeenCalledWith(expect.any(String), {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });
      expect(socket).toBe(mockSocket);
      socketClient.disconnect();
    });

    it('should set up default event listeners', () => {
      socketClient.connect();

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      socketClient.disconnect();
    });

    it('should return existing socket if already connected', () => {
      const socket1 = socketClient.connect();
      const socket2 = socketClient.connect();

      expect(socket1).toBe(socket2);
      expect(io).toHaveBeenCalledTimes(1);
      socketClient.disconnect();
    });
  });

  describe('disconnect', () => {
    it('should disconnect the socket', () => {
      socketClient.connect();
      socketClient.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', () => {
      expect(() => socketClient.disconnect()).not.toThrow();
    });
  });

  describe('joinRoom', () => {
    it('should emit room:join event', () => {
      socketClient.connect();
      socketClient.joinRoom('room-123', 'player-456');

      expect(mockSocket.emit).toHaveBeenCalledWith('room:join', {
        roomId: 'room-123',
        playerId: 'player-456',
      });
      socketClient.disconnect();
    });
  });

  describe('leaveRoom', () => {
    it('should emit room:leave event', () => {
      socketClient.connect();
      socketClient.leaveRoom('room-123', 'player-456');

      expect(mockSocket.emit).toHaveBeenCalledWith('room:leave', {
        roomId: 'room-123',
        playerId: 'player-456',
      });
      socketClient.disconnect();
    });
  });

  describe('onRoomUpdated', () => {
    it('should register event listener and return unsubscribe function', () => {
      socketClient.connect();
      const callback = vi.fn();

      const unsubscribe = socketClient.onRoomUpdated(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('room:updated', callback);

      unsubscribe();

      expect(mockSocket.off).toHaveBeenCalledWith('room:updated', callback);
      socketClient.disconnect();
    });

    it('should handle multiple listeners', () => {
      socketClient.connect();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = socketClient.onRoomUpdated(callback1);
      const unsubscribe2 = socketClient.onRoomUpdated(callback2);

      expect(mockSocket.on).toHaveBeenCalledWith('room:updated', callback1);
      expect(mockSocket.on).toHaveBeenCalledWith('room:updated', callback2);

      unsubscribe1();

      expect(mockSocket.off).toHaveBeenCalledWith('room:updated', callback1);
      expect(mockSocket.off).not.toHaveBeenCalledWith('room:updated', callback2);
      socketClient.disconnect();
    });
  });

  describe('onError', () => {
    it('should register error event listener and return unsubscribe function', () => {
      socketClient.connect();
      const callback = vi.fn();

      const unsubscribe = socketClient.onError(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('error', callback);

      unsubscribe();

      expect(mockSocket.off).toHaveBeenCalledWith('error', callback);
      socketClient.disconnect();
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', () => {
      mockSocket.connected = true;
      socketClient.connect();

      expect(socketClient.isConnected()).toBe(true);
      socketClient.disconnect();
    });

    it('should return false when not connected', () => {
      expect(socketClient.isConnected()).toBe(false);
    });
  });
});
