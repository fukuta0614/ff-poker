/**
 * FF Poker Client Game Types
 * OpenAPI自動生成型をラップして、クライアント用の型を提供
 */

import type { components } from './api';

// ============================================
// Re-export OpenAPI types
// ============================================

export type GameState = components['schemas']['GameState'];
export type PlayerState = components['schemas']['PlayerState'];
export type PlayerInfo = components['schemas']['PlayerInfo'];
export type Pot = components['schemas']['Pot'];
export type AckState = components['schemas']['AckState'];
export type RoomResponse = components['schemas']['RoomResponse'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

// ============================================
// Action Types
// ============================================

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'acknowledge';

export interface PlayerAction {
  type: ActionType;
  amount?: number;
}

// ============================================
// Client-specific Types
// ============================================

/**
 * プレイヤーの手札情報
 * サーバーから取得したGameState.players[].handを格納
 */
export type Hand = [string, string] | null;

/**
 * ゲーム状態の段階
 */
export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

/**
 * ルーム状態
 */
export type RoomState = 'waiting' | 'in_progress' | 'ended';

/**
 * クライアント用の拡張GameState
 * サーバーから取得したGameStateに、クライアント固有の情報を追加
 */
export interface ClientGameState extends GameState {
  /**
   * 自分の手札（PlayerState.handから抽出）
   */
  myHand: Hand;
}
