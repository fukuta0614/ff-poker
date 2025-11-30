/**
 * ステージ遷移関数のテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  advanceStage,
  dealFlop,
  dealTurn,
  dealRiver,
} from '../../src/engine/stage';
import type { GameState, Player, PlayerState, PlayerId } from '../../src/engine/types';
import { createDeck } from '../../src/engine/deck';

// テスト用のヘルパー関数
const createTestPlayer = (id: PlayerId, chips: number, seat: number): Player => ({
  id,
  name: `Player${id}`,
  chips,
  seat,
});

const createTestPlayerState = (
  bet: number = 0,
  cumulativeBet: number = 0,
  isFolded: boolean = false
): PlayerState => ({
  bet,
  cumulativeBet,
  isFolded,
  hasActed: true,
  hand: O.none,
});

const createTestGameState = (
  stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended',
  deck: readonly string[],
  communityCards: readonly string[] = [],
  dealerIndex: number = 0
): GameState => ({
  players: new Map([
    ['p1', createTestPlayer('p1', 950, 0)],
    ['p2', createTestPlayer('p2', 950, 1)],
  ]),
  playerStates: new Map([
    ['p1', createTestPlayerState(50, 50)],
    ['p2', createTestPlayerState(50, 50)],
  ]),
  stage,
  dealerIndex,
  currentBettorIndex: 0,
  deck,
  communityCards,
  currentBet: 50,
  minRaiseAmount: 10,
  lastAggressorId: O.none,
  pots: [],
  totalPot: 100,
});

describe('Stage Transitions', () => {
  describe('dealFlop', () => {
    it('should deal 3 community cards and burn 1', () => {
      const deck = createDeck();
      const state = createTestGameState('preflop', deck);

      const result = dealFlop(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.communityCards.length).toBe(3);
        expect(newState.deck.length).toBe(48); // 52 - 1 burn - 3 flop
        expect(newState.stage).toBe('flop');
      }
    });

    it('should reset bets for new street', () => {
      const deck = createDeck();
      const state = createTestGameState('preflop', deck);

      const result = dealFlop(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        newState.playerStates.forEach((playerState) => {
          expect(playerState.bet).toBe(0);
          expect(playerState.hasActed).toBe(false);
        });
        expect(newState.currentBet).toBe(0);
      }
    });

    it('should set first bettor to small blind position', () => {
      const deck = createDeck();
      const state = createTestGameState('preflop', deck, [], 0);

      const result = dealFlop(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.currentBettorIndex).toBe(1); // SB is dealer + 1
      }
    });

    it('should return Left when insufficient cards', () => {
      const deck = ['As', 'Kh', 'Qd']; // Only 3 cards
      const state = createTestGameState('preflop', deck);

      const result = dealFlop(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InsufficientCards');
      }
    });

    it('should return Left when not in preflop stage', () => {
      const deck = createDeck();
      const state = createTestGameState('flop', deck);

      const result = dealFlop(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidStage');
      }
    });
  });

  describe('dealTurn', () => {
    it('should deal 1 community card and burn 1', () => {
      const deck = createDeck();
      const state = createTestGameState('flop', deck, ['As', 'Kh', 'Qd']);

      const result = dealTurn(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.communityCards.length).toBe(4);
        expect(newState.deck.length).toBe(50); // 52 - 1 burn - 1 turn
        expect(newState.stage).toBe('turn');
      }
    });

    it('should reset bets for new street', () => {
      const deck = createDeck();
      const state = createTestGameState('flop', deck, ['As', 'Kh', 'Qd']);

      const result = dealTurn(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        newState.playerStates.forEach((playerState) => {
          expect(playerState.bet).toBe(0);
          expect(playerState.hasActed).toBe(false);
        });
        expect(newState.currentBet).toBe(0);
      }
    });

    it('should return Left when insufficient cards', () => {
      const deck = ['Jc']; // Only 1 card
      const state = createTestGameState('flop', deck, ['As', 'Kh', 'Qd']);

      const result = dealTurn(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InsufficientCards');
      }
    });

    it('should return Left when not in flop stage', () => {
      const deck = createDeck();
      const state = createTestGameState('preflop', deck);

      const result = dealTurn(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidStage');
      }
    });
  });

  describe('dealRiver', () => {
    it('should deal 1 community card and burn 1', () => {
      const deck = createDeck();
      const state = createTestGameState('turn', deck, ['As', 'Kh', 'Qd', 'Jc']);

      const result = dealRiver(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.communityCards.length).toBe(5);
        expect(newState.deck.length).toBe(50); // 52 - 1 burn - 1 river
        expect(newState.stage).toBe('river');
      }
    });

    it('should reset bets for new street', () => {
      const deck = createDeck();
      const state = createTestGameState('turn', deck, ['As', 'Kh', 'Qd', 'Jc']);

      const result = dealRiver(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        newState.playerStates.forEach((playerState) => {
          expect(playerState.bet).toBe(0);
          expect(playerState.hasActed).toBe(false);
        });
        expect(newState.currentBet).toBe(0);
      }
    });

    it('should return Left when insufficient cards', () => {
      const deck = ['Tc']; // Only 1 card
      const state = createTestGameState('turn', deck, ['As', 'Kh', 'Qd', 'Jc']);

      const result = dealRiver(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InsufficientCards');
      }
    });

    it('should return Left when not in turn stage', () => {
      const deck = createDeck();
      const state = createTestGameState('flop', deck, ['As', 'Kh', 'Qd']);

      const result = dealRiver(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidStage');
      }
    });
  });

  describe('advanceStage', () => {
    it('should advance from preflop to flop', () => {
      const deck = createDeck();
      const state = createTestGameState('preflop', deck);

      const result = advanceStage(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.stage).toBe('flop');
        expect(newState.communityCards.length).toBe(3);
      }
    });

    it('should advance from flop to turn', () => {
      const deck = createDeck();
      const state = createTestGameState('flop', deck, ['As', 'Kh', 'Qd']);

      const result = advanceStage(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.stage).toBe('turn');
        expect(newState.communityCards.length).toBe(4);
      }
    });

    it('should advance from turn to river', () => {
      const deck = createDeck();
      const state = createTestGameState('turn', deck, ['As', 'Kh', 'Qd', 'Jc']);

      const result = advanceStage(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.stage).toBe('river');
        expect(newState.communityCards.length).toBe(5);
      }
    });

    it('should advance from river to showdown', () => {
      const deck = createDeck();
      const state = createTestGameState('river', deck, ['As', 'Kh', 'Qd', 'Jc', 'Tc']);

      const result = advanceStage(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.stage).toBe('showdown');
      }
    });

    it('should return Left when advancing from showdown', () => {
      const deck = createDeck();
      const state = createTestGameState('showdown', deck, ['As', 'Kh', 'Qd', 'Jc', 'Tc']);

      const result = advanceStage(state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidStage');
      }
    });
  });

  // === ヘッズアップのポストフロップベッター順序テスト ===
  describe('Heads-up post-flop betting order', () => {
    // ヘッズアップ用のテスト状態作成
    const createHeadsUpTestState = (
      stage: 'preflop' | 'flop' | 'turn' | 'river',
      dealerIndex: number
    ): GameState => ({
      players: new Map([
        ['p1', createTestPlayer('p1', 950, 0)],
        ['p2', createTestPlayer('p2', 950, 1)],
      ]),
      playerStates: new Map([
        ['p1', createTestPlayerState(20, 20)],
        ['p2', createTestPlayerState(20, 20)],
      ]),
      stage,
      dealerIndex,
      currentBettorIndex: dealerIndex, // プリフロップ
      deck: createDeck(),
      communityCards: stage === 'preflop' ? [] : ['As', 'Kh', 'Qd'],
      currentBet: 20,
      minRaiseAmount: 20,
      lastAggressorId: O.none,
      pots: [],
      totalPot: 40,
    });

    describe('dealFlop in heads-up', () => {
      it('should set BB (non-dealer) as first bettor when dealer=0', () => {
        const state = createHeadsUpTestState('preflop', 0);
        const result = dealFlop(state);

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          const newState = result.right;
          // ヘッズアップ: dealer=0(SB), p2=1(BB) なのでBBが先
          expect(newState.currentBettorIndex).toBe(1);
        }
      });

      it('should set BB (non-dealer) as first bettor when dealer=1', () => {
        const state = createHeadsUpTestState('preflop', 1);
        const result = dealFlop(state);

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          const newState = result.right;
          // ヘッズアップ: dealer=1(SB), p1=0(BB) なのでBBが先
          expect(newState.currentBettorIndex).toBe(0);
        }
      });
    });

    describe('dealTurn in heads-up', () => {
      it('should set BB (non-dealer) as first bettor when dealer=0', () => {
        const state = createHeadsUpTestState('flop', 0);
        const result = dealTurn(state);

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          const newState = result.right;
          expect(newState.currentBettorIndex).toBe(1);
        }
      });

      it('should set BB (non-dealer) as first bettor when dealer=1', () => {
        const state = createHeadsUpTestState('flop', 1);
        const result = dealTurn(state);

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          const newState = result.right;
          expect(newState.currentBettorIndex).toBe(0);
        }
      });
    });

    describe('dealRiver in heads-up', () => {
      it('should set BB (non-dealer) as first bettor when dealer=0', () => {
        const state = { ...createHeadsUpTestState('turn', 0), communityCards: ['As', 'Kh', 'Qd', 'Jc'] };
        const result = dealRiver(state);

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          const newState = result.right;
          expect(newState.currentBettorIndex).toBe(1);
        }
      });

      it('should set BB (non-dealer) as first bettor when dealer=1', () => {
        const state = { ...createHeadsUpTestState('turn', 1), communityCards: ['As', 'Kh', 'Qd', 'Jc'] };
        const result = dealRiver(state);

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          const newState = result.right;
          expect(newState.currentBettorIndex).toBe(0);
        }
      });
    });
  });

  // === 3人以上のポストフロップベッター順序テスト ===
  describe('Multi-player post-flop betting order', () => {
    const createMultiPlayerTestState = (
      stage: 'preflop' | 'flop' | 'turn' | 'river',
      dealerIndex: number
    ): GameState => ({
      players: new Map([
        ['p1', createTestPlayer('p1', 950, 0)],
        ['p2', createTestPlayer('p2', 950, 1)],
        ['p3', createTestPlayer('p3', 950, 2)],
      ]),
      playerStates: new Map([
        ['p1', createTestPlayerState(20, 20)],
        ['p2', createTestPlayerState(20, 20)],
        ['p3', createTestPlayerState(20, 20)],
      ]),
      stage,
      dealerIndex,
      currentBettorIndex: 0,
      deck: createDeck(),
      communityCards: stage === 'preflop' ? [] : ['As', 'Kh', 'Qd'],
      currentBet: 20,
      minRaiseAmount: 20,
      lastAggressorId: O.none,
      pots: [],
      totalPot: 60,
    });

    it('should set SB as first bettor on flop with dealer=0', () => {
      const state = createMultiPlayerTestState('preflop', 0);
      const result = dealFlop(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        // 3人以上: SB = dealer + 1 = 1
        expect(newState.currentBettorIndex).toBe(1);
      }
    });

    it('should set SB as first bettor on turn with dealer=0', () => {
      const state = createMultiPlayerTestState('flop', 0);
      const result = dealTurn(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.currentBettorIndex).toBe(1);
      }
    });

    it('should set SB as first bettor on river with dealer=0', () => {
      const state = { ...createMultiPlayerTestState('turn', 0), communityCards: ['As', 'Kh', 'Qd', 'Jc'] };
      const result = dealRiver(state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.currentBettorIndex).toBe(1);
      }
    });
  });
});
