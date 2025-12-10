/**
 * WebSocketハンドラー（シンプル版）
 *
 * 責務:
 * - Socket.io接続・切断イベントの処理
 * - ルーム参加/退出の管理
 */

import { Server, Socket } from 'socket.io';
import type { PlayerId } from '@engine/types';
import { GameManagerV2 } from '../managers/GameManager';
import { GameNotifier } from './notifier';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './events';

/**
 * WebSocketハンドラーの初期化
 */
export function setupWebSocketHandler(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  gameManager: GameManagerV2,
  notifier: GameNotifier
): void {
  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // ルーム参加イベント
    socket.on('room:join', (data) => {
      handleRoomJoin(socket, data, gameManager, notifier);
    });

    // ルーム退出イベント
    socket.on('room:leave', (data) => {
      handleRoomLeave(socket, data, notifier);
    });

    // 切断イベント
    socket.on('disconnect', () => {
      handleDisconnect(socket, notifier);
    });
  });
}

/**
 * ルーム参加処理
 */
function handleRoomJoin(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: { roomId: string; playerId: PlayerId },
  gameManager: GameManagerV2,
  notifier: GameNotifier
): void {
  const { roomId, playerId } = data;

  // ルームの存在確認
  const room = gameManager.getRoom(roomId);
  if (!room) {
    notifier.notifyError(socket.id, 'ROOM_NOT_FOUND', `Room ${roomId} not found`);
    return;
  }

  // プレイヤーの存在確認
  const player = room.players.find((p) => p.id === playerId);
  if (!player) {
    notifier.notifyError(
      socket.id,
      'PLAYER_NOT_FOUND',
      `Player ${playerId} not found in room ${roomId}`
    );
    return;
  }

  // Socket.ioのルームに参加
  socket.join(roomId);

  // ソケットデータに保存
  socket.data.roomId = roomId;
  socket.data.playerId = playerId;
  socket.data.playerName = player.name;

  // プレイヤーとソケットのマッピング
  notifier.setPlayerSocket(playerId, socket.id);

  console.log(`[WebSocket] Player ${playerId} (${player.name}) joined room ${roomId}`);

  // ルーム内の全プレイヤーに通知
  notifier.notifyRoomUpdated(roomId, 'player_joined');
}

/**
 * ルーム退出処理
 */
function handleRoomLeave(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  data: { roomId: string; playerId: PlayerId },
  notifier: GameNotifier
): void {
  const { roomId, playerId } = data;

  // Socket.ioのルームから退出
  socket.leave(roomId);

  // ソケットデータをクリア
  const playerName = socket.data.playerName || 'Unknown';
  socket.data.roomId = undefined;
  socket.data.playerId = undefined;
  socket.data.playerName = undefined;

  // プレイヤーとソケットのマッピング削除
  notifier.removePlayerSocket(playerId);

  console.log(`[WebSocket] Player ${playerId} (${playerName}) left room ${roomId}`);

  // ルーム内の全プレイヤーに通知
  notifier.notifyRoomUpdated(roomId, 'player_left');
}

/**
 * 切断処理
 */
function handleDisconnect(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  notifier: GameNotifier
): void {
  const { roomId, playerId, playerName } = socket.data;

  if (roomId && playerId) {
    console.log(`[WebSocket] Player ${playerId} (${playerName}) disconnected from room ${roomId}`);

    // プレイヤーとソケットのマッピング削除
    notifier.removePlayerSocket(playerId);

    // Note: 切断時はルーム内のプレイヤーリストからは削除しない
    // 再接続を許可するため、プレイヤー情報は保持する
  }

  console.log(`[WebSocket] Client disconnected: ${socket.id}`);
}
