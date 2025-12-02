/**
 * 純粋関数型乱数生成器（Linear Congruential Generator）
 *
 * すべての関数が純粋で、同じシードから常に同じ乱数列を生成します。
 * これにより、ゲームの完全な再現性とテスト可能性が保証されます。
 */

import type { RNGState, RNGResult } from './types';

// LCGパラメータ（Numerical Recipesより）
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 0x100000000; // 2^32

/**
 * シード値からRNG状態を作成
 * @param seed - 初期シード値（整数）
 * @returns RNG状態
 */
export const createRNGState = (seed: number): RNGState => {
  // シードを32ビット符号なし整数に正規化
  const normalizedSeed = Math.abs(Math.floor(seed)) % LCG_M;
  return { seed: normalizedSeed };
};

/**
 * 現在時刻からランダムなシードを生成
 * @returns RNG状態
 *
 * 注意: この関数は非純粋です（Date.now()を使用）
 * 本番環境でのみ使用し、テストでは明示的なシードを使用してください
 */
export const createRandomRNGState = (): RNGState => {
  return createRNGState(Date.now());
};

/**
 * 次の乱数を生成（純粋関数）
 * @param state - 現在のRNG状態
 * @returns 乱数（0以上1未満）と次のRNG状態
 */
export const nextRandom = (state: RNGState): RNGResult => {
  // 線形合同法: seed' = (a * seed + c) mod m
  const nextSeed = (LCG_A * state.seed + LCG_C) % LCG_M;

  // 0以上1未満の浮動小数点数に変換
  const value = nextSeed / LCG_M;

  return {
    value,
    nextState: { seed: nextSeed },
  };
};

/**
 * 指定範囲の整数乱数を生成（純粋関数）
 * @param state - 現在のRNG状態
 * @param min - 最小値（含む）
 * @param max - 最大値（含まない）
 * @returns 整数乱数と次のRNG状態
 */
export const nextInt = (
  state: RNGState,
  min: number,
  max: number
): { value: number; nextState: RNGState } => {
  const result = nextRandom(state);
  const range = max - min;
  const value = Math.floor(result.value * range) + min;

  return {
    value,
    nextState: result.nextState,
  };
};

/**
 * 配列からランダムに要素を選択（純粋関数）
 * @param state - 現在のRNG状態
 * @param array - 配列
 * @returns 選択された要素、そのインデックス、次のRNG状態
 */
export const randomChoice = <T>(
  state: RNGState,
  array: readonly T[]
): { value: T; index: number; nextState: RNGState } => {
  if (array.length === 0) {
    throw new Error('Cannot choose from empty array');
  }

  const result = nextInt(state, 0, array.length);

  return {
    value: array[result.value],
    index: result.value,
    nextState: result.nextState,
  };
};
