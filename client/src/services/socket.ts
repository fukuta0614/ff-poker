/**
 * FF Poker WebSocket Client
 * Socket.io通知受信を担当するサービス層
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ============================================
// Event Types
// ============================================

export type UpdateType =
  | 'game_started'
  | 'action'
  | 'stage_advanced'
  | 'showdown'
  | 'player_joined'
  | 'player_left';

export interface RoomUpdatedEvent {
  roomId: string;
  updateType: UpdateType;
  timestamp: string;
}

export interface ErrorEvent {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export type RoomUpdatedHandler = (event: RoomUpdatedEvent) => void;
export type ErrorHandler = (event: ErrorEvent) => void;

// ============================================
// Socket Client Class
// ============================================

export class SocketClient {
  private socket: Socket | null = null;
  private roomId: string | null = null;

  /**
   * Socket.io接続
   */
  connect(): Socket {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    return this.socket;
  }

  /**
   * ルームに参加(Socket.io room join)
   */
  joinRoom(roomId: string, playerId: string): void {
    if (!this.socket) {
      throw new Error('Socket not connected. Call connect() first.');
    }

    this.roomId = roomId;
    this.socket.emit('room:join', { roomId, playerId });
    console.log(`📍 Joined room: ${roomId} as player: ${playerId}`);
  }

  /**
   * ルームから退出
   */
  leaveRoom(roomId: string, playerId: string): void {
    if (!this.socket) {
      return;
    }

    this.socket.emit('room:leave', { roomId, playerId });
    this.roomId = null;
    console.log(`📍 Left room: ${roomId}`);
  }

  /**
   * room:updated イベントリスナー登録
   */
  onRoomUpdated(handler: RoomUpdatedHandler): () => void {
    if (!this.socket) {
      throw new Error('Socket not connected. Call connect() first.');
    }

    this.socket.on('room:updated', handler);

    // クリーンアップ関数を返す
    return () => {
      this.socket?.off('room:updated', handler);
    };
  }

  /**
   * error イベントリスナー登録
   */
  onError(handler: ErrorHandler): () => void {
    if (!this.socket) {
      throw new Error('Socket not connected. Call connect() first.');
    }

    this.socket.on('error', handler);

    return () => {
      this.socket?.off('error', handler);
    };
  }

  /**
   * 接続解除
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.roomId = null;
      console.log('🔌 WebSocket disconnected');
    }
  }

  /**
   * 接続状態確認
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * 現在のルームID取得
   */
  getCurrentRoomId(): string | null {
    return this.roomId;
  }
}

// ============================================
// Singleton Export
// ============================================

export const socketClient = new SocketClient();
