/**
 * ハンド評価関数のテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  evaluateHand,
  compareHands,
  sortHandsByStrength,
} from '../../src/engine/hand-evaluator';
import type { Card, HandEvaluation } from '../../src/engine/types';

describe('hand-evaluator', () => {
  describe('evaluateHand', () => {
    it('should evaluate a royal flush', () => {
      const holeCards: readonly [Card, Card] = ['As', 'Ks'];
      const communityCards: readonly Card[] = ['Qs', 'Js', 'Ts'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Straight Flush');
        expect(result.right.value).toBeGreaterThan(0);
      }
    });

    it('should evaluate a straight flush', () => {
      const holeCards: readonly [Card, Card] = ['9h', '8h'];
      const communityCards: readonly Card[] = ['7h', '6h', '5h'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Straight Flush');
      }
    });

    it('should evaluate four of a kind', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'Ad'];
      const communityCards: readonly Card[] = ['As', 'Ah', 'Kh'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Four of a Kind');
      }
    });

    it('should evaluate a full house', () => {
      const holeCards: readonly [Card, Card] = ['Kc', 'Kd'];
      const communityCards: readonly Card[] = ['Ks', 'Ah', 'Ac'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Full House');
      }
    });

    it('should evaluate a flush', () => {
      const holeCards: readonly [Card, Card] = ['Ah', 'Kh'];
      const communityCards: readonly Card[] = ['Qh', 'Jh', '9h'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Flush');
      }
    });

    it('should evaluate a straight', () => {
      const holeCards: readonly [Card, Card] = ['9h', '8c'];
      const communityCards: readonly Card[] = ['7h', '6s', '5d'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Straight');
      }
    });

    it('should evaluate three of a kind', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'Ad'];
      const communityCards: readonly Card[] = ['As', 'Kh', 'Qh'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Three of a Kind');
      }
    });

    it('should evaluate two pair', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'Ad'];
      const communityCards: readonly Card[] = ['Kc', 'Kh', 'Qh'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Two Pair');
      }
    });

    it('should evaluate one pair', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'Ad'];
      const communityCards: readonly Card[] = ['Kc', 'Qh', 'Jh'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Pair');
      }
    });

    it('should evaluate high card', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'Kd'];
      const communityCards: readonly Card[] = ['Qc', 'Jh', '9h'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('High Card');
      }
    });

    it('should return Left when insufficient cards', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'Kd'];
      const communityCards: readonly Card[] = []; // 0枚

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InsufficientCards');
      }
    });

    it('should return Left when invalid card format', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'XX' as Card]; // 不正なカード
      const communityCards: readonly Card[] = ['Kc', 'Qh', 'Jh'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidCardFormat');
      }
    });

    it('should work with 7 cards (5 community cards)', () => {
      const holeCards: readonly [Card, Card] = ['Ac', 'Kd'];
      const communityCards: readonly Card[] = ['Qc', 'Jh', 'Th', '9h', '8s'];

      const result = evaluateHand(holeCards, communityCards);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.rank).toContain('Straight');
        expect(result.right.description).toBeTruthy();
      }
    });
  });

  describe('compareHands', () => {
    it('should return 1 when hand1 wins', () => {
      const hand1: HandEvaluation = {
        rank: 'Straight Flush',
        description: 'Nine high straight flush',
        value: 9000,
      };
      const hand2: HandEvaluation = {
        rank: 'Four of a Kind',
        description: 'Four aces',
        value: 8000,
      };

      const result = compareHands(hand1, hand2);
      expect(result).toBe(1);
    });

    it('should return -1 when hand2 wins', () => {
      const hand1: HandEvaluation = {
        rank: 'Two Pair',
        description: 'Aces and Kings',
        value: 3000,
      };
      const hand2: HandEvaluation = {
        rank: 'Three of a Kind',
        description: 'Three Queens',
        value: 4000,
      };

      const result = compareHands(hand1, hand2);
      expect(result).toBe(-1);
    });

    it('should return 0 when hands are equal', () => {
      const hand1: HandEvaluation = {
        rank: 'Flush',
        description: 'Ace high flush',
        value: 6000,
      };
      const hand2: HandEvaluation = {
        rank: 'Flush',
        description: 'Ace high flush',
        value: 6000,
      };

      const result = compareHands(hand1, hand2);
      expect(result).toBe(0);
    });

    it('should compare hands with same rank but different kickers', () => {
      const holeCards1: readonly [Card, Card] = ['Ac', 'Kd'];
      const holeCards2: readonly [Card, Card] = ['Ac', 'Qd'];
      const communityCards: readonly Card[] = ['As', '7h', '5h', '3h', '2s'];

      const result1 = evaluateHand(holeCards1, communityCards);
      const result2 = evaluateHand(holeCards2, communityCards);

      expect(E.isRight(result1)).toBe(true);
      expect(E.isRight(result2)).toBe(true);

      if (E.isRight(result1) && E.isRight(result2)) {
        const comparison = compareHands(result1.right, result2.right);
        // Both have Pair of Aces, but hand1 has K kicker vs hand2's Q kicker
        expect(comparison).toBe(1); // hand1 (with K kicker) should win
      }
    });
  });

  describe('sortHandsByStrength', () => {
    it('should sort hands by strength (strongest first)', () => {
      const weakHand: HandEvaluation = {
        rank: 'High Card',
        description: 'Ace high',
        value: 1000,
      };
      const mediumHand: HandEvaluation = {
        rank: 'Pair',
        description: 'Pair of Aces',
        value: 2000,
      };
      const strongHand: HandEvaluation = {
        rank: 'Straight Flush',
        description: 'Nine high straight flush',
        value: 9000,
      };

      const hands = [weakHand, strongHand, mediumHand];
      const sorted = sortHandsByStrength(hands);

      expect(sorted[0]).toBe(strongHand);
      expect(sorted[1]).toBe(mediumHand);
      expect(sorted[2]).toBe(weakHand);
    });

    it('should handle empty array', () => {
      const hands: HandEvaluation[] = [];
      const sorted = sortHandsByStrength(hands);

      expect(sorted).toEqual([]);
    });

    it('should handle single hand', () => {
      const hand: HandEvaluation = {
        rank: 'Flush',
        description: 'Ace high flush',
        value: 6000,
      };

      const sorted = sortHandsByStrength([hand]);

      expect(sorted.length).toBe(1);
      expect(sorted[0]).toBe(hand);
    });

    it('should handle identical hands', () => {
      const hand1: HandEvaluation = {
        rank: 'Flush',
        description: 'Ace high flush',
        value: 6000,
      };
      const hand2: HandEvaluation = {
        rank: 'Flush',
        description: 'Ace high flush',
        value: 6000,
      };
      const hand3: HandEvaluation = {
        rank: 'Flush',
        description: 'Ace high flush',
        value: 6000,
      };

      const sorted = sortHandsByStrength([hand1, hand2, hand3]);

      expect(sorted.length).toBe(3);
      // All hands have equal value, order should be stable
    });

    it('should not mutate original array', () => {
      const hand1: HandEvaluation = {
        rank: 'High Card',
        description: 'Ace high',
        value: 1000,
      };
      const hand2: HandEvaluation = {
        rank: 'Straight Flush',
        description: 'Nine high straight flush',
        value: 9000,
      };

      const hands = [hand1, hand2];
      const originalFirstHand = hands[0];

      sortHandsByStrength(hands);

      // Original array should not be mutated
      expect(hands[0]).toBe(originalFirstHand);
      expect(hands[0]).toBe(hand1);
    });
  });
});
