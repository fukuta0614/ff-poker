/**
 * ゲームエンジンの定数定義
 */

// カード関連
export const HOLE_CARD_COUNT = 2;
export const BURN_CARD_COUNT = 1;
export const FLOP_CARD_COUNT = 3;
export const TURN_CARD_COUNT = 1;
export const RIVER_CARD_COUNT = 1;
export const MIN_HAND_SIZE = 5; // 最小ハンド評価に必要なカード数
export const DECK_SIZE = 52;

// プレイヤー関連
export const MIN_PLAYERS = 2;
export const MAX_RECOMMENDED_PLAYERS = 10; // パフォーマンス推奨値

// ベット関連
export const MAX_BET_AMOUNT = Number.MAX_SAFE_INTEGER;

// カードランクとスーツ
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['h', 'd', 'c', 's'] as const;

// ヘッズアップ時の位置
export const HEADS_UP_PLAYER_COUNT = 2;

// ポジション計算用
export const SMALL_BLIND_OFFSET = 1; // ディーラーからのオフセット
export const BIG_BLIND_OFFSET = 2;
export const UTG_OFFSET = 3; // Under The Gun (BB の次)
