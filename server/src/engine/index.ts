/**
 * 純粋関数型ゲームエンジン - エクスポート
 */

// 定数
export {
  HOLE_CARD_COUNT,
  BURN_CARD_COUNT,
  FLOP_CARD_COUNT,
  TURN_CARD_COUNT,
  RIVER_CARD_COUNT,
  MIN_HAND_SIZE,
  DECK_SIZE,
  MIN_PLAYERS,
  MAX_RECOMMENDED_PLAYERS,
  MAX_BET_AMOUNT,
  RANKS,
  SUITS,
  HEADS_UP_PLAYER_COUNT,
  SMALL_BLIND_OFFSET,
  BIG_BLIND_OFFSET,
  UTG_OFFSET,
} from './constants';

// 型定義
export type {
  // 基本型
  PlayerId,
  Card,
  ActionType,
  Stage,

  // RNG型
  RNGState,
  RNGResult,

  // エンティティ型
  Player,
  PlayerState,
  Pot,
  GameState,
  PlayerAction,

  // エラー型
  GameError,

  // 結果型
  ActionResult,
  HandEvaluation,
  WinnerInfo,
  ShowdownResult,
  GameConfig,
} from './types';

// RNG関数
export {
  createRNGState,
  createRandomRNGState,
  nextRandom,
  nextInt,
  randomChoice,
} from './rng';

// Deck関数
export {
  createDeck,
  shuffleDeck,
  dealCards,
  isValidCard,
} from './deck';

// ユーティリティ関数
export {
  getPlayer,
  getPlayerState,
  getCurrentBettor,
  getActivePlayers,
  calculateCallAmount,
  calculateMinRaise,
  getValidActions,
  isBettingComplete,
  hasOnlyOneActivePlayer,
  areAllPlayersAllIn,
} from './utils';

// アクション処理関数
export {
  executeFold,
  executeCheck,
  executeCall,
  executeRaise,
  executeAllIn,
  validateAction,
  processAction,
} from './actions';

// ポット計算関数
export {
  calculatePots,
} from './pot';

// ゲーム初期化関数
export {
  initializeRound,
  collectBlinds,
  dealHoleCards,
  resetForNewStreet,
  advanceBettor,
} from './game-init';

// ステージ遷移関数
export {
  advanceStage,
  advanceStageWithAck,
  advanceToShowdownForAllIn,
  dealFlop,
  dealTurn,
  dealRiver,
} from './stage';

// ハンド評価関数
export {
  evaluateHand,
  compareHands,
  sortHandsByStrength,
} from './hand-evaluator';

// ショーダウン処理関数
export {
  performShowdown,
  determineWinners,
  distributeWinnings,
} from './showdown';
