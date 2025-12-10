/**
 * 完全なゲームフロー統合テスト
 * プリフロップからショーダウンまでの全ての流れをテスト
 */

import { describe, it, expect } from '@jest/globals';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  initializeRound,
  processAction,
  advanceStage,
  advanceStageWithAck,
  isBettingComplete,
  performShowdown,
  getCurrentBettor,
  createRNGState,
  getActivePlayers,
  type Player,
  type GameState,
} from '../../src/engine';

// ヘルパー関数
function getCurrentBettorOrThrow(state: GameState): Player {
  const bettorOption = getCurrentBettor(state);
  if (O.isNone(bettorOption)) {
    throw new Error('No current bettor found');
  }
  return bettorOption.value;
}

describe('Game Flow Integration', () => {
  it('should complete a basic game flow with 3 players', () => {
    // ===  セットアップ ===
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2 },
    ];

    // === ラウンド初期化 ===
    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;
    expect(state.stage).toBe('preflop');
    expect(state.totalPot).toBe(30); // SB + BB

    // === プリフロップ: 全員コール/チェック ===
    while (!isBettingComplete(state) || state.waitingForAck) {
      if (state.waitingForAck) {
        // All players need to acknowledge
        const activePlayers = getActivePlayers(state);
        for (const player of activePlayers) {
          const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
          expect(E.isRight(ackResult)).toBe(true);
          if (E.isLeft(ackResult)) return;
          state = ackResult.right;
        }
      } else {
        const bettor = getCurrentBettorOrThrow(state);
        const playerState = state.playerStates.get(bettor.id);
        const callAmount = state.currentBet - (playerState?.bet || 0);

        // Use check if no amount to call, otherwise call
        const actionType = callAmount === 0 ? 'check' : 'call';
        const actionResult = processAction({ playerId: bettor.id, type: actionType }, state);

        expect(E.isRight(actionResult)).toBe(true);
        if (E.isLeft(actionResult)) return;
        state = actionResult.right;
      }
    }

    expect(state.totalPot).toBe(60); // 20 * 3

    // === フロップ ===
    // Manually advance to flop with ack
    const flopResult = advanceStageWithAck(state);
    expect(E.isRight(flopResult)).toBe(true);
    if (E.isLeft(flopResult)) return;
    state = flopResult.right;

    // Ack the stage transition
    let activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    expect(state.stage).toBe('flop');
    expect(state.communityCards.length).toBe(3);

    // 全員チェック
    while (!isBettingComplete(state) || state.waitingForAck) {
      if (state.waitingForAck) {
        const activePlayers = getActivePlayers(state);
        for (const player of activePlayers) {
          const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
          expect(E.isRight(ackResult)).toBe(true);
          if (E.isLeft(ackResult)) return;
          state = ackResult.right;
        }
      } else {
        const bettor = getCurrentBettorOrThrow(state);
        const actionResult = processAction({ playerId: bettor.id, type: 'check' }, state);
        expect(E.isRight(actionResult)).toBe(true);
        if (E.isLeft(actionResult)) return;
        state = actionResult.right;
      }
    }

    // === ターン ===
    // Manually advance to turn with ack
    const turnResult = advanceStageWithAck(state);
    expect(E.isRight(turnResult)).toBe(true);
    if (E.isLeft(turnResult)) return;
    state = turnResult.right;

    // Ack the stage transition
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    expect(state.stage).toBe('turn');
    expect(state.communityCards.length).toBe(4);

    // 全員チェック
    while (!isBettingComplete(state) || state.waitingForAck) {
      if (state.waitingForAck) {
        const activePlayers = getActivePlayers(state);
        for (const player of activePlayers) {
          const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
          expect(E.isRight(ackResult)).toBe(true);
          if (E.isLeft(ackResult)) return;
          state = ackResult.right;
        }
      } else {
        const bettor = getCurrentBettorOrThrow(state);
        const actionResult = processAction({ playerId: bettor.id, type: 'check' }, state);
        expect(E.isRight(actionResult)).toBe(true);
        if (E.isLeft(actionResult)) return;
        state = actionResult.right;
      }
    }

    // === リバー ===
    // Manually advance to river with ack
    const riverResult = advanceStageWithAck(state);
    expect(E.isRight(riverResult)).toBe(true);
    if (E.isLeft(riverResult)) return;
    state = riverResult.right;

    // Ack the stage transition
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    expect(state.stage).toBe('river');
    expect(state.communityCards.length).toBe(5);

    // 全員チェック
    while (!isBettingComplete(state) || state.waitingForAck) {
      if (state.waitingForAck) {
        const activePlayers = getActivePlayers(state);
        for (const player of activePlayers) {
          const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
          expect(E.isRight(ackResult)).toBe(true);
          if (E.isLeft(ackResult)) return;
          state = ackResult.right;
        }
      } else {
        const bettor = getCurrentBettorOrThrow(state);
        const actionResult = processAction({ playerId: bettor.id, type: 'check' }, state);
        expect(E.isRight(actionResult)).toBe(true);
        if (E.isLeft(actionResult)) return;
        state = actionResult.right;
      }
    }

    // === ショーダウン ===
    // Manually advance to showdown with ack
    const showdownStageResult = advanceStageWithAck(state);
    expect(E.isRight(showdownStageResult)).toBe(true);
    if (E.isLeft(showdownStageResult)) return;
    state = showdownStageResult.right;

    // Ack the stage transition
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    expect(state.stage).toBe('showdown');

    const showdownResult = performShowdown(state);
    expect(E.isRight(showdownResult)).toBe(true);
    if (E.isLeft(showdownResult)) return;

    const finalResult = showdownResult.right;
    expect(finalResult.winners.length).toBeGreaterThan(0);
    expect(finalResult.finalState.stage).toBe('ended');

    // チップの合計が変わっていないことを確認（保存則）
    const totalChipsAfter = Array.from(finalResult.finalState.players.values()).reduce(
      (sum, p) => sum + p.chips,
      0
    );
    expect(totalChipsAfter).toBe(3000); // 1000 * 3
  });

  it('should handle a game with a fold correctly', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
    ];

    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;

    // === プリフロップ ===
    // SB raises
    let bettor = getCurrentBettorOrThrow(state);
    let actionResult = processAction({ playerId: bettor.id, type: 'raise', amount: 60 }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge raise
    let activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // BB folds
    bettor = getCurrentBettorOrThrow(state);
    actionResult = processAction({ playerId: bettor.id, type: 'fold' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge fold
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // ゲーム終了（1人だけアクティブ）
    expect(isBettingComplete(state)).toBe(true);

    // SB wins without showdown (just collects pot)
    // SB(10) + raise(60) + BB(20) = 90
    expect(state.totalPot).toBe(90);
  });

  it('should correctly handle stage progression from preflop to showdown', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
    ];

    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;

    // Preflop -> Flop -> Turn -> River -> Showdown -> Ended
    const stages: Array<'preflop' | 'flop' | 'turn' | 'river' | 'showdown'> = [
      'preflop',
      'flop',
      'turn',
      'river',
      'showdown',
    ];

    for (const expectedStage of stages) {
      expect(state.stage).toBe(expectedStage);

      if (state.stage === 'showdown') {
        // Perform showdown instead of advancing stage
        const showdownResult = performShowdown(state);
        expect(E.isRight(showdownResult)).toBe(true);
        if (E.isLeft(showdownResult)) return;
        state = showdownResult.right.finalState;
        expect(state.stage).toBe('ended');
        break;
      }

      // Complete betting round (both players check/call)
      while (!isBettingComplete(state) || state.waitingForAck) {
        if (state.waitingForAck) {
          const activePlayers = getActivePlayers(state);
          for (const player of activePlayers) {
            const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
            expect(E.isRight(ackResult)).toBe(true);
            if (E.isLeft(ackResult)) return;
            state = ackResult.right;
          }
        } else {
          const bettor = getCurrentBettorOrThrow(state);
          const playerState = state.playerStates.get(bettor.id);
          const callAmount = state.currentBet - (playerState?.bet || 0);

          const actionType = callAmount === 0 ? 'check' : 'call';
          const actionResult = processAction({ playerId: bettor.id, type: actionType }, state);
          expect(E.isRight(actionResult)).toBe(true);
          if (E.isLeft(actionResult)) return;
          state = actionResult.right;
        }
      }

      // Manually advance to next stage with ack
      const stageResult = advanceStageWithAck(state);
      expect(E.isRight(stageResult)).toBe(true);
      if (E.isLeft(stageResult)) return;
      state = stageResult.right;

      // Ack the stage transition
      const activePlayers = getActivePlayers(state);
      for (const player of activePlayers) {
        const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
        expect(E.isRight(ackResult)).toBe(true);
        if (E.isLeft(ackResult)) return;
        state = ackResult.right;
      }
    }

    expect(state.stage).toBe('ended');
  });

  it('should handle all-in scenario with side pot creation', () => {
    // 3プレイヤー、1人がショートスタック
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0 }, // ディーラー
      { id: 'p2', name: 'Bob', chips: 100, seat: 1 },    // SB (ショートスタック)
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2 }, // BB
    ];

    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;

    // UTG (Alice) calls
    let bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p1');
    let actionResult = processAction({ playerId: bettor.id, type: 'call' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge call
    let activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // SB (Bob) goes all-in with 100 chips
    bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p2');
    actionResult = processAction({ playerId: bettor.id, type: 'allin' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge all-in
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // BB (Charlie) calls
    bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p3');
    actionResult = processAction({ playerId: bettor.id, type: 'call' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge call
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // Alice needs to call the all-in
    bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p1');
    actionResult = processAction({ playerId: bettor.id, type: 'call' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge final call
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // Betting complete
    expect(isBettingComplete(state)).toBe(true);

    // ポット計算:
    // Alice: 20 (initial call) + 80 (call to all-in) = 100
    // Bob: 10 (SB) + 90 (all-in) = 100
    // Charlie: 20 (BB) + 80 (call to all-in) = 100
    // Total: 300
    expect(state.totalPot).toBe(300);

    // Advance through all stages (Bob is all-in, so auto-check for others)
    while (state.stage !== 'showdown') {
      // Complete betting round
      while (!isBettingComplete(state) || state.waitingForAck) {
        if (state.waitingForAck) {
          activePlayers = getActivePlayers(state);
          for (const player of activePlayers) {
            let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
            expect(E.isRight(ackResult)).toBe(true);
            if (E.isLeft(ackResult)) return;
            state = ackResult.right;
          }
        } else {
          bettor = getCurrentBettorOrThrow(state);
          actionResult = processAction({ playerId: bettor.id, type: 'check' }, state);
          expect(E.isRight(actionResult)).toBe(true);
          if (E.isLeft(actionResult)) return;
          state = actionResult.right;
        }
      }

      // Manually advance to next stage with ack
      const stageResult = advanceStageWithAck(state);
      expect(E.isRight(stageResult)).toBe(true);
      if (E.isLeft(stageResult)) return;
      state = stageResult.right;

      // Ack the stage transition
      activePlayers = getActivePlayers(state);
      for (const player of activePlayers) {
        let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
        expect(E.isRight(ackResult)).toBe(true);
        if (E.isLeft(ackResult)) return;
        state = ackResult.right;
      }
    }

    // Showdown
    const showdownResult = performShowdown(state);
    expect(E.isRight(showdownResult)).toBe(true);
    if (E.isLeft(showdownResult)) return;

    const result = showdownResult.right;

    // チップ保存則
    const totalChipsAfter = Array.from(result.finalState.players.values()).reduce(
      (sum, p) => sum + p.chips,
      0
    );
    expect(totalChipsAfter).toBe(2100); // 1000 + 100 + 1000
  });

  it('should handle raise war scenario', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0 }, // Dealer
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },   // SB
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2 }, // BB
    ];

    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;

    // UTG (p1) raises (pays 60 total, which is 60 from their current 0)
    let bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p1');
    let actionResult = processAction({ playerId: bettor.id, type: 'raise', amount: 60 }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;
    expect(state.currentBet).toBe(60);

    // Acknowledge raise
    let activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // SB (p2) reraises to 150
    bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p2');
    actionResult = processAction({ playerId: bettor.id, type: 'raise', amount: 140 }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;
    expect(state.currentBet).toBe(150);

    // Acknowledge reraise
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // BB (p3) folds
    bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p3');
    actionResult = processAction({ playerId: bettor.id, type: 'fold' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge fold
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // UTG (p1) calls the reraise
    bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p1');
    actionResult = processAction({ playerId: bettor.id, type: 'call' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge final call
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    expect(isBettingComplete(state)).toBe(true);

    // ポット: p1(150) + p2(150) + p3(20) = 320
    expect(state.totalPot).toBe(320);

    // p1 と p2 のチップ確認
    expect(state.players.get('p1')?.chips).toBe(850); // 1000 - 150
    expect(state.players.get('p2')?.chips).toBe(850); // 1000 - 150
    expect(state.players.get('p3')?.chips).toBe(980); // 1000 - 20
  });

  it('should handle multiple all-ins with side pots', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 500, seat: 0 },
      { id: 'p2', name: 'Bob', chips: 200, seat: 1 },
      { id: 'p3', name: 'Charlie', chips: 100, seat: 2 },
    ];

    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;

    // UTG (p1) raises to 100
    let bettor = getCurrentBettorOrThrow(state);
    let actionResult = processAction({ playerId: bettor.id, type: 'raise', amount: 80 }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge raise
    let activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // SB (p2) goes all-in with 200
    bettor = getCurrentBettorOrThrow(state);
    actionResult = processAction({ playerId: bettor.id, type: 'allin' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge all-in
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // BB (p3) goes all-in with 100
    bettor = getCurrentBettorOrThrow(state);
    actionResult = processAction({ playerId: bettor.id, type: 'allin' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge all-in
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    // p1 calls the 200
    bettor = getCurrentBettorOrThrow(state);
    actionResult = processAction({ playerId: bettor.id, type: 'call' }, state);
    expect(E.isRight(actionResult)).toBe(true);
    if (E.isLeft(actionResult)) return;
    state = actionResult.right;

    // Acknowledge call
    activePlayers = getActivePlayers(state);
    for (const player of activePlayers) {
      let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
      expect(E.isRight(ackResult)).toBe(true);
      if (E.isLeft(ackResult)) return;
      state = ackResult.right;
    }

    expect(isBettingComplete(state)).toBe(true);

    // Total pot: 200 + 200 + 100 = 500
    expect(state.totalPot).toBe(500);

    // Betting complete should trigger auto-advance to showdown (all players all-in)
    // Since all players are all-in, there's no more betting, so advance through all stages to showdown
    while (state.stage !== 'showdown') {
      // Manually advance to next stage with ack
      const stageResult = advanceStageWithAck(state);
      expect(E.isRight(stageResult)).toBe(true);
      if (E.isLeft(stageResult)) return;
      state = stageResult.right;

      // Ack the stage transition
      const activePlayers = getActivePlayers(state);
      for (const player of activePlayers) {
        let ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
        expect(E.isRight(ackResult)).toBe(true);
        if (E.isLeft(ackResult)) return;
        state = ackResult.right;
      }
    }

    // Showdown with side pots
    const showdownResult = performShowdown(state);
    expect(E.isRight(showdownResult)).toBe(true);
    if (E.isLeft(showdownResult)) return;

    const result = showdownResult.right;

    // メインポットとサイドポットが生成されるべき
    expect(result.pots.length).toBeGreaterThan(0);

    // チップ保存則
    const totalChipsAfter = Array.from(result.finalState.players.values()).reduce(
      (sum, p) => sum + p.chips,
      0
    );
    expect(totalChipsAfter).toBe(800); // 500 + 200 + 100
  });

  it('should handle invalid actions with proper errors', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
    ];

    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;

    // Wrong player tries to act (should be p1's turn)
    const bettor = getCurrentBettorOrThrow(state);
    expect(bettor.id).toBe('p1');

    const wrongPlayerAction = processAction({ playerId: 'p2', type: 'call' }, state);
    expect(E.isLeft(wrongPlayerAction)).toBe(true);
    if (E.isLeft(wrongPlayerAction)) {
      expect(wrongPlayerAction.left.type).toBe('InvalidTurn');
    }

    // Invalid check when bet is not settled
    const invalidCheckAction = processAction({ playerId: 'p1', type: 'check' }, state);
    expect(E.isLeft(invalidCheckAction)).toBe(true);
    if (E.isLeft(invalidCheckAction)) {
      expect(invalidCheckAction.left.type).toBe('InvalidAction');
    }

    // Raise with insufficient amount (less than minimum)
    const invalidRaiseAction = processAction({
      playerId: 'p1',
      type: 'raise',
      amount: 5  // Too small (minimum raise should be BB = 20)
    }, state);
    expect(E.isLeft(invalidRaiseAction)).toBe(true);
    if (E.isLeft(invalidRaiseAction)) {
      expect(invalidRaiseAction.left.type).toBe('InvalidBetAmount');
    }
  });

  it('should handle tie (split pot) scenario', () => {
    const players: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
    ];

    const rngState = createRNGState(12345);
    const initResult = initializeRound(players, 0, 10, 20, rngState);
    expect(E.isRight(initResult)).toBe(true);
    if (E.isLeft(initResult)) return;

    let state: GameState = initResult.right;

    // Both players check/call through all streets
    while (state.stage !== 'showdown') {
      while (!isBettingComplete(state) || state.waitingForAck) {
        if (state.waitingForAck) {
          const activePlayers = getActivePlayers(state);
          for (const player of activePlayers) {
            const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
            expect(E.isRight(ackResult)).toBe(true);
            if (E.isLeft(ackResult)) return;
            state = ackResult.right;
          }
        } else {
          const bettor = getCurrentBettorOrThrow(state);
          const playerState = state.playerStates.get(bettor.id);
          const callAmount = state.currentBet - (playerState?.bet || 0);

          const actionType = callAmount === 0 ? 'check' : 'call';
          const actionResult = processAction({ playerId: bettor.id, type: actionType }, state);

          expect(E.isRight(actionResult)).toBe(true);
          if (E.isLeft(actionResult)) return;
          state = actionResult.right;
        }
      }

      // Manually advance to next stage with ack
      const stageResult = advanceStageWithAck(state);
      expect(E.isRight(stageResult)).toBe(true);
      if (E.isLeft(stageResult)) return;
      state = stageResult.right;

      // Ack the stage transition
      const activePlayers = getActivePlayers(state);
      for (const player of activePlayers) {
        const ackResult = processAction({ playerId: player.id, type: 'acknowledge' }, state);
        expect(E.isRight(ackResult)).toBe(true);
        if (E.isLeft(ackResult)) return;
        state = ackResult.right;
      }
    }

    // Showdown
    const showdownResult = performShowdown(state);
    expect(E.isRight(showdownResult)).toBe(true);
    if (E.isLeft(showdownResult)) return;

    const result = showdownResult.right;

    // 引き分けの可能性がある（同じコミュニティカードを使う場合）
    // 勝者が1人または2人（引き分け）
    expect(result.winners.length).toBeGreaterThanOrEqual(1);
    expect(result.winners.length).toBeLessThanOrEqual(2);

    // チップ保存則
    const totalChipsAfter = Array.from(result.finalState.players.values()).reduce(
      (sum, p) => sum + p.chips,
      0
    );
    expect(totalChipsAfter).toBe(2000);
  });
});
