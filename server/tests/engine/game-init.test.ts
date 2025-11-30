/**
 * ゲーム初期化関数のテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  initializeRound,
  collectBlinds,
  dealHoleCards,
  resetForNewStreet,
  advanceBettor,
} from '../../src/engine/game-init';
import type { GameState, Player, PlayerId } from '../../src/engine/types';
import { createDeck, shuffleDeck } from '../../src/engine/deck';

// テスト用のヘルパー関数
const createTestPlayer = (id: PlayerId, chips: number, seat: number): Player => ({
  id,
  name: `Player${id}`,
  chips,
  seat,
});

describe('Game Initialization', () => {
  describe('initializeRound', () => {
    it('should initialize a new round with correct state', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const result = initializeRound(players, 0, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const state = result.right;
        expect(state.players.size).toBe(3);
        expect(state.playerStates.size).toBe(3);
        expect(state.stage).toBe('preflop');
        expect(state.dealerIndex).toBe(0);
        expect(state.deck.length).toBe(46); // 52 - 6 hole cards
        expect(state.communityCards.length).toBe(0);
        expect(state.minRaiseAmount).toBe(20); // Big blind
      }
    });

    it('should deal 2 hole cards to each player', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
      ];

      const result = initializeRound(players, 0, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const state = result.right;

        state.players.forEach((player) => {
          const playerState = state.playerStates.get(player.id);
          expect(playerState).toBeDefined();
          if (playerState) {
            expect(O.isSome(playerState.hand)).toBe(true);
            if (O.isSome(playerState.hand)) {
              expect(playerState.hand.value.length).toBe(2);
            }
          }
        });
      }
    });

    it('should collect blinds correctly', () => {
      const players = [
        createTestPlayer('p1', 1000, 0), // Dealer
        createTestPlayer('p2', 1000, 1), // Small blind
        createTestPlayer('p3', 1000, 2), // Big blind
      ];

      const result = initializeRound(players, 0, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const state = result.right;

        // Small blind (p2)
        expect(state.players.get('p2')?.chips).toBe(990);
        expect(state.playerStates.get('p2')?.bet).toBe(10);
        expect(state.playerStates.get('p2')?.cumulativeBet).toBe(10);

        // Big blind (p3)
        expect(state.players.get('p3')?.chips).toBe(980);
        expect(state.playerStates.get('p3')?.bet).toBe(20);
        expect(state.playerStates.get('p3')?.cumulativeBet).toBe(20);

        // Current bet should be big blind
        expect(state.currentBet).toBe(20);
        expect(state.totalPot).toBe(30); // 10 + 20
      }
    });

    it('should set current bettor to first player after big blind', () => {
      const players = [
        createTestPlayer('p1', 1000, 0), // Dealer
        createTestPlayer('p2', 1000, 1), // Small blind
        createTestPlayer('p3', 1000, 2), // Big blind
        createTestPlayer('p4', 1000, 3), // First to act
      ];

      const result = initializeRound(players, 0, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const state = result.right;
        expect(state.currentBettorIndex).toBe(3); // p4
      }
    });

    it('should handle heads-up correctly (2 players)', () => {
      const players = [
        createTestPlayer('p1', 1000, 0), // Dealer + Small blind
        createTestPlayer('p2', 1000, 1), // Big blind
      ];

      const result = initializeRound(players, 0, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const state = result.right;

        // In heads-up, dealer posts small blind
        expect(state.players.get('p1')?.chips).toBe(990);
        expect(state.playerStates.get('p1')?.bet).toBe(10);

        // Other player posts big blind
        expect(state.players.get('p2')?.chips).toBe(980);
        expect(state.playerStates.get('p2')?.bet).toBe(20);

        // Dealer acts first in heads-up preflop
        expect(state.currentBettorIndex).toBe(0);
      }
    });

    it('should return Left when less than 2 players', () => {
      const players = [createTestPlayer('p1', 1000, 0)];

      const result = initializeRound(players, 0, 10, 20);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidAction');
      }
    });

    it('should handle all-in on blinds', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 5, 1), // Not enough for small blind
        createTestPlayer('p3', 15, 2), // Not enough for big blind
      ];

      const result = initializeRound(players, 0, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const state = result.right;

        // p2 goes all-in for 5 (instead of 10)
        expect(state.players.get('p2')?.chips).toBe(0);
        expect(state.playerStates.get('p2')?.bet).toBe(5);

        // p3 goes all-in for 15 (instead of 20)
        expect(state.players.get('p3')?.chips).toBe(0);
        expect(state.playerStates.get('p3')?.bet).toBe(15);
      }
    });
  });

  describe('collectBlinds', () => {
    it('should collect blinds from correct positions', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);

      const result = collectBlinds(players, 0, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const { players: newPlayers, playerStates } = result.right;

        expect(newPlayers.get('p2')?.chips).toBe(990);
        expect(playerStates.get('p2')?.bet).toBe(10);

        expect(newPlayers.get('p3')?.chips).toBe(980);
        expect(playerStates.get('p3')?.bet).toBe(20);
      }
    });

    it('should wrap around for blinds', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);

      // Dealer at position 2
      const result = collectBlinds(players, 2, 10, 20);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const { players: newPlayers, playerStates } = result.right;

        // Small blind: (2 + 1) % 3 = 0 (p1)
        expect(newPlayers.get('p1')?.chips).toBe(990);
        expect(playerStates.get('p1')?.bet).toBe(10);

        // Big blind: (2 + 2) % 3 = 1 (p2)
        expect(newPlayers.get('p2')?.chips).toBe(980);
        expect(playerStates.get('p2')?.bet).toBe(20);
      }
    });
  });

  describe('dealHoleCards', () => {
    it('should deal 2 cards to each player', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const deck = shuffleDeck(createDeck());

      const result = dealHoleCards(players, deck);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const { playerStates, remainingDeck } = result.right;

        expect(playerStates.size).toBe(2);
        expect(remainingDeck.length).toBe(48); // 52 - 4

        playerStates.forEach((state) => {
          expect(O.isSome(state.hand)).toBe(true);
          if (O.isSome(state.hand)) {
            expect(state.hand.value.length).toBe(2);
          }
        });
      }
    });

    it('should return Left when insufficient cards', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const deck = ['As', 'Kh', 'Qd']; // Only 3 cards

      const result = dealHoleCards(players, deck);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InsufficientCards');
      }
    });
  });

  describe('resetForNewStreet', () => {
    it('should reset bets for new street', () => {
      const playerStates = new Map([
        ['p1', { bet: 50, cumulativeBet: 50, isFolded: false, hasActed: true, hand: O.none }],
        ['p2', { bet: 50, cumulativeBet: 50, isFolded: false, hasActed: true, hand: O.none }],
      ]);

      const result = resetForNewStreet(playerStates);

      result.forEach((state) => {
        expect(state.bet).toBe(0);
        expect(state.hasActed).toBe(false);
        // cumulativeBet should remain unchanged
      });
    });

    it('should keep cumulativeBet unchanged', () => {
      const playerStates = new Map([
        ['p1', { bet: 50, cumulativeBet: 100, isFolded: false, hasActed: true, hand: O.none }],
      ]);

      const result = resetForNewStreet(playerStates);

      expect(result.get('p1')?.cumulativeBet).toBe(100);
    });
  });

  describe('advanceBettor', () => {
    it('should advance to next player', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);

      const nextIndex = advanceBettor(1, players.size);

      expect(nextIndex).toBe(2);
    });

    it('should wrap around to beginning', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);

      const nextIndex = advanceBettor(2, players.size);

      expect(nextIndex).toBe(0);
    });
  });
});
