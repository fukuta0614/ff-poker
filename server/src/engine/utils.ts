/**
 * ユーティリティ関数（純粋関数）
 */

import * as O from 'fp-ts/Option';
import type {
  GameState,
  Player,
  PlayerState,
  PlayerId,
  ActionType,
} from './types';

/**
 * プレイヤーを取得
 */
export const getPlayer = (
  playerId: PlayerId,
  state: GameState
): O.Option<Player> => {
  const player = state.players.get(playerId);
  return player !== undefined ? O.some(player) : O.none;
};

/**
 * プレイヤー状態を取得
 */
export const getPlayerState = (
  playerId: PlayerId,
  state: GameState
): O.Option<PlayerState> => {
  const playerState = state.playerStates.get(playerId);
  return playerState !== undefined ? O.some(playerState) : O.none;
};

/**
 * 現在のベッターを取得
 */
export const getCurrentBettor = (state: GameState): O.Option<Player> => {
  const playersArray = Array.from(state.players.values());

  if (
    state.currentBettorIndex < 0 ||
    state.currentBettorIndex >= playersArray.length
  ) {
    return O.none;
  }

  return O.some(playersArray[state.currentBettorIndex]);
};

/**
 * アクティブなプレイヤー（フォールドしていない）を取得
 */
export const getActivePlayers = (state: GameState): ReadonlyArray<Player> => {
  return Array.from(state.players.values()).filter((player) => {
    const playerState = state.playerStates.get(player.id);
    return playerState !== undefined && !playerState.isFolded;
  });
};

/**
 * コール額を計算
 */
export const calculateCallAmount = (
  playerId: PlayerId,
  state: GameState
): number => {
  const playerState = state.playerStates.get(playerId);
  if (!playerState) {
    return 0;
  }

  const callAmount = state.currentBet - playerState.bet;
  return Math.max(0, callAmount);
};

/**
 * 最小レイズ額を計算
 */
export const calculateMinRaise = (state: GameState): number => {
  return state.currentBet + state.minRaiseAmount;
};

/**
 * プレイヤーが実行可能なアクションを取得
 */
export const getValidActions = (
  playerId: PlayerId,
  state: GameState
): ReadonlyArray<ActionType> => {
  const player = state.players.get(playerId);
  const playerState = state.playerStates.get(playerId);

  if (!player || !playerState) {
    return [];
  }

  const actions: ActionType[] = ['fold'];

  const callAmount = calculateCallAmount(playerId, state);
  const minRaise = calculateMinRaise(state);
  const raiseAmount = minRaise - playerState.bet;

  // Bet is settled
  if (callAmount === 0) {
    actions.push('check');
  } else {
    // Can call
    if (player.chips > 0) {
      actions.push('call');
    }
  }

  // Can raise (has enough chips for minimum raise)
  // This applies whether bet is settled or not
  if (player.chips >= raiseAmount) {
    actions.push('raise');
  }

  // Can go all-in
  if (player.chips > 0) {
    actions.push('allin');
  }

  return actions;
};

/**
 * ベットラウンドが完了したかチェック
 */
export const isBettingComplete = (state: GameState): boolean => {
  const activePlayers = getActivePlayers(state);

  // Only one active player remains
  if (activePlayers.length <= 1) {
    return true;
  }

  // Check if all active players have the same bet and have acted
  const activePlayerStates = activePlayers.map((player) =>
    state.playerStates.get(player.id)
  );

  // All must have acted
  const allActed = activePlayerStates.every(
    (ps) => ps !== undefined && ps.hasActed
  );

  if (!allActed) {
    return false;
  }

  // All active players (except all-in with 0 chips) must have equal bets
  const betsAndChips = activePlayers.map((player) => {
    const playerState = state.playerStates.get(player.id)!;
    return {
      bet: playerState.bet,
      chips: player.chips,
    };
  });

  // Find the maximum bet among active players
  const maxBet = Math.max(...betsAndChips.map((bc) => bc.bet));

  // All players must either:
  // 1. Have bet equal to maxBet, OR
  // 2. Be all-in (chips === 0)
  const allBetsSettled = betsAndChips.every(
    (bc) => bc.bet === maxBet || bc.chips === 0
  );

  return allBetsSettled;
};

/**
 * アクティブなプレイヤーが1人だけか（全員フォールド判定）
 */
export const hasOnlyOneActivePlayer = (state: GameState): boolean => {
  const activePlayers = getActivePlayers(state);
  return activePlayers.length === 1;
};

/**
 * 全てのアクティブプレイヤーがオールイン（chips === 0）かどうか
 *
 * この状態の場合、残りのコミュニティカードを一気に配り、
 * ショーダウンまで自動進行すべき
 */
export const areAllPlayersAllIn = (state: GameState): boolean => {
  const activePlayers = getActivePlayers(state);

  if (activePlayers.length <= 1) {
    return false; // 1人以下の場合は「全員オールイン」ではない
  }

  return activePlayers.every((player) => player.chips === 0);
};
