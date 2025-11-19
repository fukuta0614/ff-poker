/**
 * Deck クラスのユニットテスト
 */

import { Deck } from '../../src/game/Deck';

describe('Deck', () => {
  describe('初期化', () => {
    test('52枚のカードで初期化される', () => {
      const deck = new Deck();
      expect(deck.remainingCards()).toBe(52);
    });

    test('すべてのカードがユニーク', () => {
      const deck = new Deck();
      const cards = deck['cards']; // privateアクセス（テスト用）
      const uniqueCards = new Set(cards);
      expect(uniqueCards.size).toBe(52);
    });
  });

  describe('シャッフル', () => {
    test('シャッフル後もカード数は52枚', () => {
      const deck = new Deck();
      deck.shuffle();
      expect(deck.remainingCards()).toBe(52);
    });

    test('シャッフルでカードの順序が変わる', () => {
      const deck1 = new Deck();
      const deck2 = new Deck();

      // deck1のみシャッフル
      deck1.shuffle();

      // 最初の10枚を比較（高確率で異なるはず）
      const cards1 = [];
      const cards2 = [];

      for (let i = 0; i < 10; i++) {
        cards1.push(deck1.deal(1)[0]);
        cards2.push(deck2.deal(1)[0]);
      }

      expect(cards1).not.toEqual(cards2);
    });
  });

  describe('カード配布', () => {
    test('指定した枚数のカードを配布できる', () => {
      const deck = new Deck();
      const cards = deck.deal(5);
      expect(cards).toHaveLength(5);
      expect(deck.remainingCards()).toBe(47);
    });

    test('配布したカードは削除される', () => {
      const deck = new Deck();
      const firstCard = deck.deal(1)[0];
      const remainingCards = deck['cards'];
      expect(remainingCards).not.toContain(firstCard);
    });

    test('残りのカードがない場合エラーをスロー', () => {
      const deck = new Deck();
      deck.deal(52); // 全て配布
      expect(() => deck.deal(1)).toThrow('Not enough cards in deck');
    });

    test('0枚を配布する場合は空配列を返す', () => {
      const deck = new Deck();
      const cards = deck.deal(0);
      expect(cards).toEqual([]);
      expect(deck.remainingCards()).toBe(52);
    });

    test('負の数を指定した場合エラーをスロー', () => {
      const deck = new Deck();
      expect(() => deck.deal(-1)).toThrow('Invalid number of cards');
    });
  });

  describe('シリアライズ/デシリアライズ', () => {
    test('デッキの状態をシリアライズできる', () => {
      const deck = new Deck();
      deck.shuffle();
      deck.deal(5);

      const serialized = deck.serialize();
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0);
    });

    test('シリアライズした状態から復元できる', () => {
      const deck1 = new Deck();
      deck1.shuffle();
      deck1.deal(5); // 5枚配布

      const serialized = deck1.serialize();
      const deck2 = Deck.deserialize(serialized);

      // deck2から次の3枚を配布
      const cards2 = deck2.deal(3);
      // deck1から同じ3枚を配布
      const cards1 = deck1.deal(3);

      expect(cards2).toEqual(cards1); // 同じ順序で配布される
      expect(deck2.remainingCards()).toBe(deck1.remainingCards());
    });
  });

  describe('カードフォーマット', () => {
    test('カードは2文字の文字列（例: "Ah", "2c"）', () => {
      const deck = new Deck();
      const cards = deck.deal(52);

      cards.forEach((card) => {
        expect(card).toMatch(/^[2-9TJQKA][hdcs]$/);
      });
    });

    test('すべてのスートが含まれる', () => {
      const deck = new Deck();
      const cards = deck.deal(52);

      const suits = new Set(cards.map((card) => card[1]));
      expect(suits).toContain('h'); // hearts
      expect(suits).toContain('d'); // diamonds
      expect(suits).toContain('c'); // clubs
      expect(suits).toContain('s'); // spades
    });

    test('各スートに13枚のカードがある', () => {
      const deck = new Deck();
      const cards = deck.deal(52);

      const suitCounts = {
        h: 0,
        d: 0,
        c: 0,
        s: 0,
      };

      cards.forEach((card) => {
        const suit = card[1] as 'h' | 'd' | 'c' | 's';
        suitCounts[suit]++;
      });

      expect(suitCounts.h).toBe(13);
      expect(suitCounts.d).toBe(13);
      expect(suitCounts.c).toBe(13);
      expect(suitCounts.s).toBe(13);
    });
  });

  describe('エッジケース', () => {
    test('複数のデッキインスタンスは独立している', () => {
      const deck1 = new Deck();
      const deck2 = new Deck();

      deck1.deal(10);

      expect(deck1.remainingCards()).toBe(42);
      expect(deck2.remainingCards()).toBe(52);
    });
  });
});
