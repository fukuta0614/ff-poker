/**
 * ステージ遷移関数（純粋関数）
 */

import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import type { GameState, GameError } from './types';
import { dealCards } from './deck';
import { resetForNewStreet } from './game-init';
import { getActivePlayers } from './utils';
import {
  BURN_CARD_COUNT,
  FLOP_CARD_COUNT,
  TURN_CARD_COUNT,
  RIVER_CARD_COUNT,
  SMALL_BLIND_OFFSET,
} from './constants';

/**
 * フロップをディール（バーンカード1枚 + 3枚のコミュニティカード）
 */
export const dealFlop = (state: GameState): E.Either<GameError, GameState> => {
  if (state.stage !== 'preflop') {
    return E.left({
      type: 'InvalidStage',
      expected: 'preflop',
      actual: state.stage,
    });
  }

  // バーンカード1枚 + フロップ3枚 = 4枚必要
  const cardsNeeded = BURN_CARD_COUNT + FLOP_CARD_COUNT;
  if (state.deck.length < cardsNeeded) {
    return E.left({
      type: 'InsufficientCards',
      required: cardsNeeded,
      available: state.deck.length,
    });
  }

  try {
    // バーンカード1枚をスキップ
    const afterBurn = dealCards(state.deck, BURN_CARD_COUNT);
    // フロップ3枚をディール
    const flopResult = dealCards(afterBurn.remainingDeck, FLOP_CARD_COUNT);

    // ベットをリセット
    const newPlayerStates = resetForNewStreet(state.playerStates);

    // 最初のベッターを決定
    const numPlayers = state.players.size;
    let firstBettorIndex: number;

    if (numPlayers === 2) {
      // ヘッズアップ: BB（ディーラーの次）が先に行動
      firstBettorIndex = (state.dealerIndex + 1) % numPlayers;
    } else {
      // 3人以上: SB（ディーラーの次）が先に行動
      firstBettorIndex = (state.dealerIndex + SMALL_BLIND_OFFSET) % numPlayers;
    }

    return E.right({
      ...state,
      stage: 'flop',
      deck: flopResult.remainingDeck,
      communityCards: [...state.communityCards, ...flopResult.dealtCards],
      playerStates: newPlayerStates,
      currentBet: 0,
      currentBettorIndex: firstBettorIndex,
      waitingForAck: false,
      ackState: O.none,
    });
  } catch (error) {
    return E.left({
      type: 'InsufficientCards',
      required: cardsNeeded,
      available: state.deck.length,
    });
  }
};

/**
 * ターンをディール（バーンカード1枚 + 1枚のコミュニティカード）
 */
export const dealTurn = (state: GameState): E.Either<GameError, GameState> => {
  if (state.stage !== 'flop') {
    return E.left({
      type: 'InvalidStage',
      expected: 'flop',
      actual: state.stage,
    });
  }

  // バーンカード1枚 + ターン1枚 = 2枚必要
  const cardsNeeded = BURN_CARD_COUNT + TURN_CARD_COUNT;
  if (state.deck.length < cardsNeeded) {
    return E.left({
      type: 'InsufficientCards',
      required: cardsNeeded,
      available: state.deck.length,
    });
  }

  try {
    // バーンカード1枚をスキップ
    const afterBurn = dealCards(state.deck, BURN_CARD_COUNT);
    // ターン1枚をディール
    const turnResult = dealCards(afterBurn.remainingDeck, TURN_CARD_COUNT);

    // ベットをリセット
    const newPlayerStates = resetForNewStreet(state.playerStates);

    // 最初のベッターを決定
    const numPlayers = state.players.size;
    let firstBettorIndex: number;

    if (numPlayers === 2) {
      // ヘッズアップ: BB（ディーラーの次）が先に行動
      firstBettorIndex = (state.dealerIndex + 1) % numPlayers;
    } else {
      // 3人以上: SB（ディーラーの次）が先に行動
      firstBettorIndex = (state.dealerIndex + SMALL_BLIND_OFFSET) % numPlayers;
    }

    return E.right({
      ...state,
      stage: 'turn',
      deck: turnResult.remainingDeck,
      communityCards: [...state.communityCards, ...turnResult.dealtCards],
      playerStates: newPlayerStates,
      currentBet: 0,
      currentBettorIndex: firstBettorIndex,
      waitingForAck: false,
      ackState: O.none,
    });
  } catch (error) {
    return E.left({
      type: 'InsufficientCards',
      required: cardsNeeded,
      available: state.deck.length,
    });
  }
};

/**
 * リバーをディール（バーンカード1枚 + 1枚のコミュニティカード）
 */
