/**
 * マイルストーンB ターンタイマー管理サービス
 * プレイヤーターンのタイムアウト管理、自動アクション実行
 */

import { TIMEOUT_CONSTANTS } from '../utils/constants';

/**
 * ターンタイマー情報
 */
interface TurnTimer {
  roomId: string;
  playerId: string;
  startTime: number;
  timeout: NodeJS.Timeout;
  updateInterval: NodeJS.Timeout;
}

/**
 * タイマー更新コールバック
 */
export type TimerUpdateCallback = (remainingSeconds: number, isWarning: boolean) => void;

/**
 * TurnTimerManager
 * 60秒のターンタイムアウトと10秒警告を管理
 */
export class TurnTimerManager {
  private timers: Map<string, TurnTimer>;
  private readonly TIMEOUT_DURATION: number;
  private readonly WARNING_THRESHOLD: number;
  private readonly UPDATE_INTERVAL: number;

  constructor() {
    this.timers = new Map();
    this.TIMEOUT_DURATION = TIMEOUT_CONSTANTS.TURN_TIMEOUT;
    this.WARNING_THRESHOLD = TIMEOUT_CONSTANTS.WARNING_THRESHOLD;
    this.UPDATE_INTERVAL = TIMEOUT_CONSTANTS.TIMER_UPDATE_INTERVAL;
  }

  /**
   * タイマー開始
   * @param roomId ルームID
   * @param playerId プレイヤーID
   * @param onTimeout タイムアウト時のコールバック
   * @param onUpdate タイマー更新時のコールバック（オプション）
   */
  startTimer(
    roomId: string,
    playerId: string,
    onTimeout: () => void,
    onUpdate?: TimerUpdateCallback
  ): void {
    // 既存のタイマーがあればキャンセル
    this.cancelTimer(roomId);

    const startTime = Date.now();

    // タイムアウトタイマー
    const timeout = setTimeout(() => {
      this.cancelTimer(roomId);
      onTimeout();
    }, this.TIMEOUT_DURATION);

    // 更新タイマー（1秒毎）
    let updateInterval: NodeJS.Timeout | undefined;
    if (onUpdate) {
      updateInterval = setInterval(() => {
        const remaining = this.getRemainingTime(roomId);
        if (remaining !== null) {
          const isWarning = remaining <= this.WARNING_THRESHOLD / 1000;
          onUpdate(remaining, isWarning);
        }
      }, this.UPDATE_INTERVAL);
    }

    this.timers.set(roomId, {
      roomId,
      playerId,
      startTime,
      timeout,
      updateInterval: updateInterval!,
    });
  }

  /**
   * タイマーキャンセル
   */
  cancelTimer(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) {
      clearTimeout(timer.timeout);
      if (timer.updateInterval) {
        clearInterval(timer.updateInterval);
      }
      this.timers.delete(roomId);
    }
  }

  /**
   * 残り時間取得（秒）
   * @returns 残り時間（秒）、タイマー非アクティブの場合null
   */
  getRemainingTime(roomId: string): number | null {
    const timer = this.timers.get(roomId);
    if (!timer) {
      return null;
    }

    const elapsed = Date.now() - timer.startTime;
    const remaining = this.TIMEOUT_DURATION - elapsed;

    if (remaining <= 0) {
      return 0;
    }

    return Math.ceil(remaining / 1000); // ミリ秒を秒に変換（切り上げ）
  }

  /**
   * タイマーが警告状態か確認（残り10秒以下）
   */
  isWarning(roomId: string): boolean {
    const remaining = this.getRemainingTime(roomId);
    if (remaining === null) {
      return false;
    }

    return remaining <= this.WARNING_THRESHOLD / 1000;
  }

  /**
   * アクティブなタイマーのプレイヤーID取得
   */
  getActivePlayerId(roomId: string): string | null {
    const timer = this.timers.get(roomId);
    return timer ? timer.playerId : null;
  }

  /**
   * すべてのタイマーをクリア（テスト用）
   */
  clearAllTimers(): void {
    for (const roomId of this.timers.keys()) {
      this.cancelTimer(roomId);
    }
  }
}
