/**
 * E2Eテスト: マルチラウンド機能の完全な動作確認
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { GameManager } from '../../src/game/GameManager';
import { setupSocketHandlers } from '../../src/socket/socketHandler';
import { SessionManager } from '../../src/services/SessionManager';
import { TurnTimerManager } from '../../src/services/TurnTimerManager';
import { LoggerService } from '../../src/services/LoggerService';

describe('Multi-Round E2E Test', () => {
  let io: SocketIOServer;
  let httpServer: any;
  let gameManager: GameManager;
  let sessionManager: SessionManager;
  let turnTimerManager: TurnTimerManager;
  let logger: LoggerService;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  const PORT = 4001;

  beforeAll((done) => {
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
    gameManager = new GameManager();
    sessionManager = new SessionManager();
    turnTimerManager = new TurnTimerManager();
    logger = new LoggerService();
    setupSocketHandlers(io, gameManager, sessionManager, turnTimerManager, logger);

    httpServer.listen(PORT, () => {
      console.log(`[E2E] Test server started on port ${PORT}`);
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    io.close();
    httpServer.close(() => {
      console.log('[E2E] Test server closed');
      done();
    });
  });

  afterEach(() => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
  });

  test('マルチラウンド: Round 1で不戦勝 -> Round 2が自動開始される', (done) => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;
    let round1Completed = false;
    let round2Started = false;

    const events: string[] = [];

    clientSocket1 = ioClient(`http://localhost:${PORT}`);

    clientSocket1.on('connect', () => {
      console.log('[E2E] Player1 connected');
      events.push('P1_CONNECTED');

      clientSocket1.emit('createRoom', {
        hostName: 'Player1',
        smallBlind: 10,
        bigBlind: 20,
      });
    });

    clientSocket1.on('roomCreated', (data: { roomId: string; playerId: string }) => {
      console.log('[E2E] Room created:', data.roomId);
      roomId = data.roomId;
      player1Id = data.playerId;
      events.push('ROOM_CREATED');

      clientSocket2 = ioClient(`http://localhost:${PORT}`);

      clientSocket2.on('connect', () => {
        console.log('[E2E] Player2 connected');
        events.push('P2_CONNECTED');

        clientSocket2.emit('joinRoom', {
          roomId: roomId,
          playerName: 'Player2',
        });
      });

      clientSocket2.on('joinedRoom', (data: any) => {
        console.log('[E2E] Player2 joined room');
        player2Id = data.playerId;
        events.push('P2_JOINED');

        setTimeout(() => {
          console.log('[E2E] Starting game...');
          events.push('STARTING_GAME');
          clientSocket1.emit('startGame', { roomId });
        }, 100);
      });

      // Player2のターン通知を監視
      clientSocket2.on('turnNotification', (data: any) => {
        console.log('[E2E] Player2 turn notification:', data);
        events.push(`P2_TURN_${round2Started ? 'ROUND2' : 'ROUND1'}`);
      });

      clientSocket2.on('error', (error: any) => {
        console.error('[E2E] Player2 error:', error);
        events.push(`P2_ERROR: ${error.message}`);
      });
    });

    // Player1のイベント監視
    let gameStartedCount = 0;
    clientSocket1.on('gameStarted', (data: any) => {
      gameStartedCount++;
      console.log(`[E2E] Game started (${gameStartedCount}):`, data);
      events.push(`GAME_STARTED_${gameStartedCount}`);

      if (gameStartedCount === 2) {
        round2Started = true;
        console.log('[E2E] ✅ Round 2 started successfully!');
      }
    });

    let handDealtCount = 0;
    clientSocket1.on('dealHand', (data: any) => {
      handDealtCount++;
      console.log(`[E2E] Player1 received hand ${handDealtCount}`);
      events.push(`HAND_DEALT_${handDealtCount}`);
    });

    clientSocket1.on('turnNotification', (data: any) => {
      console.log('[E2E] Player1 turn notification:', data);

      if (data.playerId === player1Id && !round1Completed) {
        events.push('P1_TURN_ROUND1');

        // Player1がフォールド（Player2の不戦勝）
        setTimeout(() => {
          console.log('[E2E] Player1 folding...');
          events.push('P1_FOLDING');

          clientSocket1.emit('action', {
            playerId: player1Id,
            action: { type: 'fold' },
          });
        }, 100);
      } else if (data.playerId === player1Id && round2Started) {
        events.push('P1_TURN_ROUND2');
        console.log('[E2E] Player1 received turn in Round 2');
      }
    });

    clientSocket1.on('showdown', (data: any) => {
      console.log('[E2E] Showdown:', data);
      events.push('SHOWDOWN');

      if (!round1Completed) {
        round1Completed = true;
        console.log('[E2E] Round 1 completed, waiting for Round 2...');
      }
    });

    clientSocket1.on('gameEnded', (data: any) => {
      console.log('[E2E] Game ended:', data);
      events.push('GAME_ENDED');
      done(new Error('Game should not end - should start Round 2'));
    });

    clientSocket1.on('error', (error: any) => {
      console.error('[E2E] Player1 error:', error);
      events.push(`P1_ERROR: ${error.message}`);
    });

    // タイムアウト: 10秒以内にRound 2が始まらなければ失敗
    setTimeout(() => {
      console.log('[E2E] Event sequence:', events);

      if (!round2Started) {
        console.error('[E2E] ❌ Round 2 did not start within 10 seconds');
        console.error('[E2E] Expected events: SHOWDOWN -> GAME_STARTED_2 -> HAND_DEALT_2');
        console.error('[E2E] Actual events:', events);
        done(new Error('Round 2 did not start within 10 seconds'));
      } else {
        console.log('[E2E] ✅ Test passed - Round 2 started successfully');
        expect(gameStartedCount).toBe(2);
        expect(handDealtCount).toBe(2);
        expect(events).toContain('SHOWDOWN');
        expect(events).toContain('GAME_STARTED_2');
        expect(events).toContain('HAND_DEALT_2');
        done();
      }
    }, 10000);
  }, 15000);

  test('マルチラウンド: ショーダウンまで進行 -> Round 2が自動開始される', (done) => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;
    let round2Started = false;

    clientSocket1 = ioClient(`http://localhost:${PORT}`);

    clientSocket1.on('connect', () => {
      clientSocket1.emit('createRoom', {
        hostName: 'Player1',
        smallBlind: 10,
        bigBlind: 20,
      });
    });

    clientSocket1.on('roomCreated', (data: { roomId: string; playerId: string }) => {
      roomId = data.roomId;
      player1Id = data.playerId;

      clientSocket2 = ioClient(`http://localhost:${PORT}`);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('joinRoom', {
          roomId: roomId,
          playerName: 'Player2',
        });
      });

      clientSocket2.on('joinedRoom', (data: any) => {
        player2Id = data.playerId;

        setTimeout(() => {
          clientSocket1.emit('startGame', { roomId });
        }, 100);
      });

      // Player2のアクション
      clientSocket2.on('turnNotification', (data: any) => {
        if (data.playerId === player2Id && !round2Started) {
          setTimeout(() => {
            clientSocket2.emit('action', {
              playerId: player2Id,
              action: { type: 'check' },
            });
          }, 100);
        }
      });
    });

    // Player1のアクション: すべてチェック/コールでショーダウンまで進む
    let actionCount = 0;
    clientSocket1.on('turnNotification', (data: any) => {
      if (data.playerId === player1Id && !round2Started) {
        actionCount++;

        setTimeout(() => {
          const validActions = data.validActions;

          if (validActions.includes('check')) {
            clientSocket1.emit('action', {
              playerId: player1Id,
              action: { type: 'check' },
            });
          } else if (validActions.includes('call')) {
            clientSocket1.emit('action', {
              playerId: player1Id,
              action: { type: 'call' },
            });
          }
        }, 100);
      }
    });

    let gameStartedCount = 0;
    clientSocket1.on('gameStarted', (data: any) => {
      gameStartedCount++;
      if (gameStartedCount === 2) {
        round2Started = true;
        console.log('[E2E] ✅ Round 2 started after showdown');
      }
    });

    clientSocket1.on('showdown', (data: any) => {
      console.log('[E2E] Showdown occurred, waiting for Round 2...');
    });

    setTimeout(() => {
      if (round2Started) {
        expect(gameStartedCount).toBe(2);
        console.log('[E2E] ✅ Test passed - Round 2 started after showdown');
        done();
      } else {
        done(new Error('Round 2 did not start after showdown'));
      }
    }, 15000);
  }, 20000);

  test('マルチラウンド: 3ラウンド連続で進行する', (done) => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;
    let roundsCompleted = 0;

    clientSocket1 = ioClient(`http://localhost:${PORT}`);

    clientSocket1.on('connect', () => {
      clientSocket1.emit('createRoom', {
        hostName: 'Player1',
        smallBlind: 10,
        bigBlind: 20,
      });
    });

    clientSocket1.on('roomCreated', (data: { roomId: string; playerId: string }) => {
      roomId = data.roomId;
      player1Id = data.playerId;

      clientSocket2 = ioClient(`http://localhost:${PORT}`);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('joinRoom', {
          roomId: roomId,
          playerName: 'Player2',
        });
      });

      clientSocket2.on('joinedRoom', (data: any) => {
        player2Id = data.playerId;

        setTimeout(() => {
          clientSocket1.emit('startGame', { roomId });
        }, 100);
      });

      clientSocket2.on('turnNotification', (data: any) => {
        if (data.playerId === player2Id) {
          setTimeout(() => {
            // Player2もフォールドして素早くラウンドを進める
            clientSocket2.emit('action', {
              playerId: player2Id,
              action: { type: 'fold' },
            });
          }, 50);
        }
      });
    });

    clientSocket1.on('turnNotification', (data: any) => {
      if (data.playerId === player1Id) {
        setTimeout(() => {
          // Player1は毎回フォールド（素早くラウンドを進める）
          clientSocket1.emit('action', {
            playerId: player1Id,
            action: { type: 'fold' },
          });
        }, 50);
      }
    });

    clientSocket1.on('showdown', (data: any) => {
      roundsCompleted++;
      console.log(`[E2E] Round ${roundsCompleted} completed`);

      if (roundsCompleted === 3) {
        console.log('[E2E] ✅ 3 rounds completed successfully!');
        expect(roundsCompleted).toBe(3);
        done();
      }
    });

    clientSocket1.on('gameEnded', (data: any) => {
      done(new Error(`Game ended prematurely after ${roundsCompleted} rounds`));
    });

    // タイムアウト: 20秒
    setTimeout(() => {
      if (roundsCompleted < 3) {
        done(new Error(`Only ${roundsCompleted} rounds completed, expected 3`));
      }
    }, 20000);
  }, 25000);
});
