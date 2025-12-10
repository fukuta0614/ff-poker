/**
 * ポット計算関数のテスト
 */

import { describe, it, expect } from '@jest/globals';
import { calculatePots } from '../../src/engine/pot';
import type { GameState, Player, PlayerState, PlayerId } from '../../src/engine/types';
import * as O from 'fp-ts/Option';
import { createRNGState } from '../../src/engine/rng';

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
  players: Map<PlayerId, Player>,
  playerStates: Map<PlayerId, PlayerState>
): GameState => ({
  players,
  playerStates,
  stage: 'river',
  dealerIndex: 0,
  currentBettorIndex: 0,
  deck: [],
  communityCards: [],
  currentBet: 0,
  minRaiseAmount: 10,
  lastAggressorId: O.none,
  pots: [],
  totalPot: 0,
  rngState: createRNGState(12345),
  waitingForAck: false,
  ackState: O.none,
});

describe('Pot Calculation', () => {
  describe('calculatePots', () => {
    it('should calculate single main pot when all bets are equal', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 950, 0)],
        ['p2', createTestPlayer('p2', 950, 1)],
        ['p3', createTestPlayer('p3', 950, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false)],
        ['p2', createTestPlayerState(50, 50, false)],
        ['p3', createTestPlayerState(50, 50, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(1);
      expect(pots[0].amount).toBe(150); // 50 * 3
      expect(pots[0].eligiblePlayers.size).toBe(3);
      expect(pots[0].eligiblePlayers.has('p1')).toBe(true);
      expect(pots[0].eligiblePlayers.has('p2')).toBe(true);
      expect(pots[0].eligiblePlayers.has('p3')).toBe(true);
    });

    it('should exclude folded players from pots', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 950, 0)],
        ['p2', createTestPlayer('p2', 950, 1)],
        ['p3', createTestPlayer('p3', 975, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false)],
        ['p2', createTestPlayerState(50, 50, false)],
        ['p3', createTestPlayerState(25, 25, true)], // Folded
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(1);
      expect(pots[0].amount).toBe(125); // 50 + 50 + 25
      expect(pots[0].eligiblePlayers.size).toBe(2);
      expect(pots[0].eligiblePlayers.has('p1')).toBe(true);
      expect(pots[0].eligiblePlayers.has('p2')).toBe(true);
      expect(pots[0].eligiblePlayers.has('p3')).toBe(false);
    });

    it('should create side pot when one player all-in for less', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 0, 0)], // All-in
        ['p2', createTestPlayer('p2', 900, 1)],
        ['p3', createTestPlayer('p3', 900, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(30, 30, false)], // All-in
        ['p2', createTestPlayerState(100, 100, false)],
        ['p3', createTestPlayerState(100, 100, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(2);

      // Main pot: 30 * 3 = 90, eligible: all three
      expect(pots[0].amount).toBe(90);
      expect(pots[0].eligiblePlayers.size).toBe(3);

      // Side pot: 70 * 2 = 140, eligible: p2, p3
      expect(pots[1].amount).toBe(140);
      expect(pots[1].eligiblePlayers.size).toBe(2);
      expect(pots[1].eligiblePlayers.has('p1')).toBe(false);
      expect(pots[1].eligiblePlayers.has('p2')).toBe(true);
      expect(pots[1].eligiblePlayers.has('p3')).toBe(true);
    });

    it('should create multiple side pots for multiple all-ins', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 0, 0)], // All-in 20
        ['p2', createTestPlayer('p2', 0, 1)], // All-in 50
        ['p3', createTestPlayer('p3', 900, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(20, 20, false)],
        ['p2', createTestPlayerState(50, 50, false)],
        ['p3', createTestPlayerState(100, 100, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(3);

      // Pot 1: 20 * 3 = 60, eligible: all three
      expect(pots[0].amount).toBe(60);
      expect(pots[0].eligiblePlayers.size).toBe(3);

      // Pot 2: 30 * 2 = 60, eligible: p2, p3
      expect(pots[1].amount).toBe(60);
      expect(pots[1].eligiblePlayers.size).toBe(2);
      expect(pots[1].eligiblePlayers.has('p1')).toBe(false);

      // Pot 3: 50 * 1 = 50, eligible: p3 only
      expect(pots[2].amount).toBe(50);
      expect(pots[2].eligiblePlayers.size).toBe(1);
      expect(pots[2].eligiblePlayers.has('p3')).toBe(true);
    });

    it('should handle all players all-in with different amounts', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 0, 0)],
        ['p2', createTestPlayer('p2', 0, 1)],
        ['p3', createTestPlayer('p3', 0, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(10, 10, false)],
        ['p2', createTestPlayerState(20, 20, false)],
        ['p3', createTestPlayerState(30, 30, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(3);

      // Pot 1: 10 * 3 = 30
      expect(pots[0].amount).toBe(30);
      expect(pots[0].eligiblePlayers.size).toBe(3);

      // Pot 2: 10 * 2 = 20
      expect(pots[1].amount).toBe(20);
      expect(pots[1].eligiblePlayers.size).toBe(2);

      // Pot 3: 10 * 1 = 10
      expect(pots[2].amount).toBe(10);
      expect(pots[2].eligiblePlayers.size).toBe(1);
    });

    it('should handle folded player with all-in scenario', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 0, 0)], // All-in
        ['p2', createTestPlayer('p2', 950, 1)],
        ['p3', createTestPlayer('p3', 975, 2)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(30, 30, false)],
        ['p2', createTestPlayerState(50, 50, false)],
        ['p3', createTestPlayerState(25, 25, true)], // Folded
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(2);

      // Pot 1: 25*3 + (30-25)*2 = 75 + 10 = 85, eligible: p1, p2
      // (25 from all three, then 5 more from p1 and p2, merged because same eligible)
      expect(pots[0].amount).toBe(85);
      expect(pots[0].eligiblePlayers.size).toBe(2);
      expect(pots[0].eligiblePlayers.has('p1')).toBe(true);
      expect(pots[0].eligiblePlayers.has('p2')).toBe(true);
      expect(pots[0].eligiblePlayers.has('p3')).toBe(false);

      // Pot 2: (50-30)*1 = 20, eligible: p2 only
      expect(pots[1].amount).toBe(20);
      expect(pots[1].eligiblePlayers.size).toBe(1);
      expect(pots[1].eligiblePlayers.has('p2')).toBe(true);
    });

    it('should return empty array when no bets', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(0, 0, false)],
        ['p2', createTestPlayerState(0, 0, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(0);
    });

    it('should handle single player with bet', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 950, 0)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(50, 50, false)],
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(1);
      expect(pots[0].amount).toBe(50);
      expect(pots[0].eligiblePlayers.size).toBe(1);
    });

    it('should use cumulative bets, not current street bets', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 900, 0)],
        ['p2', createTestPlayer('p2', 900, 1)],
      ]);
      const playerStates = new Map([
        // bet = current street, cumulativeBet = total across all streets
        ['p1', createTestPlayerState(20, 100, false)], // 100 total
        ['p2', createTestPlayerState(30, 100, false)], // 100 total
      ]);
      const state = createTestGameState(players, playerStates);

      const pots = calculatePots(state);

      expect(pots.length).toBe(1);
      expect(pots[0].amount).toBe(200); // Use cumulative: 100 + 100
    });
  });
});
