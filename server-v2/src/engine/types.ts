/**
 * 純粋関数型ゲームエンジンの型定義
 */

import { Option } from 'fp-ts/Option';

// --- 基本型 ---

export type PlayerId = string;
export type Card = string; // "As", "Kh" など

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'acknowledge';

export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

// --- 乱数生成器型 ---

/**
 * 乱数生成器の状態
 * 線形合同法（LCG: Linear Congruential Generator）のシード値
 * この状態から決定的に乱数列を生成できる
 */
export interface RNGState {
  readonly seed: number;
}

/**
 * 次の乱数生成結果
 * 乱数値と次のRNG状態を含む
 */
export interface RNGResult {
  readonly value: number; // 0以上1未満の乱数
  readonly nextState: RNGState;
}

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

// --- 確認応答型 ---

/**
 * 確認応答の状態
 */
export interface AcknowledgmentState {
  /**
   * ack を期待するプレイヤーID
   * ゲーム中の全アクティブプレイヤー (folded 以外)
   */
  readonly expectedAcks: ReadonlySet<PlayerId>;

  /**
   * 既に受信した ack
   */
  readonly receivedAcks: ReadonlySet<PlayerId>;

  /**
   * ack 待ち開始のタイムスタンプ (タイムアウト検出用)
   */
  readonly startedAt: number;

  /**
   * 遷移の説明 (デバッグ用)
   */
  readonly description: string;

  /**
   * ack のタイプ
   * 'action': プレイヤーアクション後の ack
   * 'stage_transition': ステージ遷移後の ack
   */
  readonly type: 'action' | 'stage_transition';
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
  readonly rngState: RNGState; // 乱数生成器の状態

  /**
   * クライアントからの確認応答を待っているか
   * true: 全クライアントの ack を待機中 (アクションを受け付けない)
   * false: 通常状態 (アクションを受け付け可能)
   */
  readonly waitingForAck: boolean;

  /**
   * 確認応答の状態
   * waitingForAck が true の時のみ Some
   */
  readonly ackState: Option<AcknowledgmentState>;
}

// --- アクション型 ---

export interface PlayerAction {
  readonly playerId: PlayerId;
  readonly type: ActionType;
  readonly amount?: number;

  // acknowledge アクション専用フィールド
  readonly acknowledgedAt?: number; // クライアント側のタイムスタンプ
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
  | { readonly type: 'MissingHand'; readonly playerId: PlayerId; readonly stage: Stage }
  | { readonly type: 'WaitingForAcknowledgment' }
  | { readonly type: 'AcknowledgmentNotExpected'; readonly playerId: PlayerId }
  | { readonly type: 'AcknowledgmentAlreadyReceived'; readonly playerId: PlayerId }
  | { readonly type: 'AcknowledgmentTimeout'; readonly ackState: AcknowledgmentState };

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
