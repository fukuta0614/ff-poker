/**
 * 確認応答（Acknowledgment）機能のテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  processAction,
  processAcknowledgment,
} from '../../src/engine/actions';
import { initializeRound } from '../../src/engine/game-init';
import type { GameState, Player, PlayerId } from '../../src/engine/types';
import { createRNGState } from '../../src/engine/rng';

// テスト用のヘルパー関数
const createTestPlayer = (id: PlayerId, chips: number, seat: number): Player => ({
  id,
  name: `Player${id}`,
  chips,
  seat,
});

describe('Acknowledgment System', () => {
  describe('processAction with acknowledgment', () => {
    it('should set waitingForAck to true after player action', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;
      expect(state.waitingForAck).toBe(false);

      // p1 (UTG) の call アクション
      const callAction = { playerId: 'p1', type: 'call' as const };
      const callResult = processAction(callAction, state);

      expect(E.isRight(callResult)).toBe(true);
      if (!E.isRight(callResult)) return;

      const newState = callResult.right;
      expect(newState.waitingForAck).toBe(true);
      expect(O.isSome(newState.ackState)).toBe(true);

      if (O.isSome(newState.ackState)) {
        const ackState = newState.ackState.value;
        expect(ackState.expectedAcks.size).toBe(3); // 全プレイヤー
        expect(ackState.receivedAcks.size).toBe(0);
        expect(ackState.description).toContain('call');
      }
    });

    it('should reject action when already waiting for ack', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;

      // First action
      const callAction = { playerId: 'p1', type: 'call' as const };
      const callResult = processAction(callAction, state);
      expect(E.isRight(callResult)).toBe(true);
      if (!E.isRight(callResult)) return;

      state = callResult.right;
      expect(state.waitingForAck).toBe(true);

      // Try another action while waiting for ack
      const raiseAction = { playerId: 'p2', type: 'raise' as const, amount: 40 };
      const raiseResult = processAction(raiseAction, state);

      expect(E.isLeft(raiseResult)).toBe(true);
      if (E.isLeft(raiseResult)) {
        expect(raiseResult.left.type).toBe('WaitingForAcknowledgment');
      }
    });
  });

  describe('processAcknowledgment', () => {
    it('should accept ack from expected player', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;

      // p1 call
      const callResult = processAction({ playerId: 'p1', type: 'call' }, state);
      expect(E.isRight(callResult)).toBe(true);
      if (!E.isRight(callResult)) return;

      state = callResult.right;

      // p1 の ack
      const ackResult = processAcknowledgment('p1', state);
      expect(E.isRight(ackResult)).toBe(true);
      if (!E.isRight(ackResult)) return;

      const newState = ackResult.right;
      expect(newState.waitingForAck).toBe(true); // まだ全員揃っていない
      expect(O.isSome(newState.ackState)).toBe(true);

      if (O.isSome(newState.ackState)) {
        const ackState = newState.ackState.value;
        expect(ackState.receivedAcks.has('p1')).toBe(true);
        expect(ackState.receivedAcks.size).toBe(1);
      }
    });

    it('should resolve acknowledgment when all acks received', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;

      // p1 call
      const callResult = processAction({ playerId: 'p1', type: 'call' }, state);
      expect(E.isRight(callResult)).toBe(true);
      if (!E.isRight(callResult)) return;

      state = callResult.right;

      // p1 の ack
      const ack1Result = processAcknowledgment('p1', state);
      expect(E.isRight(ack1Result)).toBe(true);
      if (!E.isRight(ack1Result)) return;

      state = ack1Result.right;
      expect(state.waitingForAck).toBe(true);

      // p2 の ack
      const ack2Result = processAcknowledgment('p2', state);
      expect(E.isRight(ack2Result)).toBe(true);
      if (!E.isRight(ack2Result)) return;

      state = ack2Result.right;
      expect(state.waitingForAck).toBe(true);

      // p3 の ack → ack 解決
      const ack3Result = processAcknowledgment('p3', state);
      expect(E.isRight(ack3Result)).toBe(true);
      if (!E.isRight(ack3Result)) return;

      state = ack3Result.right;
      expect(state.waitingForAck).toBe(false); // ack 待ち解除
      expect(O.isNone(state.ackState)).toBe(true);
    });

    it('should reject ack from unexpected player', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;

      // p1 call
      const callResult = processAction({ playerId: 'p1', type: 'call' }, state);
      expect(E.isRight(callResult)).toBe(true);
      if (!E.isRight(callResult)) return;

      state = callResult.right;

      // 存在しないプレイヤーからの ack
      const ackResult = processAcknowledgment('p999', state);

      expect(E.isLeft(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) {
        expect(ackResult.left.type).toBe('AcknowledgmentNotExpected');
      }
    });

    it('should reject duplicate ack from same player', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;

      // p1 call
      const callResult = processAction({ playerId: 'p1', type: 'call' }, state);
      expect(E.isRight(callResult)).toBe(true);
      if (!E.isRight(callResult)) return;

      state = callResult.right;

      // p1 の ack (1回目)
      const ack1Result = processAcknowledgment('p1', state);
      expect(E.isRight(ack1Result)).toBe(true);
      if (!E.isRight(ack1Result)) return;

      state = ack1Result.right;

      // p1 の ack (2回目 - 重複)
      const ack2Result = processAcknowledgment('p1', state);

      expect(E.isLeft(ack2Result)).toBe(true);
      if (E.isLeft(ack2Result)) {
        expect(ack2Result.left.type).toBe('AcknowledgmentAlreadyReceived');
      }
    });

    it('should reject ack when not waiting for ack', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      const state = initResult.right;
      expect(state.waitingForAck).toBe(false);

      // ack 待ち状態でないのに ack を送る
      const ackResult = processAcknowledgment('p1', state);

      expect(E.isLeft(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) {
        expect(ackResult.left.type).toBe('AcknowledgmentNotExpected');
      }
    });
  });

  describe('Full game flow with acknowledgments', () => {
    it('should progress through stages with acks', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;
      expect(state.stage).toBe('preflop');

      // p1 call
      let actionResult = processAction({ playerId: 'p1', type: 'call' }, state);
      expect(E.isRight(actionResult)).toBe(true);
      if (!E.isRight(actionResult)) return;

      state = actionResult.right;
      expect(state.waitingForAck).toBe(true);

      // All players ack
      for (const playerId of ['p1', 'p2', 'p3']) {
        const ackResult = processAcknowledgment(playerId, state);
        expect(E.isRight(ackResult)).toBe(true);
        if (!E.isRight(ackResult)) return;
        state = ackResult.right;
      }

      expect(state.waitingForAck).toBe(false);
      expect(state.stage).toBe('preflop'); // まだ preflop
    });

    it('should handle reraise sequence with acks', () => {
      const players = [
        createTestPlayer('p1', 1000, 0),
        createTestPlayer('p2', 1000, 1),
        createTestPlayer('p3', 1000, 2),
      ];

      const rngState = createRNGState(12345);
      const initResult = initializeRound(players, 0, 10, 20, rngState);

      expect(E.isRight(initResult)).toBe(true);
      if (!E.isRight(initResult)) return;

      let state = initResult.right;

      // p1: raise
      let actionResult = processAction(
        { playerId: 'p1', type: 'raise', amount: 80 },
        state
      );
      expect(E.isRight(actionResult)).toBe(true);
      if (!E.isRight(actionResult)) return;

      state = actionResult.right;
      expect(state.waitingForAck).toBe(true);
      expect(state.stage).toBe('preflop');

      // All players ack
      for (const playerId of ['p1', 'p2', 'p3']) {
        const ackResult = processAcknowledgment(playerId, state);
        expect(E.isRight(ackResult)).toBe(true);
        if (!E.isRight(ackResult)) return;
        state = ackResult.right;
      }

      expect(state.waitingForAck).toBe(false);

      // p2: reraise
      actionResult = processAction(
        { playerId: 'p2', type: 'raise', amount: 180 },
        state
      );
      expect(E.isRight(actionResult)).toBe(true);
      if (!E.isRight(actionResult)) return;

      state = actionResult.right;
      expect(state.waitingForAck).toBe(true);
      expect(state.stage).toBe('preflop');

      // All players ack
      for (const playerId of ['p1', 'p2', 'p3']) {
        const ackResult = processAcknowledgment(playerId, state);
        expect(E.isRight(ackResult)).toBe(true);
        if (!E.isRight(ackResult)) return;
        state = ackResult.right;
      }

      expect(state.waitingForAck).toBe(false);
      expect(state.stage).toBe('preflop'); // まだ preflop
    });
  });
});
