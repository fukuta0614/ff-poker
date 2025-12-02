/**
 * 統合テスト: ゲームフロー全体をSocket.io通信を含めてテスト
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { GameManager } from '../../src/game/GameManager';
import { setupSocketHandlers } from '../../src/socket/socketHandler';
import { SessionManager } from '../../src/services/SessionManager';
import { TurnTimerManager } from '../../src/services/TurnTimerManager';
import { LoggerService } from '../../src/services/LoggerService';

describe('Game Flow Integration Test', () => {
  let io: SocketIOServer;
  let httpServer: any;
  let gameManager: GameManager;
  let sessionManager: SessionManager;
  let turnTimerManager: TurnTimerManager;
  let logger: LoggerService;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let clientSocket3: ClientSocket;
  const PORT = 4000;

  beforeAll((done) => {
    // HTTPサーバー作成
    httpServer = createServer();

    // Socket.IOサーバー作成
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // サービス初期化
    gameManager = new GameManager();
    sessionManager = new SessionManager();
    turnTimerManager = new TurnTimerManager();
    logger = new LoggerService();

    // ハンドラセットアップ
    setupSocketHandlers(io, gameManager, sessionManager, turnTimerManager, logger);

    // サーバー起動
    httpServer.listen(PORT, () => {
      console.log(`Test server started on port ${PORT}`);
      done();
    });
  });

  afterAll((done) => {
    // クライアント切断
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    if (clientSocket3?.connected) clientSocket3.disconnect();

    // サーバー停止
    io.close();
    httpServer.close(() => {
      console.log('Test server closed');
      done();
    });
  });

  afterEach(() => {
    // 各テスト後にクライアント切断
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    if (clientSocket3?.connected) clientSocket3.disconnect();

    // タイマーをすべてクリア
    turnTimerManager.clearAllTimers();
  });

  /**
   * テスト1: 2プレイヤーでプリフロップベッティングが完了し、フロップに進む
   */
  test('2プレイヤーでプリフロップベッティングが完了し、フロップに進む', (done) => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;
    let player1TurnReceived = false;
    let player2TurnReceived = false;

    // プレイヤー1: ルーム作成
    clientSocket1 = ioClient(`http://localhost:${PORT}`);

    clientSocket1.on('connect', () => {
      console.log('[TEST] Player1 connected');
      clientSocket1.emit('createRoom', {
        hostName: 'Player1',
        smallBlind: 10,
        bigBlind: 20,
      });
    });

    clientSocket1.on('roomCreated', (data: { roomId: string; playerId: string }) => {
      console.log('[TEST] Room created:', data.roomId);
      roomId = data.roomId;
      player1Id = data.playerId; // ホストはすでにプレイヤーとして追加済み

      // プレイヤー2接続
      clientSocket2 = ioClient(`http://localhost:${PORT}`);

      clientSocket2.on('connect', () => {
        console.log('[TEST] Player2 connected');
        clientSocket2.emit('joinRoom', {
          roomId: roomId,
          playerName: 'Player2',
        });
      });

      clientSocket2.on('joinedRoom', (data: any) => {
        console.log('[TEST] Player2 joined room:', data);
        player2Id = data.playerId;

        // 2人揃ったのでゲーム開始
        setTimeout(() => {
          console.log('[TEST] Starting game...');
          clientSocket1.emit('startGame', { roomId });
        }, 100);
      });

      // プレイヤー2: ターン通知受信
      clientSocket2.on('turnNotification', (data: any) => {
        console.log('[TEST] Player2 received turnNotification:', data);

        if (data.playerId === player2Id && !player2TurnReceived) {
          player2TurnReceived = true;
          console.log('[TEST] Player2 turn confirmed. Valid actions:', data.validActions);

          // プレイヤー2がcall
          setTimeout(() => {
            console.log('[TEST] Player2 calling...');
            clientSocket2.emit('action', {
              playerId: player2Id,
              action: { type: 'call' },
            });
          }, 100);
        }
      });

      clientSocket2.on('error', (error: any) => {
        console.error('[TEST] Player2 received error:', error);
        done(new Error(`Player2 error: ${error.message}`));
      });
    });

    // プレイヤー1: ゲーム開始通知
    clientSocket1.on('gameStarted', (data: any) => {
      console.log('[TEST] Game started:', data);
    });

    // プレイヤー1: 手札受信
    clientSocket1.on('dealHand', (data: any) => {
      console.log('[TEST] Player1 received hand:', data.hand);
    });

    // プレイヤー1: ターン通知受信
    clientSocket1.on('turnNotification', (data: any) => {
      console.log('[TEST] Player1 received turnNotification:', data);

      if (data.playerId === player1Id && !player1TurnReceived) {
        player1TurnReceived = true;
        console.log('[TEST] Player1 turn confirmed. Valid actions:', data.validActions);

        // プレイヤー1 (SB) がcall
        setTimeout(() => {
          console.log('[TEST] Player1 calling...');
          clientSocket1.emit('action', {
            playerId: player1Id,
            action: { type: 'call' },
          });
        }, 100);
      }
    });

    // プレイヤー1: アクション実行通知
    clientSocket1.on('actionPerformed', (data: any) => {
      console.log('[TEST] Action performed:', data);
    });

    // プレイヤー1: 新しいストリート通知
    clientSocket1.on('newStreet', (data: any) => {
      console.log('[TEST] New street:', data);

      // フロップに進んだことを確認
      expect(data.state).toBe('flop');
      expect(data.communityCards).toHaveLength(3);
      expect(player1TurnReceived).toBe(true);
      expect(player2TurnReceived).toBe(true);

      done();
    });

    clientSocket1.on('error', (error: any) => {
      console.error('[TEST] Player1 received error:', error);
      done(new Error(`Player1 error: ${error.message}`));
    });
  }, 30000); // 30秒タイムアウト

  /**
   * テスト2: 3プレイヤーでプリフロップ全員アクションを確認
   */
  test('3プレイヤーでプリフロップ全員アクションが正しく実行される', (done) => {
    let roomId: string;
    let player1Id: string; // Dealer/UTG (seat 0)
    let player2Id: string; // SB (seat 1)
    let player3Id: string; // BB (seat 2)

    const turnOrder: string[] = [];

    // プレイヤー1: ルーム作成
    clientSocket1 = ioClient(`http://localhost:${PORT}`);

    clientSocket1.on('connect', () => {
      console.log('[TEST] Player1 connected');
      clientSocket1.emit('createRoom', {
        hostName: 'Player1',
        smallBlind: 10,
        bigBlind: 20,
      });
    });

    clientSocket1.on('roomCreated', (data: { roomId: string; playerId: string }) => {
      console.log('[TEST] Room created:', data.roomId);
      roomId = data.roomId;
      player1Id = data.playerId; // ホストはすでにプレイヤーとして追加済み

      // プレイヤー2接続
      clientSocket2 = ioClient(`http://localhost:${PORT}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('joinRoom', {
          roomId: roomId,
          playerName: 'Player2',
        });
      });

      clientSocket2.on('joinedRoom', (data: any) => {
        console.log('[TEST] Player2 joined room');
        player2Id = data.playerId;

        // プレイヤー3接続
        clientSocket3 = ioClient(`http://localhost:${PORT}`);
        clientSocket3.on('connect', () => {
          clientSocket3.emit('joinRoom', {
            roomId: roomId,
            playerName: 'Player3',
          });
        });

        clientSocket3.on('joinedRoom', (data: any) => {
          console.log('[TEST] Player3 joined room');
          player3Id = data.playerId;

          // 3人揃ったのでゲーム開始
          setTimeout(() => {
            console.log('[TEST] Starting 3-player game...');
            clientSocket1.emit('startGame', { roomId });
          }, 100);
        });

        // プレイヤー3: ターン通知（BB）
        clientSocket3.on('turnNotification', (data: any) => {
          console.log('[TEST] Player3 (BB) received turnNotification:', data);
          if (data.playerId === player3Id) {
            turnOrder.push('player3');
            console.log('[TEST] Player3 (BB) checking...');
            clientSocket3.emit('action', {
              playerId: player3Id,
              action: { type: 'check' },
            });
          }
        });
      });

      // プレイヤー2: ターン通知（SB）
      clientSocket2.on('turnNotification', (data: any) => {
        console.log('[TEST] Player2 (SB) received turnNotification:', data);
        if (data.playerId === player2Id) {
          turnOrder.push('player2');
          console.log('[TEST] Player2 calling...');
          clientSocket2.emit('action', {
            playerId: player2Id,
            action: { type: 'call' },
          });
        }
      });
    });

    // プレイヤー1: ターン通知（UTG/Dealer）
    clientSocket1.on('turnNotification', (data: any) => {
      console.log('[TEST] Player1 (UTG) received turnNotification:', data);
      if (data.playerId === player1Id) {
        turnOrder.push('player1');
        console.log('[TEST] Player1 calling...');
        clientSocket1.emit('action', {
          playerId: player1Id,
          action: { type: 'call' },
        });
      }
    });

    // 新しいストリート（フロップ）に進んだことを確認
    clientSocket1.on('newStreet', (data: any) => {
      console.log('[TEST] New street reached:', data.state);
      console.log('[TEST] Turn order was:', turnOrder);

      // ターン順序を確認: UTG (Player1) → SB (Player2) → BB (Player3)
      expect(turnOrder).toEqual(['player1', 'player2', 'player3']);
      expect(data.state).toBe('flop');

      done();
    });

    clientSocket1.on('error', (error: any) => {
      console.error('[TEST] Error:', error);
      done(new Error(error.message));
    });
  }, 30000); // 30秒タイムアウト

  /**
   * テスト3: プレイヤーがレイズした場合、全員が再度アクションする必要がある
   */
  test('プレイヤーがレイズした場合、全員が再度アクションする', (done) => {
    let roomId: string;
    let player1Id: string; // SB
    let player2Id: string; // BB

    const actions: Array<{ playerId: string; action: string }> = [];

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
      player1Id = data.playerId; // ホストはすでにプレイヤーとして追加済み

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

      // プレイヤー2: ターン通知
      clientSocket2.on('turnNotification', (data: any) => {
        if (data.playerId === player2Id && actions.filter(a => a.playerId === player2Id).length === 0) {
          console.log('[TEST] Player2 first action - raise');
          actions.push({ playerId: player2Id, action: 'raise' });

          // プレイヤー2 (BB) がレイズ
          clientSocket2.emit('action', {
            playerId: player2Id,
            action: { type: 'raise', amount: 40 },
          });
        } else if (data.playerId === player2Id && actions.filter(a => a.playerId === player2Id).length === 1) {
          console.log('[TEST] Player2 second action - check (should not happen in preflop after raise)');
          // レイズ後、プレイヤー1がコールしたら、プレイヤー2にはターンが回ってこないはず
          // もし回ってきたらエラー
          done(new Error('Player2 should not get turn again after Player1 called the raise'));
        }
      });
    });

    // プレイヤー1: ターン通知
    let player1FirstTurn = true;
    clientSocket1.on('turnNotification', (data: any) => {
      if (data.playerId === player1Id && player1FirstTurn) {
        player1FirstTurn = false;
        console.log('[TEST] Player1 first action - call');
        actions.push({ playerId: player1Id, action: 'call' });

        // プレイヤー1 (SB) が最初にcall (BBの20にコール)
        clientSocket1.emit('action', {
          playerId: player1Id,
          action: { type: 'call' },
        });
      } else if (data.playerId === player1Id && !player1FirstTurn) {
        console.log('[TEST] Player1 second action - call raise');
        actions.push({ playerId: player1Id, action: 'call' });

        // プレイヤー1がレイズにコール
        clientSocket1.emit('action', {
          playerId: player1Id,
          action: { type: 'call' },
        });
      }
    });

    // 新しいストリートに進んだら完了
    clientSocket1.on('newStreet', (data: any) => {
      console.log('[TEST] Actions:', actions);

      // アクション順序を確認: SB call → BB raise → SB call
      expect(actions).toHaveLength(3);
      expect(actions[0]).toEqual({ playerId: player1Id, action: 'call' });
      expect(actions[1]).toEqual({ playerId: player2Id, action: 'raise' });
      expect(actions[2]).toEqual({ playerId: player1Id, action: 'call' });

      done();
    });

    clientSocket1.on('error', (error: any) => {
      console.error('[TEST] Error:', error);
      done(new Error(error.message));
    });
  }, 30000); // 30秒タイムアウト

  test('2-player game: P1 folds -> P2 wins immediately (should NOT go to Flop)', (done) => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;

    // 1. Setup game
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

      // Monitor game state
      clientSocket1.on('gameStarted', () => {
        // Wait for turn notification
      });

      clientSocket1.on('turnNotification', (data: any) => {
        // 2-player preflop: SB (Player 1) acts first
        if (data.playerId === player1Id) {
          setTimeout(() => {
            console.log('[TEST] Player1 folding...');
            clientSocket1.emit('action', {
              playerId: player1Id,
              action: { type: 'fold', amount: 0 }
            });
          }, 100);
        }
      });

      // If we receive 'newStreet', it's a BUG (should be showdown/game end)
      clientSocket1.on('newStreet', (data: any) => {
        done(new Error('Bug reproduced: Game advanced to new street instead of ending!'));
      });

      // If we receive 'showdown', it's FIXED
      clientSocket1.on('showdown', (data: any) => {
        try {
          expect(data.players.length).toBe(2);
          console.log('[TEST] Showdown received (Win by Fold verified)');
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  }, 10000);

  test('Multi-round: Complete one hand -> automatically start next hand', (done) => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;
    let handCount = 0;

    // 1. Setup game
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
    });

    // Count hands dealt
    clientSocket1.on('dealHand', (data: any) => {
      handCount++;
      console.log(`[TEST] Player1 received hand #${handCount}`);
      if (handCount === 2) {
        // Second hand dealt - test passed!
        console.log('[TEST] Second hand confirmed, test complete');
        done();
      }
    });

    // Player1 folds immediately to trigger win-by-fold showdown
    clientSocket1.on('turnNotification', (data: any) => {
      if (handCount === 1 && data.playerId === player1Id) {
        setTimeout(() => {
          console.log('[TEST] Player1 folding to trigger showdown...');
          clientSocket1.emit('action', {
            playerId: player1Id,
            action: { type: 'fold', amount: 0 }
          });
        }, 100);
      }
    });

    // Monitor showdown
    let showdownCount = 0;
    clientSocket1.on('showdown', (data: any) => {
      showdownCount++;
      console.log(`[TEST] Showdown #${showdownCount} occurred, waiting for next round...`);
      expect(data.players.length).toBe(2);
    });
  }, 15000); // 15s timeout for multi-round
});
