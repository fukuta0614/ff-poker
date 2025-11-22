/**
 * マイルストーンB セッション管理サービス
 * プレイヤーセッションの作成・更新・削除・再接続を管理
 */

import { TIMEOUT_CONSTANTS } from '../utils/constants';

/**
 * プレイヤーセッション情報
 */
export interface PlayerSession {
  playerId: string;
  socketId: string;
  lastSeen: number;
  createdAt: number;
}

/**
 * SessionManager
 * RAM上でプレイヤーセッションを管理（Redis不使用）
 */
export class SessionManager {
  private sessions: Map<string, PlayerSession>;
  private readonly GRACE_PERIOD: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.sessions = new Map();
    this.GRACE_PERIOD = TIMEOUT_CONSTANTS.GRACE_PERIOD;
    this.cleanupInterval = null;
  }

  /**
   * 新規セッション作成
   */
  createSession(playerId: string, socketId: string): void {
    const now = Date.now();
    this.sessions.set(playerId, {
      playerId,
      socketId,
      lastSeen: now,
      createdAt: now,
    });
  }

  /**
   * セッション更新（lastSeen更新）
   */
  updateSession(playerId: string, socketId: string): void {
    const session = this.sessions.get(playerId);
    if (session) {
      session.socketId = socketId;
      session.lastSeen = Date.now();
    }
  }

  /**
   * 再接続処理
   * @returns 再接続成功の場合true
   */
  reconnect(playerId: string, newSocketId: string): boolean {
    const session = this.sessions.get(playerId);
    if (!session) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - session.lastSeen;

    // グレースピリオド内であれば再接続成功
    if (elapsed <= this.GRACE_PERIOD) {
      session.socketId = newSocketId;
      session.lastSeen = now;
      return true;
    }

    // グレースピリオド超過の場合は失敗
    return false;
  }

  /**
   * セッション有効性確認
   */
  isSessionValid(playerId: string): boolean {
    const session = this.sessions.get(playerId);
    if (!session) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - session.lastSeen;
    return elapsed <= this.GRACE_PERIOD;
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredPlayerIds: string[] = [];

    for (const [playerId, session] of this.sessions.entries()) {
      const elapsed = now - session.lastSeen;
      if (elapsed > this.GRACE_PERIOD) {
        expiredPlayerIds.push(playerId);
      }
    }

    for (const playerId of expiredPlayerIds) {
      this.sessions.delete(playerId);
    }
  }

  /**
   * セッション取得
   */
  getSession(playerId: string): PlayerSession | undefined {
    return this.sessions.get(playerId);
  }

  /**
   * セッション削除
   */
  deleteSession(playerId: string): void {
    this.sessions.delete(playerId);
  }

  /**
   * 定期クリーンアップ開始
   */
  startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return; // 既に開始済み
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, TIMEOUT_CONSTANTS.CLEANUP_INTERVAL);
  }

  /**
   * 定期クリーンアップ停止
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 全セッション数取得（テスト用）
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
