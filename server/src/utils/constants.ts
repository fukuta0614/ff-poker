/**
 * アプリケーション全体で使用する定数
 */

// ゲーム設定
export const MAX_PLAYERS = 6;
export const DEFAULT_BUY_IN = 1000;
export const DEFAULT_SMALL_BLIND = 10;
export const DEFAULT_BIG_BLIND = 20;

// タイムアウト設定
export const PLAYER_ACTION_TIMEOUT = 30000; // 30秒
export const RECONNECT_GRACE_PERIOD = 30000; // 30秒

// カード定義
export const SUITS = ['h', 'd', 'c', 's'] as const; // hearts, diamonds, clubs, spades
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
