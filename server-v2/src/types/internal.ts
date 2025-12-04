/**
 * 内部型定義
 * OpenAPIスキーマとEngine型の橋渡し
 */

import { Player as EnginePlayer, PlayerId } from '@engine/types';

/**
 * ルームの状態
 */
export type RoomState = 'waiting' | 'in_progress' | 'ended';

/**
 * ルーム情報
 */
export interface Room {
  id: string;
  hostId: PlayerId;
  players: EnginePlayer[];
  state: RoomState;
  smallBlind: number;
  bigBlind: number;
  dealerIndex: number;
  createdAt: Date;
}

/**
 * プレイヤー作成用のパラメータ
 */
export interface CreatePlayerParams {
  name: string;
  chips: number;
  seat: number;
}
