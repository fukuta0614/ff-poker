/**
 * ポット計算関数（純粋関数）
 */

import type { GameState, Pot, PlayerId } from './types';

/**
 * ポットを計算（メインポット + サイドポット）
 *
 * アルゴリズム:
 * 1. 全プレイヤーの累積ベット額を取得
 * 2. ベット額でソート（昇順）
 * 3. 最小ベット額から順にポットを作成
 * 4. 各ポットで、フォールドしていないプレイヤーのみを eligible とする
 */
export const calculatePots = (state: GameState): readonly Pot[] => {
  const pots: Pot[] = [];

  // プレイヤーIDとベット額のペアを作成
  interface PlayerBet {
    playerId: PlayerId;
    bet: number;
    isFolded: boolean;
  }

  const playerBets: PlayerBet[] = Array.from(state.players.keys()).map((playerId) => {
    const playerState = state.playerStates.get(playerId);
    return {
      playerId,
      bet: playerState?.cumulativeBet || 0,
      isFolded: playerState?.isFolded || false,
    };
  });

  // ベット額でソート（昇順）
  const sortedBets = [...playerBets].sort((a, b) => a.bet - b.bet);

  // 残りのベット額を追跡
  const remainingBets = new Map<PlayerId, number>(
    sortedBets.map((pb) => [pb.playerId, pb.bet])
  );

  // 各レベルでポットを作成
  let previousBet = 0;

  for (const { bet: currentBet, isFolded } of sortedBets) {
    if (currentBet === 0) {
      continue; // ベットしていないプレイヤーはスキップ
    }

    const betDiff = currentBet - previousBet;

    if (betDiff === 0) {
      continue; // 同じベット額のプレイヤーは同じポットに含まれる
    }

    // このレベルのポット額を計算
    let potAmount = 0;
    const eligiblePlayers = new Set<PlayerId>();

    for (const [playerId, remainingBet] of remainingBets.entries()) {
      if (remainingBet > 0) {
        const contribution = Math.min(betDiff, remainingBet);
        potAmount += contribution;

        // 残りのベットを更新
        remainingBets.set(playerId, remainingBet - contribution);

        // フォールドしていないプレイヤーのみ eligible
        const playerState = state.playerStates.get(playerId);
        if (playerState && !playerState.isFolded) {
          eligiblePlayers.add(playerId);
        }
      }
    }

    if (potAmount > 0) {
      // 同じ eligible players を持つポットがあれば統合
      const existingPotIndex = pots.findIndex((pot) => {
        if (pot.eligiblePlayers.size !== eligiblePlayers.size) {
          return false;
        }
        for (const playerId of eligiblePlayers) {
          if (!pot.eligiblePlayers.has(playerId)) {
            return false;
          }
        }
        return true;
      });

      if (existingPotIndex >= 0) {
        // 既存のポットに統合
        pots[existingPotIndex] = {
          amount: pots[existingPotIndex].amount + potAmount,
          eligiblePlayers: pots[existingPotIndex].eligiblePlayers,
        };
      } else {
        // 新しいポットを作成
        pots.push({
          amount: potAmount,
          eligiblePlayers,
        });
      }
    }

    previousBet = currentBet;
  }

  return pots;
};
