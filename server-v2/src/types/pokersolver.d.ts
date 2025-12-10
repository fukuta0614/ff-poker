declare module 'pokersolver' {
  export class Hand {
    static solve(cards: string[], game?: string): Hand;
    winners(hands: Hand[]): Hand[];
    rank: number;
    name: string;
    descr: string;
  }
}
