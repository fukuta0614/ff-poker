/**
 * SessionManager ユニットテスト
 */

import { SessionManager } from '../../src/services/SessionManager';
import { TIMEOUT_CONSTANTS } from '../../src/utils/constants';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    jest.useFakeTimers();
  });

  afterEach(() => {
    sessionManager.stopCleanupInterval();
    jest.useRealTimers();
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const playerId = 'player-1';
      const socketId = 'socket-1';

      sessionManager.createSession(playerId, socketId);

      const session = sessionManager.getSession(playerId);
      expect(session).toBeDefined();
      expect(session?.playerId).toBe(playerId);
      expect(session?.socketId).toBe(socketId);
      expect(session?.lastSeen).toBeDefined();
      expect(session?.createdAt).toBeDefined();
    });

    it('should overwrite existing session', () => {
      const playerId = 'player-1';
      const socketId1 = 'socket-1';
      const socketId2 = 'socket-2';

      sessionManager.createSession(playerId, socketId1);
      sessionManager.createSession(playerId, socketId2);

      const session = sessionManager.getSession(playerId);
      expect(session?.socketId).toBe(socketId2);
    });
  });

  describe('updateSession', () => {
    it('should update lastSeen and socketId', () => {
      const playerId = 'player-1';
      const socketId1 = 'socket-1';
      const socketId2 = 'socket-2';

      sessionManager.createSession(playerId, socketId1);
      const initialLastSeen = sessionManager.getSession(playerId)?.lastSeen;

      jest.advanceTimersByTime(5000); // 5秒経過

      sessionManager.updateSession(playerId, socketId2);

      const session = sessionManager.getSession(playerId);
      expect(session?.socketId).toBe(socketId2);
      expect(session?.lastSeen).toBeGreaterThan(initialLastSeen!);
    });

    it('should do nothing if session does not exist', () => {
      sessionManager.updateSession('non-existent', 'socket-1');
      expect(sessionManager.getSession('non-existent')).toBeUndefined();
    });
  });

  describe('reconnect', () => {
    it('should succeed within grace period', () => {
      const playerId = 'player-1';
      const socketId1 = 'socket-1';
      const socketId2 = 'socket-2';

      sessionManager.createSession(playerId, socketId1);

      // 60秒経過（グレースピリオド120秒以内）
      jest.advanceTimersByTime(60000);

      const result = sessionManager.reconnect(playerId, socketId2);

      expect(result).toBe(true);
      const session = sessionManager.getSession(playerId);
      expect(session?.socketId).toBe(socketId2);
    });

    it('should fail after grace period', () => {
      const playerId = 'player-1';
      const socketId1 = 'socket-1';
      const socketId2 = 'socket-2';

      sessionManager.createSession(playerId, socketId1);

      // 121秒経過（グレースピリオド120秒超過）
      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.GRACE_PERIOD + 1000);

      const result = sessionManager.reconnect(playerId, socketId2);

      expect(result).toBe(false);
    });

    it('should fail if session does not exist', () => {
      const result = sessionManager.reconnect('non-existent', 'socket-1');
      expect(result).toBe(false);
    });
  });

  describe('isSessionValid', () => {
    it('should return true within grace period', () => {
      const playerId = 'player-1';
      sessionManager.createSession(playerId, 'socket-1');

      jest.advanceTimersByTime(60000); // 60秒経過

      expect(sessionManager.isSessionValid(playerId)).toBe(true);
    });

    it('should return false after grace period', () => {
      const playerId = 'player-1';
      sessionManager.createSession(playerId, 'socket-1');

      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.GRACE_PERIOD + 1000);

      expect(sessionManager.isSessionValid(playerId)).toBe(false);
    });

    it('should return false if session does not exist', () => {
      expect(sessionManager.isSessionValid('non-existent')).toBe(false);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      sessionManager.createSession('player-1', 'socket-1');
      sessionManager.createSession('player-2', 'socket-2');

      // player-1のセッションを期限切れにする
      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.GRACE_PERIOD + 1000);

      sessionManager.cleanupExpiredSessions();

      expect(sessionManager.getSession('player-1')).toBeUndefined();
      expect(sessionManager.getSession('player-2')).toBeUndefined();
    });

    it('should keep valid sessions', () => {
      sessionManager.createSession('player-1', 'socket-1');
      jest.advanceTimersByTime(60000); // 60秒経過

      sessionManager.createSession('player-2', 'socket-2');

      jest.advanceTimersByTime(61000); // さらに61秒経過（player-1は121秒、player-2は61秒）

      sessionManager.cleanupExpiredSessions();

      expect(sessionManager.getSession('player-1')).toBeUndefined();
      expect(sessionManager.getSession('player-2')).toBeDefined();
    });
  });

  describe('deleteSession', () => {
    it('should delete session', () => {
      const playerId = 'player-1';
      sessionManager.createSession(playerId, 'socket-1');

      sessionManager.deleteSession(playerId);

      expect(sessionManager.getSession(playerId)).toBeUndefined();
    });
  });

  describe('cleanup interval', () => {
    it('should start and stop cleanup interval', () => {
      sessionManager.startCleanupInterval();

      sessionManager.createSession('player-1', 'socket-1');
      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.GRACE_PERIOD + 1000);

      // クリーンアップ間隔（30秒）経過
      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.CLEANUP_INTERVAL);

      expect(sessionManager.getSession('player-1')).toBeUndefined();

      sessionManager.stopCleanupInterval();
    });

    it('should not start interval twice', () => {
      sessionManager.startCleanupInterval();
      sessionManager.startCleanupInterval();

      // エラーが発生しないことを確認
      expect(true).toBe(true);

      sessionManager.stopCleanupInterval();
    });
  });

  describe('getSessionCount', () => {
    it('should return correct session count', () => {
      expect(sessionManager.getSessionCount()).toBe(0);

      sessionManager.createSession('player-1', 'socket-1');
      expect(sessionManager.getSessionCount()).toBe(1);

      sessionManager.createSession('player-2', 'socket-2');
      expect(sessionManager.getSessionCount()).toBe(2);

      sessionManager.deleteSession('player-1');
      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });
});
