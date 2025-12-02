/**
 * socketHandler統合テスト
 * セッション管理、再接続、タイムアウト、エラーハンドリングをテスト
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { GameManager } from '../../src/game/GameManager';
import { setupSocketHandlers } from '../../src/socket/socketHandler';
import { SessionManager } from '../../src/services/SessionManager';
import { TurnTimerManager } from '../../src/services/TurnTimerManager';
import { LoggerService } from '../../src/services/LoggerService';
import { TIMEOUT_CONSTANTS } from '../../src/utils/constants';

describe('socketHandler Integration Test', () => {
  let io: SocketIOServer;
  let httpServer: any;
  let gameManager: GameManager;
  let sessionManager: SessionManager;
  let turnTimerManager: TurnTimerManager;
  let logger: LoggerService;
  let clientSocket: ClientSocket;
  const PORT = 4001;

  beforeAll((done) => {
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    gameManager = new GameManager();
    sessionManager = new SessionManager();
    turnTimerManager = new TurnTimerManager();
    logger = new LoggerService();

    setupSocketHandlers(io, gameManager, sessionManager, turnTimerManager, logger);

    httpServer.listen(PORT, () => {
      console.log(`Test server started on port ${PORT}`);
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket?.connected) clientSocket.disconnect();
    io.close();
    httpServer.close(() => {
      console.log('Test server closed');
      done();
    });
  });

  afterEach(() => {
    if (clientSocket?.connected) clientSocket.disconnect();
    turnTimerManager.clearAllTimers();
  });

  describe('Session Management', () => {
    test('should create session when player joins room', (done) => {
      clientSocket = ioClient(`http://localhost:${PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('createRoom', {
          hostName: 'TestPlayer',
          smallBlind: 10,
          bigBlind: 20,
        });
      });

      clientSocket.on('roomCreated', (data: { roomId: string; hostId: string }) => {
        const { hostId } = data;

        // セッションが作成されているか確認
        const session = sessionManager.getSession(hostId);
        expect(session).toBeDefined();
        expect(session?.playerId).toBe(hostId);
        expect(session?.socketId).toBe(clientSocket.id);

        done();
      });

      clientSocket.on('error', (error: any) => {
        done(new Error(error.message));
      });
    }, 10000);

    test('should update session lastSeen on disconnect', (done) => {
      clientSocket = ioClient(`http://localhost:${PORT}`);
      let playerId: string;

      clientSocket.on('connect', () => {
        clientSocket.emit('createRoom', {
          hostName: 'TestPlayer',
          smallBlind: 10,
          bigBlind: 20,
        });
      });

      clientSocket.on('roomCreated', (data: { roomId: string; hostId: string }) => {
        playerId = data.hostId;

        const sessionBefore = sessionManager.getSession(playerId);
        const lastSeenBefore = sessionBefore?.lastSeen;

        // 少し待ってから切断
        setTimeout(() => {
          clientSocket.disconnect();

          // 切断後、lastSeenが更新されているか確認
          setTimeout(() => {
            const sessionAfter = sessionManager.getSession(playerId);
            expect(sessionAfter?.lastSeen).toBeGreaterThanOrEqual(lastSeenBefore!);
            done();
          }, 100);
        }, 100);
      });
    }, 10000);
  });

  describe('Reconnection', () => {
    test('should successfully reconnect within grace period', (done) => {
      let roomId: string;
      let playerId: string;
      let reconnectSocket: ClientSocket;

      clientSocket = ioClient(`http://localhost:${PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('createRoom', {
          hostName: 'TestPlayer',
          smallBlind: 10,
          bigBlind: 20,
        });
      });

      clientSocket.on('roomCreated', (data: { roomId: string; hostId: string }) => {
        roomId = data.roomId;
        playerId = data.hostId;

        // 切断
        clientSocket.disconnect();

        // グレースピリオド内に再接続
        setTimeout(() => {
          reconnectSocket = ioClient(`http://localhost:${PORT}`);

          reconnectSocket.on('connect', () => {
            reconnectSocket.emit('reconnectRequest', { playerId, roomId });
          });

          reconnectSocket.on('playerReconnected', (data: { playerId: string }) => {
            expect(data.playerId).toBe(playerId);

            // セッションが更新されているか確認
            const session = sessionManager.getSession(playerId);
            expect(session?.socketId).toBe(reconnectSocket.id);

            reconnectSocket.disconnect();
            done();
          });

          reconnectSocket.on('error', (error: any) => {
            reconnectSocket.disconnect();
            done(new Error(error.message));
          });
        }, 1000); // 1秒後に再接続（グレースピリオド内）
      });
    }, 15000);

    test('should fail to reconnect after grace period', (done) => {
      jest.setTimeout(130000); // 130秒タイムアウト

      let roomId: string;
      let playerId: string;
      let reconnectSocket: ClientSocket;

      clientSocket = ioClient(`http://localhost:${PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('createRoom', {
          hostName: 'TestPlayer',
          smallBlind: 10,
          bigBlind: 20,
        });
      });

      clientSocket.on('roomCreated', (data: { roomId: string; hostId: string }) => {
        roomId = data.roomId;
        playerId = data.hostId;

        // 切断
        clientSocket.disconnect();

        // グレースピリオド超過後に再接続試行
        setTimeout(() => {
          reconnectSocket = ioClient(`http://localhost:${PORT}`);

          reconnectSocket.on('connect', () => {
            reconnectSocket.emit('reconnectRequest', { playerId, roomId });
          });

          reconnectSocket.on('error', (error: any) => {
            expect(error.code).toBe('RECONNECT_FAILED');
            expect(error.message).toContain('grace period expired');

            reconnectSocket.disconnect();
            done();
          });

          reconnectSocket.on('playerReconnected', () => {
            reconnectSocket.disconnect();
            done(new Error('Reconnection should have failed'));
          });
        }, TIMEOUT_CONSTANTS.GRACE_PERIOD + 2000); // グレースピリオド+2秒後
      });
    }, 130000);
  });

  describe('Error Handling', () => {
    test('should return error when joining non-existent room', (done) => {
      clientSocket = ioClient(`http://localhost:${PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('joinRoom', {
          roomId: 'non-existent-room',
          playerName: 'TestPlayer',
        });
      });

      clientSocket.on('error', (error: any) => {
        expect(error.code).toBe('ROOM_NOT_FOUND');
        expect(error.message).toContain('Room not found');
        done();
      });

      clientSocket.on('joinedRoom', () => {
        done(new Error('Should not have joined room'));
      });
    }, 10000);

    test('should return error on invalid action', (done) => {
      clientSocket = ioClient(`http://localhost:${PORT}`);
      let roomId: string;
      let playerId: string;

      clientSocket.on('connect', () => {
        clientSocket.emit('createRoom', {
          hostName: 'TestPlayer',
          smallBlind: 10,
          bigBlind: 20,
        });
      });

      clientSocket.on('roomCreated', (data: { roomId: string; hostId: string }) => {
        roomId = data.roomId;
        playerId = data.hostId;

        // ゲーム開始前にアクション実行（エラー）
        clientSocket.emit('action', {
          playerId,
          action: { type: 'fold' },
        });
      });

      clientSocket.on('error', (error: any) => {
        expect(error.code).toBe('NO_ACTIVE_ROUND');
        done();
      });
    }, 10000);
  });

  describe('Turn Timer', () => {
    test('should receive timer updates during turn', (done) => {
      let roomId: string;
      let player1Id: string;
      let player2Id: string;
      let timerUpdateReceived = false;
      let client2: ClientSocket;

      clientSocket = ioClient(`http://localhost:${PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('createRoom', {
          hostName: 'Player1',
          smallBlind: 10,
          bigBlind: 20,
        });
      });

      clientSocket.on('roomCreated', (data: { roomId: string; hostId: string }) => {
        roomId = data.roomId;
        player1Id = data.hostId;

        // プレイヤー2参加
        client2 = ioClient(`http://localhost:${PORT}`);

        client2.on('connect', () => {
          client2.emit('joinRoom', { roomId, playerName: 'Player2' });
        });

        client2.on('joinedRoom', (data: any) => {
          player2Id = data.playerId;

          // ゲーム開始
          clientSocket.emit('startGame', { roomId });
        });
      });

      clientSocket.on('timerUpdate', (data: { playerId: string; remaining: number; warning: boolean }) => {
        timerUpdateReceived = true;
        expect(data.remaining).toBeGreaterThan(0);
        expect(data.remaining).toBeLessThanOrEqual(60);

        // タイマー確認後、アクション実行してテスト終了
        clientSocket.emit('action', {
          playerId: player1Id,
          action: { type: 'fold' },
        });
      });

      clientSocket.on('actionPerformed', () => {
        expect(timerUpdateReceived).toBe(true);
        client2.disconnect();
        done();
      });

      clientSocket.on('error', (error: any) => {
        if (client2) client2.disconnect();
        done(new Error(error.message));
      });
    }, 15000);
  });

  describe('Auto-fold on Timeout', () => {
    test('should auto-fold player after timeout', (done) => {
      jest.setTimeout(70000); // 70秒タイムアウト

      let roomId: string;
      let player1Id: string;
      let player2Id: string;
      let client2: ClientSocket;

      clientSocket = ioClient(`http://localhost:${PORT}`);

      clientSocket.on('connect', () => {
        clientSocket.emit('createRoom', {
          hostName: 'Player1',
          smallBlind: 10,
          bigBlind: 20,
        });
      });

      clientSocket.on('roomCreated', (data: { roomId: string; hostId: string }) => {
        roomId = data.roomId;
        player1Id = data.hostId;

        // プレイヤー2参加
        client2 = ioClient(`http://localhost:${PORT}`);

        client2.on('connect', () => {
          client2.emit('joinRoom', { roomId, playerName: 'Player2' });
        });

        client2.on('joinedRoom', (data: any) => {
          player2Id = data.playerId;

          // ゲーム開始
          clientSocket.emit('startGame', { roomId });
        });
      });

      clientSocket.on('playerTimeout', (data: { playerId: string }) => {
        // タイムアウトが発生したことを確認
        expect(data.playerId).toBeDefined();
        client2.disconnect();
        done();
      });

      clientSocket.on('error', (error: any) => {
        if (client2) client2.disconnect();
        done(new Error(error.message));
      });
    }, 70000);
  });
});
