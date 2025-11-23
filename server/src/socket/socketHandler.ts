/**
 * Socket.io イベントハンドラ
 */

import { Server } from 'socket.io';
import { GameManager } from '../game/GameManager';
import {
  ServerSocket,
  JoinRoomData,
  StartGameData,
  ActionData,
  ChatMessageData,
} from '../types/socket';
import { validatePlayerName, validateBlindAmount, validateRoomId } from '../utils/validation';

/**
 * 次のラウンドを開始する共通処理
 * ショーダウン後や不戦勝後に呼び出される
 */
const startNextRound = (
  io: Server,
  gameManager: GameManager,
  roomId: string
): void => {
  try {
    console.log(`[DEBUG] Attempting to start next round in room ${roomId}`);
    gameManager.endRound(roomId);

    const updatedRoom = gameManager.getRoom(roomId);
    const newRound = gameManager.getActiveRound(roomId);

    if (!updatedRoom || !newRound) {
      // ゲーム終了（プレイヤーが2人未満）
      console.log(`[DEBUG] Game ended in room ${roomId} - not enough players`);
      io.to(roomId).emit('gameEnded', {
        reason: 'Not enough players',
      });
      return;
    }

    console.log(`[DEBUG] Starting new round in room ${roomId}`);

    // 新しいラウンド開始を通知
    io.to(roomId).emit('gameStarted', {
      roomId: updatedRoom.id,
      dealerIndex: updatedRoom.dealerIndex,
      players: updatedRoom.players.map((p) => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        seat: p.seat,
      })),
    });

    // 各プレイヤーに手札を配る
    for (const player of updatedRoom.players) {
      const hand = newRound.getPlayerHand(player.id);
      if (hand) {
        const playerSocket = Array.from(io.sockets.sockets.values())
          .find((s): s is ServerSocket => (s as ServerSocket).playerId === player.id) as ServerSocket | undefined;

        if (playerSocket) {
          playerSocket.emit('dealHand', {
            playerId: player.id,
            hand: hand,
          });
        }
      }
    }

    // 最初のプレイヤーにターン通知
    const currentBettorId = newRound.getCurrentBettorId();
    io.to(roomId).emit('turnNotification', {
      playerId: currentBettorId,
      currentBet: newRound.getPlayerBet(currentBettorId),
      playerBets: newRound.getAllPlayerBets(),
      validActions: newRound.getValidActions(currentBettorId),
    });

    console.log(`[DEBUG] New round started successfully in room ${roomId}`);
  } catch (error) {
    console.error(`[ERROR] Failed to start next round:`, error);
  }
};

