/**
 * GameService - ビジネスロジック層
 *
 * 責務:
 * - Engine層の呼び出し
 * - Either型のエラーハンドリング
 * - トランザクション管理
 */

import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type {
  GameState,
  PlayerAction,
  GameError,
  ShowdownResult,
  PlayerId,
} from '@engine/types';
import {
  initializeRound,
  processAction,
  advanceStage,
  performShowdown,
  createRandomRNGState,
  isBettingComplete,
  getCurrentBettor,
} from '@engine/index';
import { GameManagerV2 } from '../managers/GameManager';

/**
 * GameService
 */
export class GameService {
  constructor(private gameManager: GameManagerV2) {}

  /**
   * ゲーム開始
   *
   * Engine層: initializeRound() を呼び出し
   */
  startGame(roomId: string): E.Either<GameError, GameState> {
    const room = this.gameManager.getRoom(roomId);
    if (!room) {
      return E.left({
        type: 'GameNotInProgress',
        currentStage: 'ended' as const,
      });
    }

    if (room.players.length < 2) {
      return E.left({
        type: 'NoActivePlayers',
      });
    }

    // Engine呼び出し: ゲーム初期化
    const rngState = createRandomRNGState();
    const result = initializeRound(
      room.players,
      room.dealerIndex,
      room.smallBlind,
      room.bigBlind,
      rngState
    );

    return pipe(
      result,
      E.map((gameState) => {
        // 状態を保存
        this.gameManager.setGameState(roomId, gameState);
        this.gameManager.setRoomState(roomId, 'in_progress');
        return gameState;
      })
    );
  }

  /**
   * プレイヤーアクション実行
   *
   * Engine層: processAction() を呼び出し
   */
  executeAction(
    roomId: string,
    action: PlayerAction
  ): E.Either<GameError, GameState> {
    const state = this.gameManager.getGameState(roomId);
    if (!state) {
      return E.left({
        type: 'GameNotInProgress',
        currentStage: 'ended' as const,
      });
    }

    // Engine呼び出し: アクション処理
    const result = processAction(action, state);

    return pipe(
      result,
      E.chain((newState) => {
        // 状態を保存
        this.gameManager.setGameState(roomId, newState);

        // ゲーム進行判定
        if (newState.stage === 'showdown' || newState.stage === 'ended') {
          // ショーダウン処理
          return this.handleShowdown(roomId, newState);
        } else if (isBettingComplete(newState)) {
          // ステージ進行
          return this.handleStageAdvance(roomId, newState);
        } else {
          // 次のターン（状態はそのまま）
          return E.right(newState);
        }
      })
    );
  }

  /**
   * ステージ進行
   *
   * Engine層: advanceStage() を呼び出し
   */
  private handleStageAdvance(
    roomId: string,
    state: GameState
  ): E.Either<GameError, GameState> {
    const result = advanceStage(state);

    return pipe(
      result,
      E.map((newState) => {
        this.gameManager.setGameState(roomId, newState);
        return newState;
      })
    );
  }

  /**
   * ショーダウン処理
   *
   * Engine層: performShowdown() を呼び出し
   */
  private handleShowdown(
    roomId: string,
    state: GameState
  ): E.Either<GameError, GameState> {
    const result = performShowdown(state);

    return pipe(
      result,
      E.map((showdownResult: ShowdownResult) => {
        const finalState = showdownResult.finalState;
        this.gameManager.setGameState(roomId, finalState);
        this.gameManager.setRoomState(roomId, 'ended');

        // プレイヤーのチップを更新
        this.updatePlayerChips(roomId, finalState);

        return finalState;
      })
    );
  }

  /**
   * プレイヤーのチップを更新
   */
  private updatePlayerChips(roomId: string, finalState: GameState): void {
    const room = this.gameManager.getRoom(roomId);
    if (!room) return;

    // GameStateからプレイヤーのチップ情報を取得して、Roomに反映
    finalState.players.forEach((player, playerId) => {
      const roomPlayer = room.players.find((p) => p.id === playerId);
      if (roomPlayer) {
        // プレイヤーのチップを更新（ミューテーション）
        // Note: ここは厳密にはイミュータブルではないが、
        // Roomオブジェクトは管理用のためミューテーションを許容
        Object.assign(roomPlayer, { chips: player.chips });
      }
    });
  }

  /**
   * ゲーム状態を取得（プレイヤー視点）
   *
   * 他のプレイヤーの手札を除外したGameStateを返す
   */
  getGameStateForPlayer(
    roomId: string,
    playerId: PlayerId
  ): E.Either<GameError, GameState> {
    const state = this.gameManager.getGameState(roomId);
    if (!state) {
      return E.left({
        type: 'GameNotInProgress',
        currentStage: 'ended' as const,
      });
    }

    // 他のプレイヤーの手札を隠す
    const filteredPlayerStates = new Map(state.playerStates);
    filteredPlayerStates.forEach((playerState, pid) => {
      if (pid !== playerId && O.isSome(playerState.hand)) {
        // 他のプレイヤーの手札をNoneに置き換え
        filteredPlayerStates.set(pid, {
          ...playerState,
          hand: O.none,
        });
      }
    });

    const filteredState: GameState = {
      ...state,
      playerStates: filteredPlayerStates,
    };

    return E.right(filteredState);
  }

  /**
   * 現在のベッターを取得
   */
  getCurrentBettorId(roomId: string): O.Option<PlayerId> {
    const state = this.gameManager.getGameState(roomId);
    if (!state) return O.none;

    const bettor = getCurrentBettor(state);
    return pipe(
      bettor,
      O.map((player) => player.id)
    );
  }
}
