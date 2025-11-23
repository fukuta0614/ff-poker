/**
 * TurnTimerManager ユニットテスト
 */

import { TurnTimerManager } from '../../src/services/TurnTimerManager';
import { TIMEOUT_CONSTANTS } from '../../src/utils/constants';

describe('TurnTimerManager', () => {
  let timerManager: TurnTimerManager;
  let timeoutCallback: jest.Mock;
  let updateCallback: jest.Mock;

  beforeEach(() => {
    timerManager = new TurnTimerManager();
    timeoutCallback = jest.fn();
    updateCallback = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    timerManager.clearAllTimers();
    jest.useRealTimers();
  });

  describe('startTimer', () => {
    it('should start a timer', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);

      expect(timerManager.getActivePlayerId(roomId)).toBe(playerId);
      expect(timerManager.getRemainingTime(roomId)).toBe(60); // 60秒
    });

    it('should call timeout callback after 60 seconds', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);

      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.TURN_TIMEOUT);

      expect(timeoutCallback).toHaveBeenCalledTimes(1);
      expect(timerManager.getActivePlayerId(roomId)).toBeNull();
    });

    it('should call update callback every second', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback, updateCallback);

      // 1秒経過
      jest.advanceTimersByTime(1000);
      expect(updateCallback).toHaveBeenCalledWith(59, false);

      // さらに1秒経過
      jest.advanceTimersByTime(1000);
      expect(updateCallback).toHaveBeenCalledWith(58, false);

      expect(updateCallback).toHaveBeenCalledTimes(2);
    });

    it('should set warning flag when remaining time <= 10 seconds', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback, updateCallback);

      // 50秒経過（残り10秒）
      jest.advanceTimersByTime(50000);
      expect(updateCallback).toHaveBeenCalledWith(10, true);

      // さらに1秒経過（残り9秒）
      jest.advanceTimersByTime(1000);
      expect(updateCallback).toHaveBeenCalledWith(9, true);
    });

    it('should cancel existing timer when starting new timer for same room', () => {
      const roomId = 'room-1';

      timerManager.startTimer(roomId, 'player-1', timeoutCallback);
      timerManager.startTimer(roomId, 'player-2', timeoutCallback);

      expect(timerManager.getActivePlayerId(roomId)).toBe('player-2');
    });
  });

  describe('cancelTimer', () => {
    it('should cancel active timer', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);
      timerManager.cancelTimer(roomId);

      expect(timerManager.getActivePlayerId(roomId)).toBeNull();
      expect(timerManager.getRemainingTime(roomId)).toBeNull();

      // タイムアウトコールバックが呼ばれないことを確認
      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.TURN_TIMEOUT);
      expect(timeoutCallback).not.toHaveBeenCalled();
    });

    it('should do nothing if no timer exists', () => {
      timerManager.cancelTimer('non-existent-room');
      // エラーが発生しないことを確認
      expect(true).toBe(true);
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time in seconds', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);

      expect(timerManager.getRemainingTime(roomId)).toBe(60);

      jest.advanceTimersByTime(10000); // 10秒経過
      expect(timerManager.getRemainingTime(roomId)).toBe(50);

      jest.advanceTimersByTime(30000); // さらに30秒経過
      expect(timerManager.getRemainingTime(roomId)).toBe(20);
    });

    it('should return 0 when time is up', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);

      jest.advanceTimersByTime(TIMEOUT_CONSTANTS.TURN_TIMEOUT);

      // タイムアウト後はタイマーが削除されるのでnull
      expect(timerManager.getRemainingTime(roomId)).toBeNull();
    });

    it('should return null if no timer exists', () => {
      expect(timerManager.getRemainingTime('non-existent-room')).toBeNull();
    });

    it('should round up remaining time', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);

      // 500ミリ秒経過（0.5秒）
      jest.advanceTimersByTime(500);
      expect(timerManager.getRemainingTime(roomId)).toBe(60); // 切り上げで60秒

      // さらに600ミリ秒経過（合計1.1秒）
      jest.advanceTimersByTime(600);
      expect(timerManager.getRemainingTime(roomId)).toBe(59); // 切り上げで59秒
    });
  });

  describe('isWarning', () => {
    it('should return true when remaining time <= 10 seconds', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);

      expect(timerManager.isWarning(roomId)).toBe(false);

      // 50秒経過（残り10秒）
      jest.advanceTimersByTime(50000);
      expect(timerManager.isWarning(roomId)).toBe(true);

      // さらに5秒経過（残り5秒）
      jest.advanceTimersByTime(5000);
      expect(timerManager.isWarning(roomId)).toBe(true);
    });

    it('should return false if no timer exists', () => {
      expect(timerManager.isWarning('non-existent-room')).toBe(false);
    });
  });

  describe('getActivePlayerId', () => {
    it('should return active player ID', () => {
      const roomId = 'room-1';
      const playerId = 'player-1';

      timerManager.startTimer(roomId, playerId, timeoutCallback);

      expect(timerManager.getActivePlayerId(roomId)).toBe(playerId);
    });

    it('should return null if no timer exists', () => {
      expect(timerManager.getActivePlayerId('non-existent-room')).toBeNull();
    });
  });

  describe('clearAllTimers', () => {
    it('should clear all timers', () => {
      timerManager.startTimer('room-1', 'player-1', timeoutCallback);
      timerManager.startTimer('room-2', 'player-2', timeoutCallback);

      timerManager.clearAllTimers();

      expect(timerManager.getActivePlayerId('room-1')).toBeNull();
      expect(timerManager.getActivePlayerId('room-2')).toBeNull();
    });
  });
});
