/**
 * ハンド評価関数（純粋関数型）
 * 既存のHandEvaluatorクラスをfp-tsでラップ
 */

import * as E from 'fp-ts/Either';
import { Hand } from 'pokersolver';
import type { Card, HandEvaluation, GameError } from './types';
import { isValidCard } from './deck';
import { MIN_HAND_SIZE } from './constants';

/**
 * ホールカードとコミュニティカードからハンドを評価
 * @param holeCards プレイヤーのホールカード（2枚）
 * @param communityCards コミュニティカード（0-5枚）
 * @returns Either<GameError, HandEvaluation>
 */
export function evaluateHand(
  holeCards: readonly [Card, Card],
  communityCards: readonly Card[]
): E.Either<GameError, HandEvaluation> {
  // カード枚数チェック（最低5枚必要）
  const totalCards = holeCards.length + communityCards.length;
  if (totalCards < MIN_HAND_SIZE) {
    return E.left({
      type: 'InsufficientCards',
      required: MIN_HAND_SIZE,
      available: totalCards,
    });
  }

  // カード形式のバリデーション
  const allCards = [...holeCards, ...communityCards];
  for (const card of allCards) {
    if (!isValidCard(card)) {
      return E.left({
        type: 'InvalidCardFormat',
        card,
        reason: `Card must be in format [rank][suit] (e.g., "As", "Kh")`,
      });
    }
  }

  try {

    // pokersolverでハンドを評価
    const hand = Hand.solve(allCards);

    // 結果の検証
    if (!hand || !hand.name) {
      return E.left({
        type: 'HandEvaluationFailed',
        reason: 'Invalid hand evaluation result from pokersolver',
      });
    }

    // HandEvaluation型に変換（内部的にHandオブジェクトも保存）
    const evaluation: HandEvaluation = {
      rank: hand.name,
      description: hand.descr,
      value: hand.rank,
      _internalHand: hand,
    };

    return E.right(evaluation);
  } catch (error) {
    // カード形式が不正な場合
    // pokersolverは不正なカードに対してエラーをスローしないことがあるため、
    // 結果を検証する
    return E.left({
      type: 'HandEvaluationFailed',
      reason: `Hand evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * 2つのハンドを比較
 * @param hand1 ハンド1
 * @param hand2 ハンド2
 * @returns 1: hand1が勝ち, -1: hand2が勝ち, 0: 引き分け
 */
export function compareHands(
  hand1: HandEvaluation,
  hand2: HandEvaluation
): number {
  // pokersolverのHandオブジェクトがあれば、それを使って正確に比較
  if (hand1._internalHand && hand2._internalHand) {
    // Type assertion: we know this is a pokersolver Hand object
    const internalHand1 = hand1._internalHand as { compare: (other: unknown) => number };
    const internalHand2 = hand2._internalHand;

    const result = internalHand1.compare(internalHand2);

    // pokersolverのcompareは、負の値ならhand1が強い、正の値ならhand2が強い
    // 戻り値を反転して、標準的な比較関数の形式にする
    if (result < 0) {
      return 1; // hand1が強い
    } else if (result > 0) {
      return -1; // hand2が強い
    } else {
      return 0; // 引き分け
    }
  }

  // Handオブジェクトがない場合は、数値スコアで比較
  if (hand1.value > hand2.value) {
    return 1;
  } else if (hand1.value < hand2.value) {
    return -1;
  } else {
    return 0;
  }
}

/**
 * 複数のハンドを評価してソート（降順）
 * @param hands ハンド評価の配列
 * @returns ソートされたハンド配列
 */
export function sortHandsByStrength(
  hands: readonly HandEvaluation[]
): readonly HandEvaluation[] {
  return [...hands].sort((a, b) => compareHands(b, a));
}
