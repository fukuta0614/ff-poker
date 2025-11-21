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

        const player = gameManager.addPlayer(data.roomId, data.playerName);

        // socketをルームに参加させる
        socket.join(data.roomId);

        // プレイヤーIDを保存
        (socket as any).playerId = player.id;
        (socket as any).roomId = data.roomId;

        // 参加通知（全プレイヤー情報を含める）
        socket.emit('joinedRoom', {
          roomId: data.roomId,
          playerId: player.id,
          playerName: data.playerName,
          players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            chips: p.chips,
            seat: p.seat,
          })),
        });

        // ルームの他のメンバーに通知
        socket.to(data.roomId).emit('playerJoined', {
          playerId: player.id,
          playerName: data.playerName,
          seat: player.seat,
          chips: player.chips,
        });

        console.log(`${data.playerName} joined room: ${data.roomId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to join room';
        socket.emit('error', { message, code: 'JOIN_ROOM_ERROR' });
      }
    });

    // ゲーム開始
    socket.on('startGame', (data: StartGameData) => {
      try {
        gameManager.startGame(data.roomId);

        const room = gameManager.getRoom(data.roomId);
        const round = gameManager.getActiveRound(data.roomId);

        if (!room || !round) {
          socket.emit('error', { message: 'Failed to start game', code: 'START_GAME_ERROR' });
          return;
        }

        // ゲーム開始を1回だけルーム全体に送信
        io.to(data.roomId).emit('gameStarted', {
          roomId: data.roomId,
          dealerIndex: room.dealerIndex,
          players: room.players.map((p) => ({
            id: p.id,
            name: p.name,
            chips: p.chips,
            seat: p.seat,
          })),
        });

        // 各プレイヤーに個別に手札を送信
        for (const player of room.players) {
          const hand = round.getPlayerHand(player.id);
          if (hand) {
            // socket IDを見つけて個別送信
            const playerSocket = Array.from(io.sockets.sockets.values())
              .find(s => (s as any).playerId === player.id);

            if (playerSocket) {
              playerSocket.emit('dealHand', {
                playerId: player.id,
                hand: hand,
              });
            }
          }
        }

        // 最初のプレイヤーにターン通知
        io.to(data.roomId).emit('turnNotification', {
          playerId: round.getCurrentBettorId(),
          currentBet: round.getPlayerBet(round.getCurrentBettorId()),
          playerBets: round.getAllPlayerBets(),
        });

        console.log(`Game started in room: ${data.roomId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start game';
        socket.emit('error', { message, code: 'START_GAME_ERROR' });
      }
    });

    // プレイヤーアクション
    socket.on('action', (data: ActionData) => {
      try {
        const { playerId, action } = data;
        const roomId = (socket as any).roomId;

        if (!roomId) {
          socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
          return;
        }

        const round = gameManager.getActiveRound(roomId);
        if (!round) {
          socket.emit('error', { message: 'No active round', code: 'NO_ACTIVE_ROUND' });
          return;
        }

        // アクション実行 ('bet'は'raise'として扱う)
        const actionType = action.type === 'bet' ? 'raise' : action.type;

        try {
          gameManager.executePlayerAction(roomId, playerId, actionType, action.amount);
        } catch (actionError) {
          // アクションエラーを個別に処理
          const message = actionError instanceof Error ? actionError.message : 'Invalid action';
          socket.emit('error', { message, code: 'ACTION_ERROR' });
          console.error(`Action error from ${playerId}: ${message}`);
          return;
        }

        const room = gameManager.getRoom(roomId);
        if (!room) return;

        // 全プレイヤーにアクション通知
        io.to(roomId).emit('actionPerformed', {
          playerId,
          action: action.type,
          amount: action.amount,
          pot: round.getPot(),
          playerBets: round.getAllPlayerBets(),
        });

        // ラウンドの状態に応じて通知
        if (round.isComplete()) {
          // ショーダウン実行
          round.performShowdown();

          // ショーダウン結果を通知
          io.to(roomId).emit('showdown', {
            players: room.players.map((p) => ({
              id: p.id,
              chips: p.chips,
              hand: round.getPlayerHand(p.id),
            })),
          });
        } else if (round.isBettingComplete()) {
          // 次のストリートへ進む（重要！）
          round.advanceRound();

          // 新しいストリート情報を通知
          io.to(roomId).emit('newStreet', {
            state: round.getState(),
            communityCards: round.getCommunityCards(),
          });

          // 次のストリートの最初のプレイヤーにターン通知
          if (!round.isComplete()) {
            io.to(roomId).emit('turnNotification', {
              playerId: round.getCurrentBettorId(),
              currentBet: round.getPlayerBet(round.getCurrentBettorId()),
              playerBets: round.getAllPlayerBets(),
            });
          }
        } else {
          // ベッティング継続中: 次のプレイヤーにターン通知
          io.to(roomId).emit('turnNotification', {
            playerId: round.getCurrentBettorId(),
            currentBet: round.getPlayerBet(round.getCurrentBettorId()),
            playerBets: round.getAllPlayerBets(),
          });
        }

        console.log(`Action received from ${playerId}: ${action.type}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to execute action';
        socket.emit('error', { message, code: 'ACTION_ERROR' });
      }
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
