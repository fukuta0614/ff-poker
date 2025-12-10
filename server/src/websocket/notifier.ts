/**
 * GameNotifier - WebSocket通知サービス（シンプル版）
 *
 * 責務:
 * - ルーム更新通知のみを送信
 * - 詳細なゲーム状態はREST APIで取得させる
 */

import { Server } from 'socket.io';
import type { PlayerId } from '@engine/types';
import type {
  ServerToClientEvents,
  RoomUpdatedEventData,
  ErrorEventData,
} from './events';

type UpdateType = RoomUpdatedEventData['updateType'];

/**
 * GameNotifier
 *
 * Socket.ioを使用してルーム更新をクライアントに通知する
 */
export class GameNotifier {
  private playerSocketMap: Map<PlayerId, string> = new Map();

  constructor(private io: Server) {}

  /**
   * ルーム更新通知（汎用）
   *
   * クライアントはこの通知を受け取ったら、REST APIで最新の状態を取得する
   */
  notifyRoomUpdated(roomId: string, updateType?: UpdateType): void {
    const data: RoomUpdatedEventData = {
      roomId,
      timestamp: new Date().toISOString(),
      updateType,
    };
    this.io.to(roomId).emit('room:updated', data);
  }

  /**
   * エラー通知（特定のソケットに送信）
   */
  notifyError(socketId: string, code: string, message: string, details?: unknown): void {
    const data: ErrorEventData = {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
    this.io.to(socketId).emit('error', data);
  }

  /**
   * 特定のプレイヤーにのみ通知
   */
  notifyToPlayer<K extends keyof ServerToClientEvents>(
    playerId: PlayerId,
    event: K,
    data: Parameters<ServerToClientEvents[K]>[0]
  ): void {
    const socketId = this.playerSocketMap.get(playerId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  /**
   * プレイヤーとソケットIDのマッピングを設定
   */
  setPlayerSocket(playerId: PlayerId, socketId: string): void {
    this.playerSocketMap.set(playerId, socketId);
  }

  /**
   * プレイヤーとソケットIDのマッピングを削除
   */
  removePlayerSocket(playerId: PlayerId): void {
    this.playerSocketMap.delete(playerId);
  }

  /**
   * プレイヤーのソケットIDを取得
   */
  getPlayerSocketId(playerId: PlayerId): string | undefined {
    return this.playerSocketMap.get(playerId);
  }
}
