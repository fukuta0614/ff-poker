/**
 * Deck関連の純粋関数
 */

import type { Card } from './types';
import { RANKS, SUITS } from './constants';

/**
 * 新しい52枚のカードデッキを生成
 */
export const createDeck = (): readonly Card[] => {
  const ranks = RANKS;
  const suits = SUITS;

  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(`${rank}${suit}` as Card);
    }
  }

  return deck;
};

/**
 * デッキをシャッフル（Fisher-Yates アルゴリズム）
 * 元のデッキは変更せず、新しいシャッフルされたデッキを返す
 */
export const shuffleDeck = (deck: readonly Card[]): readonly Card[] => {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

/**
 * デッキから指定枚数のカードを配る
 * 元のデッキは変更せず、配られたカードと残りのデッキを返す
 */
export const dealCards = (
  deck: readonly Card[],
  count: number
): { readonly dealtCards: readonly Card[]; readonly remainingDeck: readonly Card[] } => {
  if (count < 0) {
    throw new Error('Invalid card count: count must be non-negative');
  }

  if (count > deck.length) {
    throw new Error(
      `Insufficient cards: requested ${count}, but only ${deck.length} available`
    );
  }

  return {
    dealtCards: deck.slice(0, count),
    remainingDeck: deck.slice(count),
  };
};

/**
 * カードが有効な形式かチェック
 * @param card - チェックするカード文字列
 * @returns カードが有効な形式であればtrue
 */
export const isValidCard = (card: string): card is Card => {
  if (card.length !== 2) {
    return false;
  }

  const rank = card[0];
  const suit = card[1];

  return RANKS.includes(rank as typeof RANKS[number]) && SUITS.includes(suit as typeof SUITS[number]);
};
