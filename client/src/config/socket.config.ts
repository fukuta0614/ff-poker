/**
 * Socket.io設定定数
 */

export const SOCKET_CONFIG = {
  /**  Socket.io接続URL */
  URL: import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',

  /** 再接続設定 */
  RECONNECTION: {
    /** 再接続を試行するかどうか */
    ENABLED: true,
    /** 最大再接続試行回数 */
    MAX_ATTEMPTS: 10,
    /** 再接続遅延（ミリ秒） */
    DELAY: 1000,
    /** 再接続遅延の最大値（ミリ秒） */
    DELAY_MAX: 5000,
  },

  /** タイムアウト設定 */
  TIMEOUT: {
    /** Socket.io接続タイムアウト（ミリ秒） */
    CONNECTION: 20000,
    /** 再接続リクエストのタイムアウト（ミリ秒） */
    RECONNECT_REQUEST: 10000,
  },
} as const;
