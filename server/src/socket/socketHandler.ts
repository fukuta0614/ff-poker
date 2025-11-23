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
import { validatePlayerName, validateBlindAmount, validateRoomId } from '../utils/validation';

/**
 * 次のラウンドを開始する共通処理
 * ショーダウン後や不戦勝後に呼び出される
 */
const startNextRound = (
  io: Server,
  gameManager: GameManager,
  roomId: string,
  logger: LoggerService,
  turnTimerManager: TurnTimerManager
): void => {
  try {
    logger.debug('Attempting to start next round', { roomId });
    gameManager.endRound(roomId);

    const updatedRoom = gameManager.getRoom(roomId);
    const newRound = gameManager.getActiveRound(roomId);

    if (!updatedRoom || !newRound) {
      // ゲーム終了（プレイヤーが2人未満）
      logger.debug('Game ended - not enough players', { roomId });
      io.to(roomId).emit('gameEnded', {
        reason: 'Not enough players',
      });
      return;
    }

    logger.debug('Starting new round', { roomId });

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

    // Start turn timer for the first player
    turnTimerManager.startTimer(roomId, currentBettorId, () => {
      // Auto-fold on timeout
      try {
        gameManager.executePlayerAction(roomId, currentBettorId, 'fold');
        io.to(roomId).emit('playerTimeout', { playerId: currentBettorId });
      } catch (e) {
        logger.error('Auto-fold error', e instanceof Error ? e : undefined, { playerId: currentBettorId });
      }
    }, (remaining, isWarning) => {
      io.to(roomId).emit('timerUpdate', { playerId: currentBettorId, remaining, warning: isWarning });
    });

    logger.debug('New round started successfully', { roomId });
  } catch (error) {
    logger.error('Failed to start next round', error instanceof Error ? error : undefined, { roomId });
  }
};

export const setupSocketHandlers = (
  io: Server,
  gameManager: GameManager,
  sessionManager: SessionManager,
  turnTimerManager: TurnTimerManager,
  logger: LoggerService
): void => {
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
          // Auto-fold on timeout
          try {
            gameManager.executePlayerAction(data.roomId, currentBettorId, 'fold');
            io.to(data.roomId).emit('playerTimeout', { playerId: currentBettorId });
          } catch (e) {
            logger.error('Auto-fold error', e instanceof Error ? e : undefined, { playerId: currentBettorId });
          }
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

        const round = gameManager.getActiveRound(roomId);
        if (!round) {
          socket.emit('error', { message: 'No active round', code: 'NO_ACTIVE_ROUND' });
          return;
        }

        logger.debug('Before action', {
          roomId,
          currentBettorId: round.getCurrentBettorId(),
          isBettingComplete: round.isBettingComplete(),
          isComplete: round.isComplete(),
        });

        // アクション実行 ('bet'は'raise'として扱う)
        const actionType = action.type === 'bet' ? 'raise' : action.type;

        try {
          gameManager.executePlayerAction(roomId, playerId, actionType, action.amount);
        } catch (actionError) {
          // アクションエラーを個別に処理
          const message = actionError instanceof Error ? actionError.message : 'Invalid action';
          socket.emit('error', { message, code: 'ACTION_ERROR' });
          logger.error('Action error', undefined, { playerId, message });
          return;
        }

        const room = gameManager.getRoom(roomId);
        if (!room) return;

        logger.debug('After action', {
          roomId,
          currentBettorId: round.getCurrentBettorId(),
          isBettingComplete: round.isBettingComplete(),
          isComplete: round.isComplete(),
        });

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
          logger.debug('Round complete - performing showdown', { roomId });
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
            startNextRound(io, gameManager, roomId, logger, turnTimerManager);
          }, 3000);
        } else if (round.isBettingComplete()) {
          // 勝者が決まったかチェック（1人以外全員フォールド）
          if (round.getActivePlayersCount() === 1) {
            logger.debug('Betting complete & Only 1 player left - Win by fold', { roomId });
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
              startNextRound(io, gameManager, roomId, logger, turnTimerManager);
            }, 3000);
          } else {
            logger.debug('Betting complete - advancing to next street', { roomId });
            // 次のストリートへ進む
            round.advanceRound();

            logger.debug('New street', { roomId, state: round.getState() });

            // 新しいストリート情報を通知
            io.to(roomId).emit('newStreet', {
              state: round.getState(),
              communityCards: round.getCommunityCards(),
            });

            // ショーダウンに到達した場合、即座にショーダウンを実行
            if (round.isComplete()) {
              logger.debug('Reached showdown - performing showdown', { roomId });
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
                startNextRound(io, gameManager, roomId, logger, turnTimerManager);
              }, 3000);
            } else {
              // 次のストリートの最初のプレイヤーにターン通知
              const nextBettorId = round.getCurrentBettorId();
              logger.debug('Emitting turnNotification', { roomId, playerId: nextBettorId });
              io.to(roomId).emit('turnNotification', {
                playerId: nextBettorId,
                currentBet: round.getPlayerBet(nextBettorId),
                playerBets: round.getAllPlayerBets(),
                validActions: round.getValidActions(nextBettorId),
              });

              // Start turn timer for next player
              turnTimerManager.startTimer(roomId, nextBettorId, () => {
                try {
                  gameManager.executePlayerAction(roomId, nextBettorId, 'fold');
                  io.to(roomId).emit('playerTimeout', { playerId: nextBettorId });
                } catch (e) {
                  logger.error('Auto-fold error', e instanceof Error ? e : undefined, { playerId: nextBettorId });
                }
              }, (remaining, isWarning) => {
                io.to(roomId).emit('timerUpdate', { playerId: nextBettorId, remaining, warning: isWarning });
              });
            }
          }
        } else {
          logger.debug('Betting continues - notifying next player', { roomId });
          // ベッティング継続中: 次のプレイヤーにターン通知
          const nextBettorId = round.getCurrentBettorId();
          logger.debug('Emitting turnNotification', { roomId, playerId: nextBettorId });
          io.to(roomId).emit('turnNotification', {
            playerId: nextBettorId,
            currentBet: round.getPlayerBet(nextBettorId),
            playerBets: round.getAllPlayerBets(),
            validActions: round.getValidActions(nextBettorId),
          });

          // Start turn timer for next player
          turnTimerManager.startTimer(roomId, nextBettorId, () => {
            try {
              gameManager.executePlayerAction(roomId, nextBettorId, 'fold');
              io.to(roomId).emit('playerTimeout', { playerId: nextBettorId });
            } catch (e) {
              logger.error('Auto-fold error', e instanceof Error ? e : undefined, { playerId: nextBettorId });
            }
          }, (remaining, isWarning) => {
            io.to(roomId).emit('timerUpdate', { playerId: nextBettorId, remaining, warning: isWarning });
          });
        }

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
            try {
              if (roomId) {
                gameManager.executePlayerAction(roomId, playerId, 'fold');
                io.to(roomId).emit('playerAutoFolded', { playerId });
                logger.info('Player auto-folded after grace period', { playerId, roomId });
              }
            } catch (e) {
              logger.error('Auto-fold error on disconnect', e instanceof Error ? e : undefined, { playerId });
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
