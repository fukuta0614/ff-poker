/**
 * ユーティリティ関数のテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as O from 'fp-ts/Option';
import {
  getPlayer,
  getPlayerState,
  getCurrentBettor,
  getActivePlayers,
  calculateCallAmount,
  calculateMinRaise,
  getValidActions,
  isBettingComplete,
  hasOnlyOneActivePlayer,
} from '../../src/engine/utils';
import { createRNGState } from '../../src/engine/rng';
import type { GameState, Player, PlayerState, PlayerId } from '../../src/engine/types';

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
  isFolded: boolean = false,
  hasActed: boolean = false
): PlayerState => ({
  bet,
  cumulativeBet,
  isFolded,
  hasActed,
  hand: O.none,
});

const createTestGameState = (
  players: Map<PlayerId, Player>,
  playerStates: Map<PlayerId, PlayerState>,
  currentBet: number = 0,
  currentBettorIndex: number = 0
): GameState => ({
  players,
  playerStates,
  stage: 'preflop',
  dealerIndex: 0,
  currentBettorIndex,
  deck: [],
  communityCards: [],
  currentBet,
  minRaiseAmount: 10,
  lastAggressorId: O.none,
  pots: [],
  totalPot: 0,
  rngState: createRNGState(12345),
  waitingForAck: false,
  ackState: O.none,
});

describe('Utils Functions', () => {
  describe('getPlayer', () => {
    it('should return Some when player exists', () => {
      const player = createTestPlayer('p1', 1000, 0);
      const state = createTestGameState(
        new Map([['p1', player]]),
        new Map()
      );

      const result = getPlayer('p1', state);

      expect(O.isSome(result)).toBe(true);
      if (O.isSome(result)) {
        expect(result.value).toEqual(player);
      }
    });

    it('should return None when player does not exist', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = getPlayer('nonexistent', state);

      expect(O.isNone(result)).toBe(true);
    });
  });

  describe('getPlayerState', () => {
    it('should return Some when player state exists', () => {
      const playerState = createTestPlayerState(50, 50);
      const state = createTestGameState(
        new Map(),
        new Map([['p1', playerState]])
      );

      const result = getPlayerState('p1', state);

      expect(O.isSome(result)).toBe(true);
      if (O.isSome(result)) {
        expect(result.value).toEqual(playerState);
      }
    });

    it('should return None when player state does not exist', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = getPlayerState('nonexistent', state);

      expect(O.isNone(result)).toBe(true);
    });
  });

  describe('getCurrentBettor', () => {
    it('should return current bettor based on index', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);
      const state = createTestGameState(players, new Map(), 0, 1);

      const result = getCurrentBettor(state);

      expect(O.isSome(result)).toBe(true);
      if (O.isSome(result)) {
        expect(result.value.id).toBe('p2');
      }
    });

    it('should return None when no players', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = getCurrentBettor(state);

      expect(O.isNone(result)).toBe(true);
    });

    it('should return None when index is out of bounds', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
      ]);
      const state = createTestGameState(players, new Map(), 0, 5);

      const result = getCurrentBettor(state);

      expect(O.isNone(result)).toBe(true);
    });
  });

  describe('getActivePlayers', () => {
    it('should return players who have not folded', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(0, 0, false)],
        ['p2', createTestPlayerState(0, 0, true)], // folded
        ['p3', createTestPlayerState(0, 0, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const result = getActivePlayers(state);

      expect(result.length).toBe(2);
      expect(result.map(p => p.id)).toEqual(['p1', 'p3']);
    });

    it('should return empty array when all players folded', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(0, 0, true)],
      ]);
      const state = createTestGameState(players, playerStates);

      const result = getActivePlayers(state);

      expect(result).toEqual([]);
    });
  });

  describe('calculateCallAmount', () => {
    it('should calculate correct call amount', () => {
      const playerState = createTestPlayerState(30);
      const state = createTestGameState(
        new Map(),
        new Map([['p1', playerState]]),
        50
      );

      const result = calculateCallAmount('p1', state);

      expect(result).toBe(20); // 50 - 30
    });

    it('should return 0 when player bet matches current bet', () => {
      const playerState = createTestPlayerState(50);
      const state = createTestGameState(
        new Map(),
        new Map([['p1', playerState]]),
        50
      );

      const result = calculateCallAmount('p1', state);

      expect(result).toBe(0);
    });

    it('should return 0 when player not found', () => {
      const state = createTestGameState(new Map(), new Map(), 50);

      const result = calculateCallAmount('nonexistent', state);

      expect(result).toBe(0);
    });

    it('should return current bet when player has bet 0', () => {
      const playerState = createTestPlayerState(0);
      const state = createTestGameState(
        new Map(),
        new Map([['p1', playerState]]),
        100
      );

      const result = calculateCallAmount('p1', state);

      expect(result).toBe(100);
    });
  });

  describe('calculateMinRaise', () => {
    it('should calculate minimum raise correctly', () => {
      const state = createTestGameState(new Map(), new Map(), 50);

      const result = calculateMinRaise(state);

      expect(result).toBe(60); // 50 + 10
    });

    it('should use minRaiseAmount from state', () => {
      const state: GameState = {
        ...createTestGameState(new Map(), new Map(), 100),
        minRaiseAmount: 25,
      };

      const result = calculateMinRaise(state);

      expect(result).toBe(125); // 100 + 25
    });

    it('should handle 0 current bet', () => {
      const state = createTestGameState(new Map(), new Map(), 0);

      const result = calculateMinRaise(state);

      expect(result).toBe(10); // 0 + 10
    });
  });

  describe('getValidActions', () => {
    it('should include fold, check when bet is settled', () => {
      const player = createTestPlayer('p1', 1000, 0);
      const playerState = createTestPlayerState(50);
      const state = createTestGameState(
        new Map([['p1', player]]),
        new Map([['p1', playerState]]),
        50,
        0
      );

      const result = getValidActions('p1', state);

      expect(result).toContain('fold');
      expect(result).toContain('check');
      expect(result).not.toContain('call');
    });

    it('should include fold, call, raise, allin when bet is not settled', () => {
      const player = createTestPlayer('p1', 1000, 0);
      const playerState = createTestPlayerState(30);
      const state = createTestGameState(
        new Map([['p1', player]]),
        new Map([['p1', playerState]]),
        50,
        0
      );

      const result = getValidActions('p1', state);

      expect(result).toContain('fold');
      expect(result).toContain('call');
      expect(result).toContain('raise');
      expect(result).toContain('allin');
      expect(result).not.toContain('check');
    });

    it('should not include raise when player has insufficient chips', () => {
      const player = createTestPlayer('p1', 15, 0); // Only 15 chips
      const playerState = createTestPlayerState(10);
      const state = createTestGameState(
        new Map([['p1', player]]),
        new Map([['p1', playerState]]),
        50, // Current bet is 50
        0
      );

      const result = getValidActions('p1', state);

      expect(result).not.toContain('raise');
      expect(result).toContain('call'); // Can still call
      expect(result).toContain('allin');
    });

    it('should only return fold when player has 0 chips', () => {
      const player = createTestPlayer('p1', 0, 0);
      const playerState = createTestPlayerState(50);
      const state = createTestGameState(
        new Map([['p1', player]]),
        new Map([['p1', playerState]]),
        50,
        0
      );

      const result = getValidActions('p1', state);

      expect(result).toEqual(['fold', 'check']);
    });

    it('should return empty array when player not found', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = getValidActions('nonexistent', state);

      expect(result).toEqual([]);
    });

    it('should not include allin when player has 0 chips', () => {
      const player = createTestPlayer('p1', 0, 0);
      const playerState = createTestPlayerState(0);
      const state = createTestGameState(
        new Map([['p1', player]]),
        new Map([['p1', playerState]]),
        0,
        0
      );

      const result = getValidActions('p1', state);

      expect(result).not.toContain('allin');
    });
  });

  describe('isBettingComplete', () => {
    it('should return true when all active players have same bet and acted', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false, true)],
        ['p2', createTestPlayerState(50, 50, false, true)],
      ]);
      const state = createTestGameState(players, playerStates, 50);

      const result = isBettingComplete(state);

      expect(result).toBe(true);
    });

    it('should return false when not all players have acted', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false, true)],
        ['p2', createTestPlayerState(50, 50, false, false)], // Not acted
      ]);
      const state = createTestGameState(players, playerStates, 50);

      const result = isBettingComplete(state);

      expect(result).toBe(false);
    });

    it('should return false when bets are not equal', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false, true)],
        ['p2', createTestPlayerState(30, 30, false, true)], // Different bet
      ]);
      const state = createTestGameState(players, playerStates, 50);

      const result = isBettingComplete(state);

      expect(result).toBe(false);
    });

    it('should ignore folded players', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false, true)],
        ['p2', createTestPlayerState(20, 20, true, true)], // Folded
        ['p3', createTestPlayerState(50, 50, false, true)],
      ]);
      const state = createTestGameState(players, playerStates, 50);

      const result = isBettingComplete(state);

      expect(result).toBe(true); // p2 is folded, so only p1 and p3 matter
    });

    it('should return true when only one active player remains', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false, true)],
        ['p2', createTestPlayerState(20, 20, true, true)], // Folded
      ]);
      const state = createTestGameState(players, playerStates, 50);

      const result = isBettingComplete(state);

      expect(result).toBe(true);
    });

    it('should handle all-in players correctly', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 0, 0)], // All-in
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(30, 30, false, true)], // All-in with less
        ['p2', createTestPlayerState(50, 50, false, true)],
      ]);
      const state = createTestGameState(players, playerStates, 50);

      const result = isBettingComplete(state);

      // Both have acted, p1 is all-in (chips=0) so betting is complete
      // Side pot will be calculated separately
      expect(result).toBe(true);
    });
  });

  describe('hasOnlyOneActivePlayer', () => {
    it('should return true when only one player has not folded', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
        ['p3', createTestPlayer('p3', 1000, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(0, 0, false)],
        ['p2', createTestPlayerState(0, 0, true)],
        ['p3', createTestPlayerState(0, 0, true)],
      ]);
      const state = createTestGameState(players, playerStates);

      const result = hasOnlyOneActivePlayer(state);

      expect(result).toBe(true);
    });

    it('should return false when multiple players are active', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(0, 0, false)],
        ['p2', createTestPlayerState(0, 0, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const result = hasOnlyOneActivePlayer(state);

      expect(result).toBe(false);
    });

    it('should return false when no players are active', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(0, 0, true)],
      ]);
      const state = createTestGameState(players, playerStates);

      const result = hasOnlyOneActivePlayer(state);

      expect(result).toBe(false);
    });
  });
});
