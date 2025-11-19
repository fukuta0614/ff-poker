/**
 * ポット計算クラス
 * メインポットとサイドポットの計算、配分を行う
 */

import { SidePot } from '../types/game';

export class PotCalculator {
  /**
   * ベット額からメインポットとサイドポットを計算
   * @param bets 各プレイヤーのベット額
   * @param folded フォールドしたプレイヤーのセット
   * @returns ポットの配列（メインポット + サイドポット）
   */
  public static calculate(
    bets: Map<string, number>,
    folded: Set<string>
  ): SidePot[] {
    const pots: SidePot[] = [];

    // ベット額が0のプレイヤーを除外
    const activeBets = new Map(
      Array.from(bets.entries()).filter(([, amount]) => amount > 0)
    );

    if (activeBets.size === 0) {
      return pots;
    }

    // ベット額の昇順でプレイヤーをソート
    const sortedBets = Array.from(activeBets.entries()).sort((a, b) => a[1] - b[1]);

    let remainingBets = new Map(sortedBets);

    while (remainingBets.size > 0) {
      // 最小ベット額を取得
      const minBet = Math.min(...Array.from(remainingBets.values()));

      // このポットに参加できるプレイヤー（フォールドしていない）
      const eligiblePlayers = Array.from(remainingBets.keys()).filter(
        (playerId) => !folded.has(playerId)
      );

      // ポット額を計算
      let potAmount = 0;
      const updatedBets = new Map<string, number>();

      for (const [playerId, bet] of remainingBets.entries()) {
        potAmount += minBet;
        const remaining = bet - minBet;

        if (remaining > 0) {
          updatedBets.set(playerId, remaining);
        }
      }

      // ポットを追加
      pots.push({
        amount: potAmount,
        eligiblePlayers,
      });

      remainingBets = updatedBets;
    }

    return pots;
  }

  /**
   * ポットを勝者に配分
   * @param pots ポットの配列
   * @param winners 各ポットの勝者（potIndex → playerIds）
   * @returns 各プレイヤーの獲得額
   */
  public static distribute(
    pots: SidePot[],
    winners: Map<number, string[]>
  ): Map<string, number> {
    const payouts = new Map<string, number>();

    pots.forEach((pot, index) => {
      const potWinners = winners.get(index);

      if (!potWinners || potWinners.length === 0) {
        // 勝者がいない場合はスキップ
        return;
      }

      // ポット額を勝者で分割
      const share = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount % potWinners.length;

      potWinners.forEach((playerId, i) => {
        const currentPayout = payouts.get(playerId) || 0;
        // 最初の勝者に余りを加算
        const amount = share + (i === 0 ? remainder : 0);
        payouts.set(playerId, currentPayout + amount);
      });
    });

    return payouts;
  }
}
