/**
 * ゲーム初期化関数（純粋関数）
 */

import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import type {
  GameState,
  GameError,
  Player,
  PlayerState,
  PlayerId,
  Card,
  RNGState,
} from './types';
import { createDeck, shuffleDeck, dealCards } from './deck';
import {
  MIN_PLAYERS,
  HEADS_UP_PLAYER_COUNT,
  HOLE_CARD_COUNT,
  SMALL_BLIND_OFFSET,
  BIG_BLIND_OFFSET,
  UTG_OFFSET,
} from './constants';

/**
 * 新しいラウンドを初期化（純粋関数）
 * @param players - プレイヤー配列
 * @param dealerIndex - ディーラーのインデックス
 * @param smallBlind - スモールブラインド額
 * @param bigBlind - ビッグブラインド額
 * @param rngState - 乱数生成器の初期状態
 * @returns ゲーム状態またはエラー
 */
export const initializeRound = (
  players: readonly Player[],
  dealerIndex: number,
  smallBlind: number,
  bigBlind: number,
  rngState: RNGState
): E.Either<GameError, GameState> => {
  if (players.length < MIN_PLAYERS) {
    return E.left({
      type: 'InvalidAction',
      action: 'raise',
      reason: `At least ${MIN_PLAYERS} players required to start a round`,
    });
  }

  // Validate dealerIndex
  if (dealerIndex < 0 || dealerIndex >= players.length) {
    return E.left({
      type: 'InvalidAction',
      action: 'raise',
      reason: `Invalid dealer index: ${dealerIndex}. Must be between 0 and ${players.length - 1}`,
    });
  }

  // 1. デッキを作成してシャッフル
  const { shuffledDeck: deck, nextRngState: deckRngState } = shuffleDeck(createDeck(), rngState);

  // 2. プレイヤーマップを作成
  const playersMap = new Map(players.map((p) => [p.id, p]));

  // 3. ホールカードをディール
  const holeCardsResult = dealHoleCards(playersMap, deck);
  if (E.isLeft(holeCardsResult)) {
    return holeCardsResult;
  }

  const { playerStates, remainingDeck } = holeCardsResult.right;

  // 4. ブラインドを徴収
  const blindsResult = collectBlinds(playersMap, dealerIndex, smallBlind, bigBlind);
  if (E.isLeft(blindsResult)) {
    return blindsResult;
  }

  const {
    players: playersAfterBlinds,
    playerStates: playerStatesAfterBlinds,
    totalPot,
  } = blindsResult.right;

  // 5. プレイヤー状態をマージ（ホールカード + ブラインド）
  const mergedPlayerStates = new Map<PlayerId, PlayerState>();
  playerStatesAfterBlinds.forEach((blindState, playerId) => {
    const holeCardState = playerStates.get(playerId);
    if (holeCardState) {
      mergedPlayerStates.set(playerId, {
        ...blindState,
        hand: holeCardState.hand,
      });
    }
  });

  // 6. 最初のベッターを決定
  const numPlayers = players.length;
  let firstBettorIndex: number;

  if (numPlayers === HEADS_UP_PLAYER_COUNT) {
    // ヘッズアップ: ディーラー（SB）が最初に行動
    firstBettorIndex = dealerIndex;
  } else {
    // 3人以上: ビッグブラインドの次のプレイヤー
    firstBettorIndex = (dealerIndex + UTG_OFFSET) % numPlayers;
  }

  return E.right({
    players: playersAfterBlinds,
    playerStates: mergedPlayerStates,
    stage: 'preflop',
    dealerIndex,
    currentBettorIndex: firstBettorIndex,
    deck: remainingDeck,
    communityCards: [],
    currentBet: bigBlind,
    minRaiseAmount: bigBlind,
    lastAggressorId: O.none,
    pots: [],
    totalPot,
    rngState: deckRngState, // シャッフル後のRNG状態を保持
    waitingForAck: false, // 初期状態では ack 待ちではない
    ackState: O.none, // 初期状態では ackState は None
  });
};

/**
 * ブラインドを徴収
 */
export const collectBlinds = (
  players: ReadonlyMap<PlayerId, Player>,
  dealerIndex: number,
  smallBlind: number,
  bigBlind: number
): E.Either<
  GameError,
  {
    players: ReadonlyMap<PlayerId, Player>;
    playerStates: ReadonlyMap<PlayerId, PlayerState>;
    totalPot: number;
  }
