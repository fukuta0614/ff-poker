/**
 * Socket.io イベントハンドラ
 */

import { Server } from 'socket.io';
import { TIMEOUT_CONSTANTS } from '../utils/constants';
import { GameManager } from '../game/GameManager';
import { SessionManager } from '../services/SessionManager';
import { TurnTimerManager } from '../services/TurnTimerManager';
import { LoggerService } from '../services/LoggerService';
import {
  ServerSocket,
  JoinRoomData,
  StartGameData,
  ActionData,
  ChatMessageData,
} from '../types/socket';
import { GameEvent } from '../types/game';
import { validatePlayerName, validateBlindAmount, validateRoomId } from '../utils/validation';

// startNextRound function removed as logic is moved to GameManager


export const setupSocketHandlers = (
  io: Server,
  gameManager: GameManager,
  sessionManager: SessionManager,
  turnTimerManager: TurnTimerManager,
  logger: LoggerService
): void => {
  const handleAutoFold = (roomId: string, playerId: string) => {
    try {
      const result = gameManager.handlePlayerAction(roomId, playerId, 'fold');
      if (result.success) {
        io.to(roomId).emit('playerTimeout', { playerId });
        processGameEvents(roomId, result.events);
      }
    } catch (e) {
      logger.error('Auto-fold error', e instanceof Error ? e : undefined, { playerId });
    }
  };

  const processGameEvents = (roomId: string, events: GameEvent[]) => {
    let delay = 0;

    for (const event of events) {
      if (event.type === 'roundStarted') {
        delay = 3000;
      }

      const execute = () => {
        switch (event.type) {
          case 'actionPerformed':
            io.to(roomId).emit('actionPerformed', event.payload);
            break;
          case 'newStreet':
            io.to(roomId).emit('newStreet', event.payload);
            break;
          case 'showdown':
            io.to(roomId).emit('showdown', event.payload);
            break;
          case 'gameEnded':
            io.to(roomId).emit('gameEnded', event.payload);
            break;
          case 'roundStarted':
            console.log(`[SocketHandler] roundStarted event received for room ${roomId}`);
            io.to(roomId).emit('gameStarted', event.payload);
            console.log(`[SocketHandler] Emitted gameStarted to room ${roomId}`, event.payload);

            const room = gameManager.getRoom(roomId);
            const round = gameManager.getActiveRound(roomId);
            if (room && round) {
              console.log(`[SocketHandler] Dealing hands to ${room.players.length} players`);
              for (const player of room.players) {
                const hand = round.getPlayerHand(player.id);
                if (hand) {
                  const playerSocket = Array.from(io.sockets.sockets.values())
                    .find((s): s is ServerSocket => (s as ServerSocket).playerId === player.id) as ServerSocket | undefined;

                  if (playerSocket) {
                    playerSocket.emit('dealHand', {
                      playerId: player.id,
                      hand: hand,
                    });
                    console.log(`[SocketHandler] Dealt hand to player ${player.id}`);
                  }
                }
              }
            }
            break;
          case 'turnChange':
            io.to(roomId).emit('turnNotification', event.payload);
            
            turnTimerManager.startTimer(roomId, event.payload.playerId, () => {
              handleAutoFold(roomId, event.payload.playerId);
            }, (remaining, isWarning) => {
              io.to(roomId).emit('timerUpdate', { playerId: event.payload.playerId, remaining, warning: isWarning });
            });
            break;
        }
      };

      if (delay > 0) {
        setTimeout(execute, delay);
      } else {
        execute();
      }
    }
  };

  io.on('connection', (socket: ServerSocket) => {
    logger.logConnection(socket.id, undefined, undefined, true);

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

        // セッション作成
        sessionManager.createSession(host.id, socket.id);

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

        logger.info('Room created', { roomId: room.id });
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

        // セッション作成
        sessionManager.createSession(player.id, socket.id);

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

        logger.info('Player joined room', { playerName: data.playerName, roomId: data.roomId, playerId: player.id });
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
        logger.debug('Game started', {
          roomId: data.roomId,
          players: room.players.map(p => ({ id: p.id, name: p.name })),
          currentBettorId,
        });

        // Delay emission to ensure client listeners are attached
        setTimeout(() => {
          io.to(data.roomId).emit('turnNotification', {
            playerId: currentBettorId,
            currentBet: round.getPlayerBet(currentBettorId),
            playerBets: round.getAllPlayerBets(),
            validActions: round.getValidActions(currentBettorId),
          });

          logger.debug('Sent turnNotification', { roomId: data.roomId, playerId: currentBettorId, validActions: round.getValidActions(currentBettorId) });
        }, 0);

        // Start turn timer
        turnTimerManager.startTimer(data.roomId, currentBettorId, () => {
          handleAutoFold(data.roomId, currentBettorId);
        }, (remaining, isWarning) => {
          io.to(data.roomId).emit('timerUpdate', { playerId: currentBettorId, remaining, warning: isWarning });
        });

        logger.info('Game started in room', { roomId: data.roomId });
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

        logger.debug('Action received', { playerId, action: action.type, amount: action.amount });

        if (!roomId) {
          socket.emit('error', { message: 'Not in a room', code: 'NOT_IN_ROOM' });
          return;
        }

        // Cancel any existing turn timer for this room
        turnTimerManager.cancelTimer(roomId);

        const result = gameManager.handlePlayerAction(roomId, playerId, action.type, action.amount);

        if (!result.success) {
          socket.emit('error', { message: result.error || 'Action failed', code: 'ACTION_ERROR' });
          logger.error('Action error', undefined, { playerId, message: result.error });
          return;
        }

        processGameEvents(roomId, result.events);

        logger.info('Action completed', { roomId, playerId, action: action.type });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to execute action';
        socket.emit('error', { message, code: 'ACTION_ERROR' });
        logger.error('Unexpected error', error instanceof Error ? error : undefined, { message });
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
      const playerId = socket.playerId;
      const roomId = socket.roomId;

      logger.logConnection(socket.id, playerId, undefined, false);

      if (playerId) {
        // lastSeen更新のみ（socketIdは更新しない）
        const session = sessionManager.getSession(playerId);
        if (session) {
          session.lastSeen = Date.now();
        }

        // Emit playerDisconnected to room
        if (roomId) {
          io.to(roomId).emit('playerDisconnected', { playerId });
        }

        // Start grace period timer for auto-fold if not reconnected
        setTimeout(() => {
          if (!sessionManager.isSessionValid(playerId)) {
            // Session expired, auto-fold
            if (roomId) {
              handleAutoFold(roomId, playerId);
              logger.info('Player auto-folded after grace period', { playerId, roomId });
            }
          }
        }, TIMEOUT_CONSTANTS.GRACE_PERIOD);
      }
    });

    // Reconnection handler
    socket.on('reconnectRequest', (data: { playerId: string; roomId: string }) => {
      try {
        const { playerId, roomId } = data;
        const success = sessionManager.reconnect(playerId, socket.id);

        if (success) {
          // Socket情報を復元
          socket.playerId = playerId;
          socket.roomId = roomId;
          socket.join(roomId);

          // 再接続成功を通知
          io.to(roomId).emit('playerReconnected', { playerId });
          logger.info('Player reconnected', { playerId, roomId });

          // 現在のゲーム状態を送信
          const room = gameManager.getRoom(roomId);
          const round = gameManager.getActiveRound(roomId);

          if (room && round) {
            socket.emit('gameState', {
              roomId,
              players: room.players.map((p) => ({
                id: p.id,
                name: p.name,
                chips: p.chips,
                seat: p.seat,
              })),
              communityCards: round.getCommunityCards(),
              pot: round.getPot(),
              currentBettorId: round.getCurrentBettorId(),
              playerBets: round.getAllPlayerBets(),
              hand: round.getPlayerHand(playerId),
            });
          }
        } else {
          socket.emit('error', {
            message: 'Reconnection failed - grace period expired',
            code: 'RECONNECT_FAILED',
          });
          logger.warn('Reconnection failed', { playerId, roomId });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Reconnection error';
        socket.emit('error', { message, code: 'RECONNECT_FAILED' });
        logger.error('Reconnection error', error instanceof Error ? error : undefined);
      }
    });
  });
};
