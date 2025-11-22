/**
 * アプリケーション全体で使用する定数
 */

// ゲーム設定
export const MAX_PLAYERS = 6;
export const DEFAULT_BUY_IN = 1000;
export const DEFAULT_SMALL_BLIND = 10;
export const DEFAULT_BIG_BLIND = 20;

// タイムアウト設定（マイルストーンB）
export const PLAYER_ACTION_TIMEOUT = 60000; // 60秒
export const RECONNECT_GRACE_PERIOD = 120000; // 120秒
export const WARNING_THRESHOLD = 10000; // 10秒
export const TIMER_UPDATE_INTERVAL = 1000; // 1秒
export const CLEANUP_INTERVAL = 30000; // 30秒

/**
 * タイムアウト関連定数（マイルストーンB）
 */
export const TIMEOUT_CONSTANTS = {
  GRACE_PERIOD: 120000,
  TURN_TIMEOUT: 60000,
  WARNING_THRESHOLD: 10000,
  TIMER_UPDATE_INTERVAL: 1000,
  CLEANUP_INTERVAL: 30000,
} as const;

/**
 * エラーコード定義
 */
export enum ErrorCode {
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_BET_AMOUNT = 'INVALID_BET_AMOUNT',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  RECONNECT_FAILED = 'RECONNECT_FAILED',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  ROOM_FULL = 'ROOM_FULL',
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS',
}

/**
 * エラーメッセージマップ（日本語）
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NOT_YOUR_TURN]: '今はあなたのターンではありません',
  [ErrorCode.INVALID_ACTION]: 'そのアクションは実行できません',
  [ErrorCode.INVALID_BET_AMOUNT]: '所持チップを超えるベットはできません',
  [ErrorCode.ROOM_NOT_FOUND]: 'ルームが見つかりません。ルームIDを確認してください',
  [ErrorCode.RECONNECT_FAILED]: '再接続に失敗しました。セッションの有効期限が切れています',
  [ErrorCode.TIMEOUT]: 'タイムアウトしました',
  [ErrorCode.INTERNAL_ERROR]: 'サーバーエラーが発生しました。しばらくしてから再度お試しください',
  [ErrorCode.ROOM_FULL]: 'ルームが満員です',
  [ErrorCode.GAME_IN_PROGRESS]: 'ゲームが進行中のため参加できません',
};

// カード定義
export const SUITS = ['h', 'd', 'c', 's'] as const; // hearts, diamonds, clubs, spades
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
