/**
 * デッキ管理クラス
 * 52枚のトランプカードの生成、シャッフル、配布を管理
 */

import { RANKS, SUITS } from '../utils/constants';

export class Deck {
  private cards: string[];

  constructor() {
    this.cards = this.generateDeck();
  }

  /**
   * 52枚のカードを生成
   * @returns カードの配列（例: ["Ah", "Kd", "2c", ...]）
   */
  private generateDeck(): string[] {
    const deck: string[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push(`${rank}${suit}`);
      }
    }
    return deck;
  }

  /**
   * Fisher-Yates シャッフルアルゴリズムでカードをシャッフル
   */
  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * 指定枚数のカードを配布
   * @param count 配布するカード数
   * @returns 配布されたカードの配列
   * @throws 残りのカードが不足している場合
   */
  public deal(count: number): string[] {
    if (count < 0) {
      throw new Error('Invalid number of cards');
    }

    if (count === 0) {
      return [];
    }

    if (this.cards.length < count) {
      throw new Error('Not enough cards in deck');
    }

    return this.cards.splice(0, count);
  }

  /**
   * デッキの残り枚数を返す
   * @returns 残りのカード数
   */
  public remainingCards(): number {
    return this.cards.length;
  }

  /**
   * デッキの状態をシリアライズ
   * @returns JSON文字列
   */
  public serialize(): string {
    return JSON.stringify(this.cards);
  }

  /**
   * シリアライズされた状態からデッキを復元
   * @param data シリアライズされたJSON文字列
   * @returns 復元されたDeckインスタンス
   */
  public static deserialize(data: string): Deck {
    const deck = new Deck();
    deck.cards = JSON.parse(data);
    return deck;
  }
}
