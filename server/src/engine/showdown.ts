/**
 * ショーダウン処理（純粋関数型）
 */

import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import type {
  GameState,
  GameError,
  Pot,
  WinnerInfo,
  ShowdownResult,
  PlayerId,
  Player,
  HandEvaluation,
} from './types';
import { evaluateHand, compareHands } from './hand-evaluator';
import { calculatePots } from './pot';

/**
 * 各ポットの勝者を決定
 * @param state ゲーム状態
 * @param pots ポット配列
 * @returns Either<GameError, WinnerInfo[]>
 */
export function determineWinners(
  state: GameState,
  pots: readonly Pot[]
): E.Either<GameError, readonly WinnerInfo[]> {
  const allWinners: WinnerInfo[] = [];

  // 各ポットごとに勝者を決定
  for (let potIndex = 0; potIndex < pots.length; potIndex++) {
    const pot = pots[potIndex];

    // ポットに参加しているプレイヤーのハンドを評価
    const playerEvaluations: Array<{
      playerId: PlayerId;
      hand: readonly [string, string];
      evaluation: HandEvaluation;
    }> = [];

    for (const playerId of pot.eligiblePlayers) {
      const playerState = state.playerStates.get(playerId);
      if (!playerState) {
        return E.left({
          type: 'PlayerNotFound',
          playerId,
        });
      }

      // ハンドの取得
      const handOption = playerState.hand;
      if (O.isNone(handOption)) {
        return E.left({
          type: 'MissingHand',
          playerId,
          stage: state.stage,
        });
      }

      const hand = handOption.value;

      // ハンドを評価
      const evaluationResult = evaluateHand(hand, state.communityCards);
      if (E.isLeft(evaluationResult)) {
        return evaluationResult;
      }

      playerEvaluations.push({
        playerId,
        hand,
        evaluation: evaluationResult.right,
      });
    }

    // 最も強いハンドを見つける
    if (playerEvaluations.length === 0) {
      continue;
    }

    // ハンドの強さでソート（降順 = 強い順）
    // compareHandsは、hand1が強ければ1、hand2が強ければ-1を返す
    // 降順ソートにするには compareHands(b, a) を使う
    playerEvaluations.sort((a, b) =>
      compareHands(b.evaluation, a.evaluation)
    );

    // 最強のハンド
    const bestEvaluation = playerEvaluations[0].evaluation;

    // 同じ強さのハンドを持つプレイヤーを見つける（引き分け処理）
    const winners = playerEvaluations.filter(
      (pe) => compareHands(pe.evaluation, bestEvaluation) === 0
    );

    // ポット金額を勝者で分配
    const amountPerWinner = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount % winners.length;

    // 余りの配分: ポーカールールに従い、ディーラーボタンに最も近い位置(最も早いシート)のプレイヤーに配分
    // シート順でソート
    const sortedWinners = [...winners].sort((a, b) => {
      const playerA = state.players.get(a.playerId);
      const playerB = state.players.get(b.playerId);
      if (!playerA || !playerB) return 0;
      return playerA.seat - playerB.seat;
    });

    sortedWinners.forEach((winner, index) => {
      // 余りは最初の勝者(最も早いシート)に配分
      const amount = index === 0 ? amountPerWinner + remainder : amountPerWinner;

      allWinners.push({
        playerId: winner.playerId,
        hand: winner.hand,
        evaluation: winner.evaluation,
        potIndex,
        amount,
      });
    });
  }

  return E.right(allWinners);
}

/**
 * 勝者にチップを分配して新しいGameStateを返す
 * @param state ゲーム状態
 * @param winners 勝者情報配列
 * @returns 新しいGameState
 */
export function distributeWinnings(
  state: GameState,
  winners: readonly WinnerInfo[]
): GameState {
  // プレイヤーマップをコピー
  const newPlayers = new Map<PlayerId, Player>();

  for (const [playerId, player] of state.players) {
    newPlayers.set(playerId, { ...player });
  }

  // 各勝者にチップを加算
  for (const winner of winners) {
    const player = newPlayers.get(winner.playerId);
    if (player) {
      newPlayers.set(winner.playerId, {
        ...player,
        chips: player.chips + winner.amount,
      });
    }
  }

  // 新しいGameStateを返す
  return {
    ...state,
    players: newPlayers,
    stage: 'ended',
  };
}

/**
 * ショーダウン全体を実行
 * @param state ゲーム状態
 * @returns Either<GameError, ShowdownResult>
 */
export function performShowdown(
  state: GameState
): E.Either<GameError, ShowdownResult> {
  // ステージチェック
  if (state.stage !== 'showdown') {
    return E.left({
      type: 'InvalidStage',
      expected: 'showdown',
      actual: state.stage,
    });
  }

  // ポット計算（まだ計算されていない場合）
  const pots = state.pots.length > 0 ? state.pots : calculatePots(state);

  // 勝者決定
  const winnersResult = determineWinners(state, pots);

  return pipe(
    winnersResult,
    E.map((winners) => {
      // チップ分配
      const finalState = distributeWinnings(state, winners);

      return {
        winners,
        pots,
        finalState,
      };
    })
  );
}