export const dealRiver = (state: GameState): E.Either<GameError, GameState> => {
  if (state.stage !== 'turn') {
    return E.left({
      type: 'InvalidStage',
      expected: 'turn',
      actual: state.stage,
    });
  }

  // バーンカード1枚 + リバー1枚 = 2枚必要
  const cardsNeeded = BURN_CARD_COUNT + RIVER_CARD_COUNT;
  if (state.deck.length < cardsNeeded) {
    return E.left({
      type: 'InsufficientCards',
      required: cardsNeeded,
      available: state.deck.length,
    });
  }

  try {
    // バーンカード1枚をスキップ
    const afterBurn = dealCards(state.deck, BURN_CARD_COUNT);
    // リバー1枚をディール
    const riverResult = dealCards(afterBurn.remainingDeck, RIVER_CARD_COUNT);

    // ベットをリセット
    const newPlayerStates = resetForNewStreet(state.playerStates);

    // 最初のベッターを決定
    const numPlayers = state.players.size;
    let firstBettorIndex: number;

    if (numPlayers === 2) {
      // ヘッズアップ: BB（ディーラーの次）が先に行動
      firstBettorIndex = (state.dealerIndex + 1) % numPlayers;
    } else {
      // 3人以上: SB（ディーラーの次）が先に行動
      firstBettorIndex = (state.dealerIndex + SMALL_BLIND_OFFSET) % numPlayers;
    }

    return E.right({
      ...state,
      stage: 'river',
      deck: riverResult.remainingDeck,
      communityCards: [...state.communityCards, ...riverResult.dealtCards],
      playerStates: newPlayerStates,
      currentBet: 0,
      currentBettorIndex: firstBettorIndex,
      waitingForAck: false,
      ackState: O.none,
    });
  } catch (error) {
    return E.left({
      type: 'InsufficientCards',
      required: cardsNeeded,
      available: state.deck.length,
    });
  }
};

/**
 * 次のステージに進む
 */
export const advanceStage = (
  state: GameState
): E.Either<GameError, GameState> => {
  switch (state.stage) {
    case 'preflop':
      return dealFlop(state);

    case 'flop':
      return dealTurn(state);

    case 'turn':
      return dealRiver(state);

    case 'river':
      // Riverの後はshowdownに進む（実際のshowdown処理は別関数で）
      return E.right({
        ...state,
        stage: 'showdown',
        waitingForAck: false,
        ackState: O.none,
      });

    case 'showdown':
    case 'ended':
      return E.left({
        type: 'InvalidStage',
        expected: 'preflop',
        actual: state.stage,
      });

    default:
      return E.left({
        type: 'InvalidStage',
        expected: 'preflop',
        actual: state.stage,
      });
  }
};

/**
 * ステージを進め、ack 待ち状態にする
 */
export const advanceStageWithAck = (
  state: GameState
): E.Either<GameError, GameState> => {
  // 既存の advanceStage を呼ぶ
  const result = advanceStage(state);

  if (E.isLeft(result)) {
    return result;
  }

  const newState = result.right;

  // 新しいステージでも ack 待ち状態にする
  const activePlayers = getActivePlayers(newState);

  return E.right({
    ...newState,
    waitingForAck: true,
    ackState: O.some({
      expectedAcks: new Set(activePlayers.map((p) => p.id)),
      receivedAcks: new Set(),
      startedAt: Date.now(),
      description: `Stage advanced to ${newState.stage}`,
      type: 'stage_transition',
    }),
  });
};

/**
 * 全員オールイン時：残りのコミュニティカードを一気に配り、ショーダウンへ
 *
 * この関数は、全てのアクティブプレイヤーがオールイン（chips === 0）の場合に使用
 * 通常のステージ進行をスキップし、直接ショーダウンまで進む
 */
export const advanceToShowdownForAllIn = (
  state: GameState
): E.Either<GameError, GameState> => {
  let currentState = state;

  // 現在のステージから残りのカードを配る
  switch (currentState.stage) {
    case 'preflop': {
      // Flop → Turn → River を順次配る
      const flopResult = dealFlop(currentState);
      if (E.isLeft(flopResult)) {
        return flopResult;
      }
      currentState = flopResult.right;

      const turnResult = dealTurn(currentState);
      if (E.isLeft(turnResult)) {
        return turnResult;
      }
      currentState = turnResult.right;

      const riverResult = dealRiver(currentState);
      if (E.isLeft(riverResult)) {
        return riverResult;
      }
      currentState = riverResult.right;
      break;
    }

    case 'flop': {
      // Turn → River を順次配る
      const turnResult = dealTurn(currentState);
      if (E.isLeft(turnResult)) {
        return turnResult;
      }
      currentState = turnResult.right;

      const riverResult = dealRiver(currentState);
      if (E.isLeft(riverResult)) {
        return riverResult;
      }
      currentState = riverResult.right;
      break;
    }

    case 'turn': {
      // River を配る
      const riverResult = dealRiver(currentState);
      if (E.isLeft(riverResult)) {
        return riverResult;
      }
      currentState = riverResult.right;
      break;
    }

    case 'river':
      // すでに River なのでそのまま
      break;

    case 'showdown':
    case 'ended':
      return E.left({
        type: 'InvalidStage',
        expected: 'preflop',
        actual: state.stage,
      });

    default:
      return E.left({
        type: 'InvalidStage',
        expected: 'preflop',
        actual: state.stage,
      });
  }

  // ショーダウンステージに設定
  return E.right({
    ...currentState,
    stage: 'showdown',
    waitingForAck: false,
    ackState: O.none,
  });
};
