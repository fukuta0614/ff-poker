/**
 * アクション処理関数（純粋関数）
 */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import type {
  GameState,
  GameError,
  PlayerId,
  Player,
  PlayerState,
  PlayerAction,
  ActionType,
} from './types';
import {
  getPlayer,
  getPlayerState,
  getCurrentBettor,
  calculateCallAmount,
  getValidActions,
} from './utils';

/**
 * フォールド処理
 */
export const executeFold = (
  playerId: PlayerId,
  state: GameState
): E.Either<GameError, GameState> => {
  return pipe(
    getPlayerState(playerId, state),
    O.fold(
      () =>
        E.left<GameError, GameState>({
          type: 'PlayerNotFound',
          playerId,
        }),
      (playerState) => {
        if (playerState.isFolded) {
          return E.left({
            type: 'PlayerAlreadyFolded',
            playerId,
          });
        }

        const newPlayerStates = new Map(state.playerStates);
        newPlayerStates.set(playerId, {
          ...playerState,
          isFolded: true,
          hasActed: true,
        });

        return E.right({
          ...state,
          playerStates: newPlayerStates,
        });
      }
    )
  );
};

/**
 * チェック処理
 */
export const executeCheck = (
  playerId: PlayerId,
  state: GameState
): E.Either<GameError, GameState> => {
  return pipe(
    getPlayerState(playerId, state),
    O.fold(
      () =>
        E.left<GameError, GameState>({
          type: 'PlayerNotFound',
          playerId,
        }),
      (playerState) => {
        if (playerState.isFolded) {
          return E.left({
            type: 'PlayerAlreadyFolded',
            playerId,
          });
        }

        const callAmount = calculateCallAmount(playerId, state);
        if (callAmount > 0) {
          return E.left({
            type: 'InvalidAction',
            action: 'check',
            reason: 'Cannot check when bet not settled',
          });
        }

        const newPlayerStates = new Map(state.playerStates);
        newPlayerStates.set(playerId, {
          ...playerState,
          hasActed: true,
        });

        return E.right({
          ...state,
          playerStates: newPlayerStates,
        });
      }
    )
  );
};

/**
 * コール処理
 */
export const executeCall = (
  playerId: PlayerId,
  state: GameState
): E.Either<GameError, GameState> => {
  return pipe(
    getPlayer(playerId, state),
    O.fold(
      () =>
        E.left<GameError, GameState>({
          type: 'PlayerNotFound',
          playerId,
        }),
      (player) => {
        const playerState = state.playerStates.get(playerId);
        if (!playerState) {
          return E.left({
            type: 'PlayerNotFound',
            playerId,
          });
        }

        if (playerState.isFolded) {
          return E.left({
            type: 'PlayerAlreadyFolded',
            playerId,
          });
        }

        const callAmount = calculateCallAmount(playerId, state);

        if (callAmount === 0) {
          return E.left({
            type: 'InvalidAction',
            action: 'call',
            reason: 'No amount to call, nothing to call',
          });
        }

        if (player.chips < callAmount) {
          return E.left({
            type: 'InsufficientChips',
            required: callAmount,
            available: player.chips,
          });
        }

        const newBet = playerState.bet + callAmount;
        const newPlayers = new Map(state.players);
        newPlayers.set(playerId, {
          ...player,
          chips: player.chips - callAmount,
        });

        const newPlayerStates = new Map(state.playerStates);
        newPlayerStates.set(playerId, {
          ...playerState,
          bet: newBet,
          cumulativeBet: playerState.cumulativeBet + callAmount,
          hasActed: true,
        });

        return E.right({
          ...state,
          players: newPlayers,
          playerStates: newPlayerStates,
          totalPot: state.totalPot + callAmount,
        });
      }
    )
  );
};

/**
 * レイズ処理
 */
export const executeRaise = (
  playerId: PlayerId,
  amount: number,
  state: GameState
): E.Either<GameError, GameState> => {
  return pipe(
    getPlayer(playerId, state),
    O.fold(
      () =>
        E.left<GameError, GameState>({
          type: 'PlayerNotFound',
          playerId,
        }),
      (player) => {
        const playerState = state.playerStates.get(playerId);
        if (!playerState) {
          return E.left({
            type: 'PlayerNotFound',
            playerId,
          });
        }

        if (playerState.isFolded) {
          return E.left({
            type: 'PlayerAlreadyFolded',
            playerId,
          });
        }

        if (player.chips < amount) {
          return E.left({
            type: 'InsufficientChips',
            required: amount,
            available: player.chips,
          });
        }

        const newTotalBet = playerState.bet + amount;
        const raiseAmount = newTotalBet - state.currentBet;

        // Check minimum raise (unless going all-in)
        if (
          raiseAmount < state.minRaiseAmount &&
          player.chips > amount
        ) {
          return E.left({
            type: 'InvalidBetAmount',
            amount: raiseAmount,
            minimum: state.minRaiseAmount,
          });
        }

        const newPlayers = new Map(state.players);
        newPlayers.set(playerId, {
          ...player,
          chips: player.chips - amount,
        });

        const newPlayerStates = new Map(state.playerStates);
        newPlayerStates.set(playerId, {
          ...playerState,
          bet: newTotalBet,
          cumulativeBet: playerState.cumulativeBet + amount,
          hasActed: true,
        });

        return E.right({
          ...state,
          players: newPlayers,
          playerStates: newPlayerStates,
          currentBet: newTotalBet,
          minRaiseAmount: raiseAmount,
          lastAggressorId: O.some(playerId),
          totalPot: state.totalPot + amount,
        });
      }
    )
  );
};