export const setupSocketHandlers = (io: Server, gameManager: GameManager): void => {
  io.on('connection', (socket: ServerSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // ルーム作成
    socket.on('createRoom', (data: { hostName: string; smallBlind: number; bigBlind: number }) => {
      try {
        // 入力バリデーション
        const hostName = validatePlayerName(data.hostName);
        const smallBlind = validateBlindAmount(data.smallBlind, 'Small blind');
        const bigBlind = validateBlindAmount(data.bigBlind, 'Big blind');

        if (bigBlind <= smallBlind) {
          throw new Error('Big blind must be greater than small blind');
        }

        const { room, host } = gameManager.createRoom(hostName, smallBlind, bigBlind);

        // ソケットをルームに参加させる
        socket.join(room.id);

        // プレイヤーIDとルームIDを保存
        socket.playerId = host.id;
        socket.roomId = room.id;

        socket.emit('roomCreated', {
          roomId: room.id,
          playerId: host.id, // hostIdではなくplayerIdを返す
          playerName: host.name,
          seat: host.seat,
          chips: host.chips,
        });

        console.log(`Room created: ${room.id}`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to create room', code: 'CREATE_ROOM_ERROR' });
      }
    });

    // ルーム参加
    socket.on('joinRoom', (data: JoinRoomData) => {
      try {
        // 入力バリデーション
        const roomId = validateRoomId(data.roomId);
        const playerName = validatePlayerName(data.playerName);

        const room = gameManager.getRoom(roomId);
        if (!room) {
          socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
          return;
        }

        const player = gameManager.addPlayer(roomId, playerName);

        // socketをルームに参加させる
        socket.join(roomId);

        // プレイヤーIDを保存
        socket.playerId = player.id;
        socket.roomId = roomId;

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
        const currentBettorId = round.getCurrentBettorId();
        console.log(`[DEBUG] Game started - room players:`, room.players.map(p => ({ id: p.id, name: p.name })));
        console.log(`[DEBUG] Game started - current bettor: ${currentBettorId}`);

        // Delay emission to ensure client listeners are attached
        setTimeout(() => {
          io.to(data.roomId).emit('turnNotification', {
            playerId: currentBettorId,
            currentBet: round.getPlayerBet(currentBettorId),
            playerBets: round.getAllPlayerBets(),
            validActions: round.getValidActions(currentBettorId),
          });

          console.log(`[DEBUG] Sent turnNotification to room ${data.roomId} for player ${currentBettorId}`);
          console.log(`[DEBUG] Valid actions:`, round.getValidActions(currentBettorId));
        }, 0);

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
        const roomId = socket.roomId;

        console.log(`[DEBUG] action received - playerId: ${playerId}, action: ${action.type}, amount: ${action.amount}`);

        if (!roomId) {
          socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
          return;
        }

        const round = gameManager.getActiveRound(roomId);
        if (!round) {
          socket.emit('error', { message: 'No active round', code: 'NO_ACTIVE_ROUND' });
          return;
        }

        console.log(`[DEBUG] Before action - currentBettorId: ${round.getCurrentBettorId()}`);
        console.log(`[DEBUG] Before action - isBettingComplete: ${round.isBettingComplete()}`);
        console.log(`[DEBUG] Before action - isComplete: ${round.isComplete()}`);

        // アクション実行 ('bet'は'raise'として扱う)
        const actionType = action.type === 'bet' ? 'raise' : action.type;

        try {
          gameManager.executePlayerAction(roomId, playerId, actionType, action.amount);
        } catch (actionError) {
          // アクションエラーを個別に処理
          const message = actionError instanceof Error ? actionError.message : 'Invalid action';
          socket.emit('error', { message, code: 'ACTION_ERROR' });
          console.error(`[ERROR] Action error from ${playerId}: ${message}`);
          return;
        }

        const room = gameManager.getRoom(roomId);
        if (!room) return;

        console.log(`[DEBUG] After action - currentBettorId: ${round.getCurrentBettorId()}`);
        console.log(`[DEBUG] After action - isBettingComplete: ${round.isBettingComplete()}`);
        console.log(`[DEBUG] After action - isComplete: ${round.isComplete()}`);

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
          console.log(`[DEBUG] Round complete - performing showdown`);
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

          // 次のラウンドへの自動遷移（3秒後）
          setTimeout(() => {
            startNextRound(io, gameManager, roomId);
          }, 3000);
        } else if (round.isBettingComplete()) {
          // 勝者が決まったかチェック（1人以外全員フォールド）
          if (round.getActivePlayersCount() === 1) {
            console.log(`[DEBUG] Betting complete & Only 1 player left - Win by fold`);
            // ショーダウン実行（不戦勝）
            round.performShowdown();

            // ショーダウン結果を通知
            io.to(roomId).emit('showdown', {
              players: room.players.map((p) => ({
                id: p.id,
                chips: p.chips,
                hand: round.getPlayerHand(p.id),
              })),
            });

            // 次のラウンドへの自動遷移（3秒後）
            setTimeout(() => {
              startNextRound(io, gameManager, roomId);
            }, 3000);
          } else {
            console.log(`[DEBUG] Betting complete - advancing to next street`);
            // 次のストリートへ進む
            round.advanceRound();

            console.log(`[DEBUG] New street: ${round.getState()}`);

            // 新しいストリート情報を通知
            io.to(roomId).emit('newStreet', {
              state: round.getState(),
              communityCards: round.getCommunityCards(),
            });

            // ショーダウンに到達した場合、即座にショーダウンを実行
            if (round.isComplete()) {
              console.log(`[DEBUG] Reached showdown - performing showdown`);
              round.performShowdown();

              // ショーダウン結果を通知
              io.to(roomId).emit('showdown', {
                players: room.players.map((p) => ({
                  id: p.id,
                  chips: p.chips,
                  hand: round.getPlayerHand(p.id),
                })),
              });

              // 次のラウンドへの自動遷移（3秒後）
              setTimeout(() => {
                startNextRound(io, gameManager, roomId);
              }, 3000);
            } else {
              // 次のストリートの最初のプレイヤーにターン通知
              const nextBettorId = round.getCurrentBettorId();
              console.log(`[DEBUG] Emitting turnNotification to: ${nextBettorId}`);
              io.to(roomId).emit('turnNotification', {
                playerId: nextBettorId,
                currentBet: round.getPlayerBet(nextBettorId),
                playerBets: round.getAllPlayerBets(),
                validActions: round.getValidActions(nextBettorId),
              });
            }
          }
        } else {
          console.log(`[DEBUG] Betting continues - notifying next player`);
          // ベッティング継続中: 次のプレイヤーにターン通知
          const nextBettorId = round.getCurrentBettorId();
          console.log(`[DEBUG] Emitting turnNotification to: ${nextBettorId}`);
          io.to(roomId).emit('turnNotification', {
            playerId: nextBettorId,
            currentBet: round.getPlayerBet(nextBettorId),
            playerBets: round.getAllPlayerBets(),
            validActions: round.getValidActions(nextBettorId),
          });
        }

        console.log(`[INFO] Action completed - ${playerId}: ${action.type}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to execute action';
        socket.emit('error', { message, code: 'ACTION_ERROR' });
        console.error(`[ERROR] Unexpected error: ${message}`);
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
