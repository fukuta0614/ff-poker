/**
 * Socket.io イベントハンドラ
 */

import { Server, Socket } from 'socket.io';
import { GameManager } from '../game/GameManager';
import {
  JoinRoomData,
  StartGameData,
  ActionData,
  ChatMessageData,
} from '../types/socket';

export const setupSocketHandlers = (io: Server, gameManager: GameManager): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ルーム作成（簡易版）
    socket.on('createRoom', (data: { hostName: string; smallBlind: number; bigBlind: number }) => {
      try {
        const room = gameManager.createRoom(data.hostName, data.smallBlind, data.bigBlind);

        socket.emit('roomCreated', {
          roomId: room.id,
          hostId: room.hostId,
        });

        console.log(`Room created: ${room.id}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to create room', code: 'CREATE_ROOM_ERROR' });
      }
    });

    // ルーム参加
    socket.on('joinRoom', (data: JoinRoomData) => {
      try {
        const room = gameManager.getRoom(data.roomId);

        if (!room) {
          socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
          return;
        }

        // socketをルームに参加させる
        socket.join(data.roomId);

        // 参加通知
        socket.emit('joinedRoom', {
          roomId: data.roomId,
          playerName: data.playerName,
        });

        // ルームの他のメンバーに通知
        socket.to(data.roomId).emit('playerJoined', {
          playerName: data.playerName,
        });

        console.log(`${data.playerName} joined room: ${data.roomId}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to join room', code: 'JOIN_ROOM_ERROR' });
      }
    });

    // ゲーム開始（プレースホルダー）
    socket.on('startGame', (data: StartGameData) => {
      try {
        const room = gameManager.getRoom(data.roomId);

        if (!room) {
          socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
          return;
        }

        // ゲーム開始ロジックは今後実装
        io.to(data.roomId).emit('gameStarted', {
          roomId: data.roomId,
        });

        console.log(`Game started in room: ${data.roomId}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to start game', code: 'START_GAME_ERROR' });
      }
    });

    // プレイヤーアクション（プレースホルダー）
    socket.on('action', (data: ActionData) => {
      // アクション処理は今後実装
      console.log(`Action received from ${data.playerId}: ${data.action.type}`);
    });

    // チャットメッセージ
    socket.on('chatMessage', (data: ChatMessageData) => {
      io.to(data.roomId).emit('chatMessage', {
        playerId: data.playerId,
        text: data.text,
        timestamp: Date.now(),
      });
    });

    // 切断
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};
