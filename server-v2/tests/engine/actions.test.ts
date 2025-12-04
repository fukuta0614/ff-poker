/**
 * アクション処理関数のテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  executeFold,
  executeCheck,
  executeCall,
  executeRaise,
  executeAllIn,
  validateAction,
  processAction,
} from '../../src/engine/actions';
import { createRNGState } from '../../src/engine/rng';
import type { GameState, Player, PlayerState, PlayerId, PlayerAction } from '../../src/engine/types';

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

describe('Action Functions', () => {
  describe('executeFold', () => {
    it('should mark player as folded', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState()]]);
      const state = createTestGameState(players, playerStates);

      const result = executeFold('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        const playerState = newState.playerStates.get('p1');
        expect(playerState?.isFolded).toBe(true);
        expect(playerState?.hasActed).toBe(true);
      }
    });

    it('should not mutate original state', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState()]]);
      const state = createTestGameState(players, playerStates);
      const originalPlayerState = state.playerStates.get('p1');

      executeFold('p1', state);

      expect(state.playerStates.get('p1')).toBe(originalPlayerState);
      expect(state.playerStates.get('p1')?.isFolded).toBe(false);
    });

    it('should return Left when player not found', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = executeFold('nonexistent', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerNotFound');
      }
    });

    it('should return Left when player already folded', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0, true)]]);
      const state = createTestGameState(players, playerStates);

      const result = executeFold('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerAlreadyFolded');
      }
    });
  });

  describe('executeCheck', () => {
    it('should mark player as acted when bet is settled', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCheck('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        const playerState = newState.playerStates.get('p1');
        expect(playerState?.hasActed).toBe(true);
        expect(playerState?.isFolded).toBe(false);
      }
    });

    it('should not change chips or bet amounts', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50, 50)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCheck('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.players.get('p1')?.chips).toBe(1000);
        expect(newState.playerStates.get('p1')?.bet).toBe(50);
        expect(newState.totalPot).toBe(0);
      }
    });

    it('should return Left when bet is not settled', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(30)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCheck('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidAction');
        if (result.left.type === 'InvalidAction') {
          expect(result.left.reason).toContain('bet not settled');
        }
      }
    });

    it('should return Left when player not found', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = executeCheck('nonexistent', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerNotFound');
      }
    });

    it('should return Left when player already folded', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50, 50, true)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCheck('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerAlreadyFolded');
      }
    });
  });

  describe('executeCall', () => {
    it('should call correct amount and update state', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(30, 30)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCall('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.players.get('p1')?.chips).toBe(980); // 1000 - 20
        expect(newState.playerStates.get('p1')?.bet).toBe(50);
        expect(newState.playerStates.get('p1')?.cumulativeBet).toBe(50);
        expect(newState.playerStates.get('p1')?.hasActed).toBe(true);
        expect(newState.totalPot).toBe(20);
      }
    });

    it('should handle calling from 0 bet', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0)]]);
      const state = createTestGameState(players, playerStates, 100);

      const result = executeCall('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.players.get('p1')?.chips).toBe(900);
        expect(newState.playerStates.get('p1')?.bet).toBe(100);
        expect(newState.totalPot).toBe(100);
      }
    });

    it('should return Left when player has insufficient chips', () => {
      const players = new Map([['p1', createTestPlayer('p1', 10, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCall('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InsufficientChips');
        if (result.left.type === 'InsufficientChips') {
          expect(result.left.required).toBe(50);
          expect(result.left.available).toBe(10);
        }
      }
    });

    it('should return Left when player not found', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = executeCall('nonexistent', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerNotFound');
      }
    });

    it('should return Left when player already folded', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0, true)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCall('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerAlreadyFolded');
      }
    });

    it('should return Left when no amount to call', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50, 50)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeCall('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidAction');
        if (result.left.type === 'InvalidAction') {
          expect(result.left.reason).toContain('nothing to call');
        }
      }
    });
  });

  describe('executeRaise', () => {
    it('should raise correctly and update state', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50, 50)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeRaise('p1', 30, state); // Raise by 30, total bet = 80

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.players.get('p1')?.chips).toBe(970); // 1000 - 30
        expect(newState.playerStates.get('p1')?.bet).toBe(80);
        expect(newState.playerStates.get('p1')?.cumulativeBet).toBe(80);
        expect(newState.currentBet).toBe(80);
        expect(newState.minRaiseAmount).toBe(30);
        expect(newState.totalPot).toBe(30);
        expect(O.isSome(newState.lastAggressorId)).toBe(true);
        if (O.isSome(newState.lastAggressorId)) {
          expect(newState.lastAggressorId.value).toBe('p1');
        }
      }
    });

    it('should handle raise from 0 bet', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0)]]);
      const state = createTestGameState(players, playerStates, 0);

      const result = executeRaise('p1', 50, state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.players.get('p1')?.chips).toBe(950);
        expect(newState.playerStates.get('p1')?.bet).toBe(50);
        expect(newState.currentBet).toBe(50);
      }
    });

    it('should return Left when raise is too small', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50, 50)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeRaise('p1', 5, state); // Min raise is 10

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidBetAmount');
      }
    });

    it('should return Left when player has insufficient chips', () => {
      const players = new Map([['p1', createTestPlayer('p1', 20, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0)]]);
      const state = createTestGameState(players, playerStates, 0);

      const result = executeRaise('p1', 50, state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InsufficientChips');
      }
    });

    it('should return Left when player not found', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = executeRaise('nonexistent', 10, state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerNotFound');
      }
    });

    it('should return Left when player already folded', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0, true)]]);
      const state = createTestGameState(players, playerStates, 0);

      const result = executeRaise('p1', 50, state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerAlreadyFolded');
      }
    });

    it('should allow all-in raise below minimum', () => {
      const players = new Map([['p1', createTestPlayer('p1', 15, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50, 50)]]);
      const state = createTestGameState(players, playerStates, 50);

      // Player wants to raise by 15 (all remaining chips), but min raise is 10
      // Since this is all-in, it should be allowed
      const result = executeRaise('p1', 15, state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.players.get('p1')?.chips).toBe(0);
        expect(newState.playerStates.get('p1')?.bet).toBe(65);
      }
    });
  });

  describe('executeAllIn', () => {
    it('should go all-in with all remaining chips', () => {
      const players = new Map([['p1', createTestPlayer('p1', 75, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(25, 25)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeAllIn('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.players.get('p1')?.chips).toBe(0);
        expect(newState.playerStates.get('p1')?.bet).toBe(100); // 25 + 75
        expect(newState.playerStates.get('p1')?.cumulativeBet).toBe(100);
        expect(newState.totalPot).toBe(75);
      }
    });

    it('should set current bet when all-in is larger than current bet', () => {
      const players = new Map([['p1', createTestPlayer('p1', 100, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeAllIn('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.currentBet).toBe(100);
        expect(O.isSome(newState.lastAggressorId)).toBe(true);
      }
    });

    it('should not set last aggressor when all-in is less than current bet', () => {
      const players = new Map([['p1', createTestPlayer('p1', 30, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeAllIn('p1', state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.currentBet).toBe(50); // Unchanged
        expect(newState.playerStates.get('p1')?.bet).toBe(30);
      }
    });

    it('should return Left when player has no chips', () => {
      const players = new Map([['p1', createTestPlayer('p1', 0, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(50, 50)]]);
      const state = createTestGameState(players, playerStates, 50);

      const result = executeAllIn('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidAction');
        if (result.left.type === 'InvalidAction') {
          expect(result.left.reason).toContain('no chips');
        }
      }
    });

    it('should return Left when player not found', () => {
      const state = createTestGameState(new Map(), new Map());

      const result = executeAllIn('nonexistent', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerNotFound');
      }
    });

    it('should return Left when player already folded', () => {
      const players = new Map([['p1', createTestPlayer('p1', 100, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0, true)]]);
      const state = createTestGameState(players, playerStates, 0);

      const result = executeAllIn('p1', state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('PlayerAlreadyFolded');
      }
    });
  });

  describe('validateAction', () => {
    it('should return Right when action is valid (fold)', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState()],
        ['p2', createTestPlayerState()],
      ]);
      const state = createTestGameState(players, playerStates, 0, 0);
      const action: PlayerAction = { playerId: 'p1', type: 'fold' };

      const result = validateAction(action, state);

      expect(E.isRight(result)).toBe(true);
    });

    it('should return Left when not player turn', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState()],
        ['p2', createTestPlayerState()],
      ]);
      const state = createTestGameState(players, playerStates, 0, 0);
      const action: PlayerAction = { playerId: 'p2', type: 'fold' }; // Not p2's turn

      const result = validateAction(action, state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidTurn');
      }
    });

    it('should return Left when action is not valid for player', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(30)]]);
      const state = createTestGameState(players, playerStates, 50, 0);
      const action: PlayerAction = { playerId: 'p1', type: 'check' }; // Can't check with unsettled bet

      const result = validateAction(action, state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidAction');
      }
    });
  });

  describe('processAction', () => {
    it('should process fold action correctly', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState()],
        ['p2', createTestPlayerState()],
      ]);
      const state = createTestGameState(players, playerStates, 0, 0);
      const action: PlayerAction = { playerId: 'p1', type: 'fold' };

      const result = processAction(action, state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.playerStates.get('p1')?.isFolded).toBe(true);
      }
    });

    it('should process call action correctly', () => {
      const players = new Map([
        ['p1', createTestPlayer('p1', 1000, 0)],
        ['p2', createTestPlayer('p2', 1000, 1)],
      ]);
      const playerStates = new Map([
        ['p1', createTestPlayerState(30, 30)],
        ['p2', createTestPlayerState(50, 50)],
      ]);
      const state = createTestGameState(players, playerStates, 50, 0);
      const action: PlayerAction = { playerId: 'p1', type: 'call' };

      const result = processAction(action, state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.playerStates.get('p1')?.bet).toBe(50);
        expect(newState.players.get('p1')?.chips).toBe(980);
      }
    });

    it('should process raise action correctly', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState(0, 0)]]);
      const state = createTestGameState(players, playerStates, 0, 0);
      const action: PlayerAction = { playerId: 'p1', type: 'raise', amount: 50 };

      const result = processAction(action, state);

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const newState = result.right;
        expect(newState.currentBet).toBe(50);
      }
    });

    it('should return Left when validation fails', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState()]]);
      const state = createTestGameState(players, playerStates, 0, 0);
      const action: PlayerAction = { playerId: 'p2', type: 'fold' }; // p2 doesn't exist

      const result = processAction(action, state);

      expect(E.isLeft(result)).toBe(true);
    });

    it('should return Left when raise amount is missing', () => {
      const players = new Map([['p1', createTestPlayer('p1', 1000, 0)]]);
      const playerStates = new Map([['p1', createTestPlayerState()]]);
      const state = createTestGameState(players, playerStates, 0, 0);
      const action: PlayerAction = { playerId: 'p1', type: 'raise' }; // No amount

      const result = processAction(action, state);

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.type).toBe('InvalidAction');
      }
    });
  });
});
