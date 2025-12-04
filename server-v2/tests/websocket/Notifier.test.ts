/**
 * Notifierサービスのユニットテスト（シンプル版）
 */

import { Server } from 'socket.io';
import type { PlayerId } from '@engine/types';
import { GameNotifier } from '../../src/websocket/notifier';

describe('GameNotifier', () => {
  let mockIo: jest.Mocked<Server>;
  let notifier: GameNotifier;

  beforeEach(() => {
    // Socket.ioのモック作成
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    notifier = new GameNotifier(mockIo);
  });

  describe('notifyRoomUpdated', () => {
    it('room:updated イベントを発火する', () => {
      const roomId = 'room-123';

      notifier.notifyRoomUpdated(roomId);

      expect(mockIo.to).toHaveBeenCalledWith(roomId);
      expect(mockIo.emit).toHaveBeenCalledWith('room:updated', {
        roomId,
        timestamp: expect.any(String),
        updateType: undefined,
      });
    });

    it('room:updated イベントをupdateType付きで発火する', () => {
      const roomId = 'room-123';
      const updateType = 'game_started' as const;

      notifier.notifyRoomUpdated(roomId, updateType);

      expect(mockIo.to).toHaveBeenCalledWith(roomId);
      expect(mockIo.emit).toHaveBeenCalledWith('room:updated', {
        roomId,
        timestamp: expect.any(String),
        updateType,
      });
    });
  });

  describe('notifyError', () => {
    it('error イベントを特定のソケットに発火する', () => {
      const socketId = 'socket-abc';
      const code = 'INVALID_ACTION';
      const message = 'Invalid action type';
      const details = { action: 'invalid' };

      const mockSocket = {
        emit: jest.fn(),
      };
      mockIo.to = jest.fn().mockReturnValue(mockSocket);

      notifier.notifyError(socketId, code, message, details);

      expect(mockIo.to).toHaveBeenCalledWith(socketId);
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        code,
        message,
        details,
        timestamp: expect.any(String),
      });
    });
  });

  describe('notifyToPlayer', () => {
    it('特定のプレイヤーにのみイベントを発火する', () => {
      const roomId = 'room-123';
      const playerId = 'player-1' as PlayerId;

      // プレイヤーのソケットIDを設定
      const socketId = 'socket-abc';
      notifier.setPlayerSocket(playerId, socketId);

      notifier.notifyToPlayer(playerId, 'room:updated', {
        roomId,
        timestamp: new Date().toISOString(),
      });

      expect(mockIo.to).toHaveBeenCalledWith(socketId);
      expect(mockIo.emit).toHaveBeenCalledWith('room:updated', {
        roomId,
        timestamp: expect.any(String),
      });
    });

    it('ソケットIDが未登録の場合は何もしない', () => {
      const playerId = 'player-unknown' as PlayerId;

      notifier.notifyToPlayer(playerId, 'room:updated', {
        roomId: 'room-123',
        timestamp: new Date().toISOString(),
      });

      expect(mockIo.to).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });

  describe('setPlayerSocket / removePlayerSocket', () => {
    it('プレイヤーのソケットIDを設定・削除できる', () => {
      const playerId = 'player-1' as PlayerId;
      const socketId = 'socket-abc';

      notifier.setPlayerSocket(playerId, socketId);

      // プレイヤーに通知できる
      notifier.notifyToPlayer(playerId, 'room:updated', {
        roomId: 'room-123',
        timestamp: new Date().toISOString(),
      });
      expect(mockIo.to).toHaveBeenCalledWith(socketId);

      // ソケットIDを削除
      notifier.removePlayerSocket(playerId);

      // 削除後は通知されない
      jest.clearAllMocks();
      notifier.notifyToPlayer(playerId, 'room:updated', {
        roomId: 'room-123',
        timestamp: new Date().toISOString(),
      });
      expect(mockIo.to).not.toHaveBeenCalled();
    });
  });

  describe('getPlayerSocketId', () => {
    it('プレイヤーのソケットIDを取得できる', () => {
      const playerId = 'player-1' as PlayerId;
      const socketId = 'socket-abc';

      notifier.setPlayerSocket(playerId, socketId);

      expect(notifier.getPlayerSocketId(playerId)).toBe(socketId);
    });

    it('未登録のプレイヤーの場合はundefinedを返す', () => {
      const playerId = 'player-unknown' as PlayerId;

      expect(notifier.getPlayerSocketId(playerId)).toBeUndefined();
    });
  });
});
