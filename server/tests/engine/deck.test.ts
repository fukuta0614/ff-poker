/**
 * Deck関連の純粋関数のテスト
 */

import { describe, it, expect } from '@jest/globals';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  isValidCard,
} from '../../src/engine/deck';
import { createRNGState } from '../../src/engine/rng';
import type { Card } from '../../src/engine/types';

describe('Deck Functions', () => {
  describe('createDeck', () => {
    it('should create a deck with 52 cards', () => {
      const deck = createDeck();
      expect(deck.length).toBe(52);
    });

    it('should contain all unique cards', () => {
      const deck = createDeck();
      const uniqueCards = new Set(deck);
      expect(uniqueCards.size).toBe(52);
    });

    it('should contain all ranks (2-A) for each suit', () => {
      const deck = createDeck();
      const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
      const suits = ['h', 'd', 'c', 's'];

      for (const suit of suits) {
        for (const rank of ranks) {
          const card = `${rank}${suit}` as Card;
          expect(deck).toContain(card);
        }
      }
    });

    it('should be a readonly array', () => {
      const deck = createDeck();
      // TypeScript型チェックで readonly を保証
      expect(Array.isArray(deck)).toBe(true);
    });
  });

  describe('shuffleDeck', () => {
    it('should return a deck with 52 cards', () => {
      const deck = createDeck();
      const rngState = createRNGState(12345);
      const result = shuffleDeck(deck, rngState);
      expect(result.shuffledDeck.length).toBe(52);
    });

    it('should contain all the same cards', () => {
      const deck = createDeck();
      const rngState = createRNGState(12345);
      const result = shuffleDeck(deck, rngState);

      const originalSet = new Set(deck);
      const shuffledSet = new Set(result.shuffledDeck);

      expect(shuffledSet.size).toBe(52);
      expect([...shuffledSet].every(card => originalSet.has(card))).toBe(true);
    });

    it('should not mutate the original deck', () => {
      const deck = createDeck();
      const deckCopy = [...deck];
      const rngState = createRNGState(12345);
      shuffleDeck(deck, rngState);

      expect(deck).toEqual(deckCopy);
    });

    it('should produce same order with same RNG seed (deterministic)', () => {
      const deck = createDeck();
      const rngState1 = createRNGState(12345);
      const rngState2 = createRNGState(12345);

      const result1 = shuffleDeck(deck, rngState1);
      const result2 = shuffleDeck(deck, rngState2);

      // 同じシードから同じ順序が生成される（純粋関数）
      expect(result1.shuffledDeck).toEqual(result2.shuffledDeck);
    });

    it('should produce different order with different RNG seed', () => {
      const deck = createDeck();
      const rngState1 = createRNGState(12345);
      const rngState2 = createRNGState(67890);

      const result1 = shuffleDeck(deck, rngState1);
      const result2 = shuffleDeck(deck, rngState2);

      // 異なるシードから異なる順序が生成される
      const isDifferent = result1.shuffledDeck.some((card, i) => card !== result2.shuffledDeck[i]);
      expect(isDifferent).toBe(true);
    });

    it('should return new RNG state', () => {
      const deck = createDeck();
      const rngState = createRNGState(12345);
      const result = shuffleDeck(deck, rngState);

      // RNG状態が更新される
      expect(result.nextRngState.seed).not.toBe(rngState.seed);
    });
  });

  describe('dealCards', () => {
    it('should deal the requested number of cards', () => {
      const deck = createDeck();
      const result = dealCards(deck, 2);

      expect(result.dealtCards.length).toBe(2);
    });

    it('should remove dealt cards from remaining deck', () => {
      const deck = createDeck();
      const result = dealCards(deck, 5);

      expect(result.remainingDeck.length).toBe(47);
      expect(deck.length).toBe(52); // 元のdeckは変更されない
    });

    it('should deal cards from the top of the deck', () => {
      const deck = createDeck();
      const topCards = deck.slice(0, 3);
      const result = dealCards(deck, 3);

      expect(result.dealtCards).toEqual(topCards);
    });

    it('should not mutate the original deck', () => {
      const deck = createDeck();
      const deckCopy = [...deck];
      dealCards(deck, 5);

      expect(deck).toEqual(deckCopy);
    });

    it('should return empty arrays when dealing 0 cards', () => {
      const deck = createDeck();
      const result = dealCards(deck, 0);

      expect(result.dealtCards).toEqual([]);
      expect(result.remainingDeck).toEqual(deck);
    });

    it('should handle dealing all cards', () => {
      const deck = createDeck();
      const result = dealCards(deck, 52);

      expect(result.dealtCards.length).toBe(52);
      expect(result.remainingDeck.length).toBe(0);
    });

    it('should throw error when requesting more cards than available', () => {
      const deck = createDeck();

      expect(() => dealCards(deck, 53)).toThrow('Insufficient cards');
    });

    it('should throw error when count is negative', () => {
      const deck = createDeck();

      expect(() => dealCards(deck, -1)).toThrow('Invalid card count');
    });
  });

  describe('isValidCard', () => {
    it('should return true for valid cards', () => {
      const validCards: Card[] = ['2h', '5d', 'Tc', 'Ks', 'As', '7h', 'Jd', 'Qc'];

      validCards.forEach(card => {
        expect(isValidCard(card)).toBe(true);
      });
    });

    it('should return false for invalid rank', () => {
      const invalidCards = ['1h', 'Xd', 'Bc', '0s'];

      invalidCards.forEach(card => {
        expect(isValidCard(card)).toBe(false);
      });
    });

    it('should return false for invalid suit', () => {
      const invalidCards = ['2x', 'Ae', 'Kf', '5g'];

      invalidCards.forEach(card => {
        expect(isValidCard(card)).toBe(false);
      });
    });

    it('should return false for invalid length', () => {
      const invalidCards = ['2', 'Khs', '', '2hd'];

      invalidCards.forEach(card => {
        expect(isValidCard(card)).toBe(false);
      });
    });

    it('should return false for lowercase suit', () => {
      expect(isValidCard('2H')).toBe(false);
      expect(isValidCard('kh')).toBe(false);
    });
  });
});
