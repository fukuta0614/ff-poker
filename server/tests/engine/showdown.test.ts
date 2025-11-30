/**
 * ショーダウン処理のテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  performShowdown,
  determineWinners,
  distributeWinnings,
} from '../../src/engine/showdown';
import type { GameState, Player, PlayerState, Pot, WinnerInfo } from '../../src/engine/types';

// テストヘルパー関数
function createTestGameState(overrides?: Partial<GameState>): GameState {
  const players = new Map<string, Player>([
    ['p1', { id: 'p1', name: 'Player 1', chips: 900, seat: 0 }],
    ['p2', { id: 'p2', name: 'Player 2', chips: 950, seat: 1 }],
    ['p3', { id: 'p3', name: 'Player 3', chips: 980, seat: 2 }],
  ]);

  const playerStates = new Map<string, PlayerState>([
    ['p1', {
      bet: 0,
      cumulativeBet: 100,
      isFolded: false,
      hasActed: true,
      hand: O.some(['As', 'Ah'] as const), // Four Aces (strongest)
    }],
    ['p2', {
      bet: 0,
      cumulativeBet: 50,
      isFolded: false,
      hasActed: true,
      hand: O.some(['Kh', 'Kd'] as const), // Full House K-A
    }],
    ['p3', {
      bet: 0,
      cumulativeBet: 20,
      isFolded: false,
      hasActed: true,
      hand: O.some(['7c', '7d'] as const), // Full House 7-A
    }],
  ]);

  return {
    players,
    playerStates,
    stage: 'showdown',
    dealerIndex: 0,
    currentBettorIndex: 1,
    deck: [],
    communityCards: ['Ac', 'Ad', 'Ks', '7h', '2s'], // Board: A, A, K, 7, 2
    currentBet: 0,
    minRaiseAmount: 20,
    lastAggressorId: O.none,
    pots: [],
    totalPot: 170,
    ...overrides,
  };
}

describe('showdown', () => {
  describe('determineWinners', () => {
    it('should determine single winner with best hand', () => {
      // p1 has Four Aces (strongest)
      // p2 has Full House K-A
      // p3 has Full House 7-A
      const state = createTestGameState();
      const pots: Pot[] = [
        {
          amount: 170,
          eligiblePlayers: new Set(['p1', 'p2', 'p3']),
        },
      ];

      const result = determineWinners(state, pots);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toHaveLength(1);
        // p1 should win with Four Aces
        expect(result.right[0].playerId).toBe('p1');
        expect(result.right[0].amount).toBe(170);
        expect(result.right[0].potIndex).toBe(0);
      }
    });

    it('should handle split pot with equal hands', () => {
      const players = new Map<string, Player>([
        ['p1', { id: 'p1', name: 'Player 1', chips: 900, seat: 0 }],
        ['p2', { id: 'p2', name: 'Player 2', chips: 900, seat: 1 }],
      ]);

      const playerStates = new Map<string, PlayerState>([
        ['p1', {
          bet: 0,
          cumulativeBet: 100,
          isFolded: false,
          hasActed: true,
          hand: O.some(['As', 'Kd'] as const), // Both have same hand
        }],
        ['p2', {
          bet: 0,
          cumulativeBet: 100,
          isFolded: false,
          hasActed: true,
          hand: O.some(['Ah', 'Kc'] as const), // Both have same hand
        }],
      ]);

      const state: GameState = {
        ...createTestGameState(),
        players,
        playerStates,
        communityCards: ['Qh', 'Jh', 'Th', '9c', '8c'], // A-K-Q-J-T straight for both
        totalPot: 200,
      };

      const pots: Pot[] = [
        {
          amount: 200,
          eligiblePlayers: new Set(['p1', 'p2']),
        },
      ];

      const result = determineWinners(state, pots);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right).toHaveLength(2);
        expect(result.right[0].amount).toBe(100);
        expect(result.right[1].amount).toBe(100);
      }
    });

    it('should handle multiple side pots', () => {
      const players = new Map<string, Player>([
        ['p1', { id: 'p1', name: 'Player 1', chips: 980, seat: 0 }],
        ['p2', { id: 'p2', name: 'Player 2', chips: 950, seat: 1 }],
        ['p3', { id: 'p3', name: 'Player 3', chips: 900, seat: 2 }],
      ]);

      const playerStates = new Map<string, PlayerState>([
        ['p1', {
          bet: 0,
          cumulativeBet: 20, // all-in early
          isFolded: false,
          hasActed: true,
          hand: O.some(['2c', '3d'] as const), // Weakest - high card Q
        }],
        ['p2', {
          bet: 0,
          cumulativeBet: 50,
          isFolded: false,
          hasActed: true,
          hand: O.some(['As', 'Ah'] as const), // Strongest - Four Aces
        }],
        ['p3', {
          bet: 0,
          cumulativeBet: 100,
          isFolded: false,
          hasActed: true,
          hand: O.some(['Kc', 'Kd'] as const), // Medium - Full House A-K
        }],
      ]);

      const state: GameState = {
        ...createTestGameState(),
        players,
        playerStates,
        communityCards: ['Ac', 'Ad', 'Kh', '7s', '5c'], // Board: A, A, K, 7, 5
        totalPot: 170,
      };

      const pots: Pot[] = [
        {
          amount: 60, // p1, p2, p3 (20 each)
          eligiblePlayers: new Set(['p1', 'p2', 'p3']),
        },
        {
          amount: 60, // p2, p3 (30 each)
          eligiblePlayers: new Set(['p2', 'p3']),
        },
        {
          amount: 50, // p3 only
          eligiblePlayers: new Set(['p3']),
        },
      ];

      const result = determineWinners(state, pots);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // p2 wins first side pot (60)
        const pot0Winner = result.right.find(w => w.potIndex === 0);
        expect(pot0Winner?.playerId).toBe('p2');
        expect(pot0Winner?.amount).toBe(60);

        // p2 wins second side pot (60)
        const pot1Winner = result.right.find(w => w.potIndex === 1);
        expect(pot1Winner?.playerId).toBe('p2');
        expect(pot1Winner?.amount).toBe(60);

        // p3 wins main pot (50)
        const pot2Winner = result.right.find(w => w.potIndex === 2);
        expect(pot2Winner?.playerId).toBe('p3');
        expect(pot2Winner?.amount).toBe(50);
      }
    });

    it('should return Left when player has no hand', () => {
      const playerStates = new Map<string, PlayerState>([
        ['p1', {
          bet: 0,
          cumulativeBet: 100,
          isFolded: false,
          hasActed: true,
          hand: O.none, // No hand!
        }],
      ]);

      const state: GameState = {
        ...createTestGameState(),
        playerStates,
      };

      const pots: Pot[] = [
        {
          amount: 100,
          eligiblePlayers: new Set(['p1']),
        },
      ];

      const result = determineWinners(state, pots);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('MissingHand');
      }
    });
  });

  describe('distributeWinnings', () => {
    it('should add winnings to player chips', () => {
      const state = createTestGameState();
      const winners: WinnerInfo[] = [
        {
          playerId: 'p1',
          hand: ['As', 'Ks'],
          evaluation: {
            rank: 'Two Pair',
            description: 'Aces and Kings',
            value: 3000,
          },
          potIndex: 0,
          amount: 170,
        },
      ];

      const newState = distributeWinnings(state, winners);

      const p1 = newState.players.get('p1');
      expect(p1?.chips).toBe(1070); // 900 + 170
    });

    it('should handle multiple winners (split pot)', () => {
      const state = createTestGameState();
      const winners: WinnerInfo[] = [
        {
          playerId: 'p1',
          hand: ['As', 'Kh'],
          evaluation: {
            rank: 'Straight Flush',
            description: 'Queen high',
            value: 9000,
          },
          potIndex: 0,
          amount: 85,
        },
        {
          playerId: 'p2',
          hand: ['Ad', 'Kc'],
          evaluation: {
            rank: 'Straight Flush',
            description: 'Queen high',
            value: 9000,
          },
          potIndex: 0,
          amount: 85,
        },
      ];

      const newState = distributeWinnings(state, winners);

      const p1 = newState.players.get('p1');
      const p2 = newState.players.get('p2');
      expect(p1?.chips).toBe(985); // 900 + 85
      expect(p2?.chips).toBe(1035); // 950 + 85
    });

    it('should not mutate original state', () => {
      const state = createTestGameState();
      const originalP1Chips = state.players.get('p1')?.chips;

      const winners: WinnerInfo[] = [
        {
          playerId: 'p1',
          hand: ['As', 'Ks'],
          evaluation: {
            rank: 'Two Pair',
            description: 'Aces and Kings',
            value: 3000,
          },
          potIndex: 0,
          amount: 170,
        },
      ];

      distributeWinnings(state, winners);

      // Original state should not change
      expect(state.players.get('p1')?.chips).toBe(originalP1Chips);
    });
  });

  describe('performShowdown', () => {
    it('should perform complete showdown and return result', () => {
      const state = createTestGameState({
        pots: [
          {
            amount: 170,
            eligiblePlayers: new Set(['p1', 'p2', 'p3']),
          },
        ],
      });

      const result = performShowdown(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.winners).toBeDefined();
        expect(result.right.winners.length).toBeGreaterThan(0);
        expect(result.right.pots).toBeDefined();
        expect(result.right.finalState.stage).toBe('ended');

        // Winner should have increased chips
        const winner = result.right.winners[0];
        const winnerPlayer = result.right.finalState.players.get(winner.playerId);
        expect(winnerPlayer?.chips).toBeGreaterThan(0);
      }
    });

    it('should return Left when stage is not showdown or ended', () => {
      const state = createTestGameState({
        stage: 'flop',
      });

      const result = performShowdown(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidStage');
      }
    });

    it('should handle all-in scenarios correctly', () => {
      const players = new Map<string, Player>([
        ['p1', { id: 'p1', name: 'Player 1', chips: 980, seat: 0 }],
        ['p2', { id: 'p2', name: 'Player 2', chips: 0, seat: 1 }], // all-in
      ]);

      const playerStates = new Map<string, PlayerState>([
        ['p1', {
          bet: 0,
          cumulativeBet: 100,
          isFolded: false,
          hasActed: true,
          hand: O.some(['2c', '3d'] as const), // Weak hand - pair of 7s
        }],
        ['p2', {
          bet: 0,
          cumulativeBet: 20,
          isFolded: false,
          hasActed: true,
          hand: O.some(['Ah', 'Kh'] as const), // Strong hand - two pair A and K
        }],
      ]);

      const state: GameState = {
        ...createTestGameState(),
        players,
        playerStates,
        communityCards: ['Ac', 'Kc', 'Qh', '7h', '7s'], // Board: A, K, Q, 7, 7
        totalPot: 120,
        pots: [
          {
            amount: 40,
            eligiblePlayers: new Set(['p1', 'p2']),
          },
          {
            amount: 80,
            eligiblePlayers: new Set(['p1']),
          },
        ],
        stage: 'showdown',
      };

      const result = performShowdown(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // p2 should win the main pot (40) with better hand
        const mainPotWinner = result.right.winners.find(w => w.potIndex === 0);
        expect(mainPotWinner?.playerId).toBe('p2');

        // p1 should get the side pot (80) as only eligible player
        const sidePotWinner = result.right.winners.find(w => w.potIndex === 1);
        expect(sidePotWinner?.playerId).toBe('p1');
      }
    });
  });
});