/**
 * オールイン処理
 */
export const executeAllIn = (
  playerId: PlayerId,
  state: GameState
): E.Either<GameError, GameState> => {
  return pipe(
    getPlayer(playerId, state),
    O.fold(
      () =>
        E.left<GameError, GameState>({
          type: 'PlayerNotFound',
          playerId,
        }),
      (player) => {
        const playerState = state.playerStates.get(playerId);
        if (!playerState) {
          return E.left({
            type: 'PlayerNotFound',
            playerId,
          });
        }

        if (playerState.isFolded) {
          return E.left({
            type: 'PlayerAlreadyFolded',
            playerId,
          });
        }

        if (player.chips === 0) {
          return E.left({
            type: 'InvalidAction',
            action: 'allin',
            reason: 'Player has no chips to go all-in',
          });
        }

        const allInAmount = player.chips;
        const newTotalBet = playerState.bet + allInAmount;

        const newPlayers = new Map(state.players);
        newPlayers.set(playerId, {
          ...player,
          chips: 0,
        });

        const newPlayerStates = new Map(state.playerStates);
        newPlayerStates.set(playerId, {
          ...playerState,
          bet: newTotalBet,
          cumulativeBet: playerState.cumulativeBet + allInAmount,
          hasActed: true,
        });

        // If all-in raises the bet, update current bet and aggressor
        if (newTotalBet > state.currentBet) {
          const raiseAmount = newTotalBet - state.currentBet;
          return E.right({
            ...state,
            players: newPlayers,
            playerStates: newPlayerStates,
            currentBet: newTotalBet,
            minRaiseAmount: Math.max(state.minRaiseAmount, raiseAmount),
            lastAggressorId: O.some(playerId),
            totalPot: state.totalPot + allInAmount,
          });
        }

        // All-in for less than current bet (doesn't raise)
        return E.right({
          ...state,
          players: newPlayers,
          playerStates: newPlayerStates,
          totalPot: state.totalPot + allInAmount,
        });
      }
    )
  );
};

/**
 * アクションを検証
 */
export const validateAction = (
  action: PlayerAction,
  state: GameState
): E.Either<GameError, void> => {
  // Check if it's the player's turn
  const currentBettor = getCurrentBettor(state);
  if (O.isNone(currentBettor)) {
    return E.left({
      type: 'PlayerNotFound',
      playerId: action.playerId,
    });
  }

  if (currentBettor.value.id !== action.playerId) {
    return E.left({
      type: 'InvalidTurn',
      playerId: action.playerId,
      expectedPlayerId: currentBettor.value.id,
    });
  }

  // Check if the action is valid for this player
  const validActions = getValidActions(action.playerId, state);
  if (!validActions.includes(action.type)) {
    return E.left({
      type: 'InvalidAction',
      action: action.type,
      reason: `Action ${action.type} is not valid for player ${action.playerId}`,
    });
  }

  return E.right(undefined);
};

/**
 * 次のアクティブなベッターのインデックスを見つける
 */
const findNextBettor = (
  startIndex: number,
  players: ReadonlyMap<PlayerId, Player>,
  playerStates: ReadonlyMap<PlayerId, PlayerState>
): number => {
  const playersArray = Array.from(players.values());
  const numPlayers = playersArray.length;

  let nextIndex = (startIndex + 1) % numPlayers;
  let attempts = 0;

  while (attempts < numPlayers) {
    const nextPlayer = playersArray[nextIndex];
    const nextPlayerState = playerStates.get(nextPlayer.id);

    if (nextPlayerState && !nextPlayerState.isFolded) {
      return nextIndex;
    }

    nextIndex = (nextIndex + 1) % numPlayers;
    attempts++;
  }

  // If no active player found, return startIndex
  return startIndex;
};

/**
 * プレイヤーアクションを処理
 */
export const processAction = (
  action: PlayerAction,
  state: GameState
): E.Either<GameError, GameState> => {
  // Validate action first
  const validation = validateAction(action, state);
  if (E.isLeft(validation)) {
    return validation;
  }

  // Execute the appropriate action
  let actionResult: E.Either<GameError, GameState>;

  switch (action.type) {
    case 'fold':
      actionResult = executeFold(action.playerId, state);
      break;

    case 'check':
      actionResult = executeCheck(action.playerId, state);
      break;

    case 'call':
      actionResult = executeCall(action.playerId, state);
      break;

    case 'raise':
      if (action.amount === undefined) {
        return E.left({
          type: 'InvalidAction',
          action: 'raise',
          reason: 'Raise action requires amount',
        });
      }
      actionResult = executeRaise(action.playerId, action.amount, state);
      break;

    case 'allin':
      actionResult = executeAllIn(action.playerId, state);
      break;

    default:
      return E.left({
        type: 'InvalidAction',
        action: action.type,
        reason: `Unknown action type: ${action.type}`,
      });
  }

  // If action failed, return the error
  if (E.isLeft(actionResult)) {
    return actionResult;
  }

  // Action succeeded, advance to next bettor
  const newState = actionResult.right;
  const nextBettorIndex = findNextBettor(
    state.currentBettorIndex,
    newState.players,
    newState.playerStates
  );

  return E.right({
    ...newState,
    currentBettorIndex: nextBettorIndex,
  });
};
