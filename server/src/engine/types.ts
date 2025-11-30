/**
 * 純粋関数型ゲームエンジンの型定義
 */

import { Option } from 'fp-ts/Option';

// --- 基本型 ---

export type PlayerId = string;
export type Card = string; // "As", "Kh" など

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

// --- プレイヤー型 ---

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly chips: number;
  readonly seat: number;
}

export interface PlayerState {
  readonly bet: number; // 現在のストリートのベット額
  readonly cumulativeBet: number; // 累積ベット額（全ストリート）
  readonly isFolded: boolean;
  readonly hasActed: boolean;
  readonly hand: Option<readonly [Card, Card]>; // ホールカード
}

// --- ポット型 ---

export interface Pot {
  readonly amount: number;
  readonly eligiblePlayers: ReadonlySet<PlayerId>;
}

// --- ゲーム状態型 ---

export interface GameState {
  readonly players: ReadonlyMap<PlayerId, Player>;
  readonly playerStates: ReadonlyMap<PlayerId, PlayerState>;
  readonly stage: Stage;
  readonly dealerIndex: number;
  readonly currentBettorIndex: number;
  readonly deck: readonly Card[];
  readonly communityCards: readonly Card[];
  readonly currentBet: number;
  readonly minRaiseAmount: number;
  readonly lastAggressorId: Option<PlayerId>;
  readonly pots: readonly Pot[];
  readonly totalPot: number;
}

// --- アクション型 ---

export interface PlayerAction {
  readonly playerId: PlayerId;
  readonly type: ActionType;
  readonly amount?: number;
}

// --- エラー型 ---

export type GameError =
  | { readonly type: 'InvalidTurn'; readonly playerId: PlayerId; readonly expectedPlayerId: PlayerId }
  | { readonly type: 'PlayerNotFound'; readonly playerId: PlayerId }
  | { readonly type: 'PlayerAlreadyFolded'; readonly playerId: PlayerId }
  | { readonly type: 'InvalidAction'; readonly action: ActionType; readonly reason: string }
  | { readonly type: 'InsufficientChips'; readonly required: number; readonly available: number }
  | { readonly type: 'InvalidBetAmount'; readonly amount: number; readonly minimum: number }
  | { readonly type: 'GameNotInProgress'; readonly currentStage: Stage }
  | { readonly type: 'InvalidStage'; readonly expected: Stage; readonly actual: Stage }
  | { readonly type: 'InsufficientCards'; readonly required: number; readonly available: number }
  | { readonly type: 'NoActivePlayers' }
  | { readonly type: 'BettingNotComplete' }
  | { readonly type: 'InvalidCardFormat'; readonly card: string; readonly reason: string }
  | { readonly type: 'HandEvaluationFailed'; readonly reason: string }
  | { readonly type: 'MissingHand'; readonly playerId: PlayerId; readonly stage: Stage };

// --- 結果型 ---

export interface ActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly state: GameState;
}

export interface HandEvaluation {
  readonly rank: string; // "Straight Flush", "Four of a Kind", etc.
  readonly description: string; // "Ace high straight flush"
  readonly value: number; // 数値スコア（比較用）
  readonly _internalHand?: unknown; // pokersolverのHandオブジェクト（内部使用のみ）
}

export interface WinnerInfo {
  readonly playerId: PlayerId;
  readonly hand: readonly [Card, Card];
  readonly evaluation: HandEvaluation;
  readonly potIndex: number; // どのポットを獲得したか
  readonly amount: number;
}

export interface ShowdownResult {
  readonly winners: ReadonlyArray<WinnerInfo>;
  readonly pots: readonly Pot[];
  readonly finalState: GameState;
}

// --- ゲーム設定型 ---

export interface GameConfig {
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly maxPlayers: number;
  readonly startingChips: number;
}