> => {
  const playersArray = Array.from(players.values());
  const numPlayers = playersArray.length;

  let sbIndex: number;
  let bbIndex: number;

  if (numPlayers === HEADS_UP_PLAYER_COUNT) {
    // Heads-up: dealer is SB, other player is BB
    sbIndex = dealerIndex;
    bbIndex = (dealerIndex + 1) % numPlayers;
  } else {
    // 3+ players: normal blinds
    sbIndex = (dealerIndex + SMALL_BLIND_OFFSET) % numPlayers;
    bbIndex = (dealerIndex + BIG_BLIND_OFFSET) % numPlayers;
  }

  const sbPlayer = playersArray[sbIndex];
  const bbPlayer = playersArray[bbIndex];

  // Small blind amount (all-in if not enough chips)
  const sbAmount = Math.min(smallBlind, sbPlayer.chips);
  // Big blind amount (all-in if not enough chips)
  const bbAmount = Math.min(bigBlind, bbPlayer.chips);

  const newPlayers = new Map(players);
  newPlayers.set(sbPlayer.id, {
    ...sbPlayer,
    chips: sbPlayer.chips - sbAmount,
  });
  newPlayers.set(bbPlayer.id, {
    ...bbPlayer,
    chips: bbPlayer.chips - bbAmount,
  });

  const playerStates = new Map<PlayerId, PlayerState>();

  // Initialize all player states
  players.forEach((player) => {
    playerStates.set(player.id, {
      bet: 0,
      cumulativeBet: 0,
      isFolded: false,
      hasActed: false,
      hand: O.none,
    });
  });

  // Set blinds
  playerStates.set(sbPlayer.id, {
    bet: sbAmount,
    cumulativeBet: sbAmount,
    isFolded: false,
    hasActed: false,
    hand: O.none,
  });

  playerStates.set(bbPlayer.id, {
    bet: bbAmount,
    cumulativeBet: bbAmount,
    isFolded: false,
    hasActed: false,
    hand: O.none,
  });

  return E.right({
    players: newPlayers,
    playerStates,
    totalPot: sbAmount + bbAmount,
  });
};

/**
 * ホールカードをディール
 */
export const dealHoleCards = (
  players: ReadonlyMap<PlayerId, Player>,
  deck: readonly Card[]
): E.Either<
  GameError,
  {
    playerStates: ReadonlyMap<PlayerId, PlayerState>;
    remainingDeck: readonly Card[];
  }
> => {
  const numPlayers = players.size;
  const cardsNeeded = numPlayers * 2;

  if (deck.length < cardsNeeded) {
    return E.left({
      type: 'InsufficientCards',
      required: cardsNeeded,
      available: deck.length,
    });
  }

  const playerStates = new Map<PlayerId, PlayerState>();
  let currentDeck = deck;

  // Use for-of loop instead of forEach to properly propagate errors
  for (const player of players.values()) {
    try {
      const { dealtCards, remainingDeck } = dealCards(currentDeck, HOLE_CARD_COUNT);

      playerStates.set(player.id, {
        bet: 0,
        cumulativeBet: 0,
        isFolded: false,
        hasActed: false,
        hand: O.some([dealtCards[0], dealtCards[1]] as [Card, Card]),
      });

      currentDeck = remainingDeck;
    } catch (error) {
      // Should not happen as we checked deck length
      return E.left({
        type: 'InsufficientCards',
        required: HOLE_CARD_COUNT,
        available: currentDeck.length,
      });
    }
  }

  return E.right({
    playerStates,
    remainingDeck: currentDeck,
  });
};

/**
 * 新しいストリート用にベットをリセット
 */
export const resetForNewStreet = (
  playerStates: ReadonlyMap<PlayerId, PlayerState>
): ReadonlyMap<PlayerId, PlayerState> => {
  const newPlayerStates = new Map<PlayerId, PlayerState>();

  playerStates.forEach((state, playerId) => {
    newPlayerStates.set(playerId, {
      ...state,
      bet: 0,
      hasActed: false,
    });
  });

  return newPlayerStates;
};

/**
 * 次のベッターに進む
 */
export const advanceBettor = (
  currentIndex: number,
  numPlayers: number
): number => {
  return (currentIndex + 1) % numPlayers;
};
