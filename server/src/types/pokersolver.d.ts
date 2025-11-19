/**
 * pokersolver ライブラリの型定義
 */

declare module 'pokersolver' {
  export class Hand {
    name: string;
    descr: string;
    rank: number;
    cards: unknown[];

    static solve(cards: string[]): Hand;
    static winners(hands: Hand[]): Hand[];
    compare(hand: Hand): number;
  }
}
