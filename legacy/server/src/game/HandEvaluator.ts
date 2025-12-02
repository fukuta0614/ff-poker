/**
 * ポーカーハンドの評価クラス
 * pokersolverライブラリを使用して役判定を行う
 */

import { Hand } from 'pokersolver';

export type HandResult = {
  rank: string;
  description: string;
  value: number;
  hand: Hand; // pokersolverのHandオブジェクトを保持
};

export class HandEvaluator {
  /**
   * ホールカードとコミュニティカードから最良のハンドを評価
   * @param holeCards プレイヤーのホールカード（2枚）
   * @param communityCards コミュニティカード（3-5枚）
   * @returns ハンド評価結果
   */
  public static evaluate(holeCards: string[], communityCards: string[]): HandResult {
    if (holeCards.length + communityCards.length < 5) {
      throw new Error('At least 5 cards are required to evaluate a hand');
    }

    const allCards = [...holeCards, ...communityCards];

    try {
      const hand = Hand.solve(allCards);

      // バリデーション: pokersolverが有効な結果を返したか確認
      if (!hand || !hand.name) {
        throw new Error('Invalid hand result');
      }

      return {
        rank: hand.name,
        description: hand.descr,
        value: hand.rank,
        hand: hand,
      };
    } catch (error) {
      throw new Error(`Invalid card format: ${error}`);
    }
  }

  /**
   * 2つのハンドを比較
   * @param hand1 ハンド1
   * @param hand2 ハンド2
   * @returns 1: hand1が勝ち, -1: hand2が勝ち, 0: 引き分け
   */
  public static compare(hand1: HandResult, hand2: HandResult): number {
    // pokersolverのcompareメソッドを使用
    // 戻り値が正の場合: hand2 > hand1、負の場合: hand1 > hand2
    const result = hand1.hand.compare(hand2.hand);

    // 結果を反転させる（pokersolverの仕様）
    if (result > 0) {
      return -1;
    } else if (result < 0) {
      return 1;
    } else {
      return 0;
    }
  }

  /**
   * ホールカードとコミュニティカードから最良の5枚を選択して評価
   * @param holeCards プレイヤーのホールカード（2枚）
   * @param communityCards コミュニティカード（3-5枚）
   * @returns ハンド評価結果
   */
  public static getBestHand(holeCards: string[], communityCards: string[]): HandResult {
    // pokersolverのHand.solveは自動的に最良の5枚を選択する
    return this.evaluate(holeCards, communityCards);
  }
}
