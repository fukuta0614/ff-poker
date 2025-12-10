/**
 * WebSocketイベント型定義（シンプル版）
 *
 * WebSocketは通知のみを送信。
 * 詳細なゲーム状態はREST API（GET /rooms/:roomId/state）で取得する。
 */

import type { PlayerId } from '@engine/types';

/**
 * クライアント→サーバーイベント
 */
export interface ClientToServerEvents {
  /**
   * ルームに参加
   */
  'room:join': (data: { roomId: string; playerId: PlayerId }) => void;

  /**
   * ルームから退出
   */
  'room:leave': (data: { roomId: string; playerId: PlayerId }) => void;
}

/**
 * サーバー→クライアントイベント
 */
export interface ServerToClientEvents {
  /**
   * ルーム状態更新通知
   * クライアントはこの通知を受け取ったら、REST APIでゲーム状態を取得する
   */
  'room:updated': (data: RoomUpdatedEventData) => void;

  /**
   * エラー通知
   */
  error: (data: ErrorEventData) => void;
}

/**
 * イベントデータ型定義
 */

export interface RoomUpdatedEventData {
  roomId: string;
  timestamp: string;
  updateType?: 'game_started' | 'action' | 'stage_advanced' | 'showdown' | 'player_joined' | 'player_left';
}

export interface ErrorEventData {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

/**
 * Socket.ioのサーバー型
 */
export interface InterServerEvents {
  // サーバー間通信用（現時点では未使用）
}

/**
 * Socket.ioのソケットデータ型
 */
export interface SocketData {
  roomId?: string;
  playerId?: PlayerId;
  playerName?: string;
}
