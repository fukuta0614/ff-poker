/**
 * 再接続機能 - 統合テスト
 *
 * 実際のサーバーとSocket.io-clientを使用した統合テスト
 * サーバーとクライアント間の再接続シナリオを検証
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import { startTestServer, stopTestServer, TestServerInstance } from '../../../../server/src/__tests__/helpers/testServer';

describe('再接続機能 - 統合テスト', () => {
  let server: TestServerInstance;
  let client1: Socket;
  let client2: Socket;
  const TEST_PORT = 3001;
  const GRACE_PERIOD = 5000; // 5秒（テスト用）

  beforeAll(async () => {
    // テスト用サーバー起動
    server = await startTestServer(TEST_PORT, GRACE_PERIOD);
  }, 10000);

  afterAll(async () => {
    // サーバー停止
    await stopTestServer(server);
  });

  beforeEach(() => {
    // 各テスト前にクライアントを初期化
    client1 = io(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      autoConnect: false,
    });

    client2 = io(`http://localhost:${TEST_PORT}`, {
      transports: ['websocket'],
      autoConnect: false,
    });
  });

  afterEach(() => {
    // 各テスト後にクライアント切断
    if (client1.connected) client1.disconnect();
    if (client2.connected) client2.disconnect();
  });

  describe('IT-01: 基本的な再接続フロー', () => {
    it('Socket切断後、5秒以内に再接続できる', async () => {
      let playerId: string;
      let roomId: string;

      // 1. クライアント接続
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      // 2. ルーム作成・参加
      const joinPromise = new Promise((resolve) => {
        client1.on('roomJoined', (data: { playerId: string; roomId: string; players: any[] }) => {
          playerId = data.playerId;
          roomId = data.roomId;
          resolve(data);
        });
      });

      client1.emit('createRoom', { playerName: 'TestPlayer1' });
      await joinPromise;

      expect(playerId).toBeDefined();
      expect(roomId).toBeDefined();

      // 3. Socket強制切断
      client1.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. 再接続
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      // 5. reconnectRequest送信
      const gameStatePromise = new Promise((resolve) => {
        client1.on('gameState', resolve);
      });

      client1.emit('reconnectRequest', { playerId, roomId });

      // 6. gameState受信確認
      const gameState: any = await gameStatePromise;

      expect(gameState).toBeDefined();
      expect(gameState.roomId).toBe(roomId);
      expect(gameState.players).toHaveLength(1);
      expect(gameState.players[0].id).toBe(playerId);
    }, 15000);
  });

  describe('IT-02: グレースピリオド内での再接続', () => {
    it('4.5秒後の再接続が成功する（グレースピリオド5秒未満）', async () => {
      let playerId: string;
      let roomId: string;

      // クライアント接続・ルーム作成
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      const joinPromise = new Promise((resolve) => {
        client1.on('roomJoined', (data: { playerId: string; roomId: string }) => {
          playerId = data.playerId;
          roomId = data.roomId;
          resolve(data);
        });
      });

      client1.emit('createRoom', { playerName: 'TestPlayer1' });
      await joinPromise;

      // Socket切断
      client1.disconnect();

      // 4.5秒待機（グレースピリオド5秒未満）
      await new Promise((resolve) => setTimeout(resolve, 4500));

      // 再接続
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      // reconnectRequest
      const gameStatePromise = new Promise((resolve) => {
        client1.on('gameState', resolve);
      });

      client1.emit('reconnectRequest', { playerId, roomId });

      // gameState受信（成功）
      const gameState: any = await gameStatePromise;
      expect(gameState).toBeDefined();
      expect(gameState.roomId).toBe(roomId);
    }, 20000);
  });

  describe('IT-03: グレースピリオド超過後の再接続失敗', () => {
    it('6秒後の再接続が失敗する（グレースピリオド5秒超過）', async () => {
      let playerId: string;
      let roomId: string;

      // クライアント接続・ルーム作成
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      const joinPromise = new Promise((resolve) => {
        client1.on('roomJoined', (data: { playerId: string; roomId: string }) => {
          playerId = data.playerId;
          roomId = data.roomId;
          resolve(data);
        });
      });

      client1.emit('createRoom', { playerName: 'TestPlayer1' });
      await joinPromise;

      // Socket切断
      client1.disconnect();

      // 6秒待機（グレースピリオド超過）
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // 再接続
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      // reconnectRequest送信
      const errorPromise = new Promise((resolve) => {
        client1.on('error', resolve);
      });

      client1.emit('reconnectRequest', { playerId, roomId });

      // RECONNECT_FAILEDエラー受信
      const error: any = await errorPromise;
      expect(error).toBeDefined();
      expect(error.code).toBe('RECONNECT_FAILED');
    }, 20000);
  });

  describe('IT-04: 複数プレイヤーの再接続', () => {
    it('複数プレイヤーが独立して再接続できる', async () => {
      let player1Id: string;
      let player2Id: string;
      let roomId: string;

      // プレイヤー1: ルーム作成
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      const player1JoinPromise = new Promise((resolve) => {
        client1.on('roomJoined', (data: { playerId: string; roomId: string }) => {
          player1Id = data.playerId;
          roomId = data.roomId;
          resolve(data);
        });
      });

      client1.emit('createRoom', { playerName: 'Player1' });
      await player1JoinPromise;

      // プレイヤー2: ルーム参加
      client2.connect();
      await new Promise((resolve) => client2.on('connect', resolve));

      const player2JoinPromise = new Promise((resolve) => {
        client2.on('roomJoined', (data: { playerId: string }) => {
          player2Id = data.playerId;
          resolve(data);
        });
      });

      client2.emit('joinRoom', { roomId, playerName: 'Player2' });
      await player2JoinPromise;

      // 両方のプレイヤーを切断
      client1.disconnect();
      client2.disconnect();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // プレイヤー1再接続
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      const player1GameStatePromise = new Promise((resolve) => {
        client1.on('gameState', resolve);
      });

      client1.emit('reconnectRequest', { playerId: player1Id, roomId });

      const player1GameState: any = await player1GameStatePromise;
      expect(player1GameState.players).toHaveLength(2);

      // プレイヤー2再接続
      client2.connect();
      await new Promise((resolve) => client2.on('connect', resolve));

      const player2GameStatePromise = new Promise((resolve) => {
        client2.on('gameState', resolve);
      });

      client2.emit('reconnectRequest', { playerId: player2Id, roomId });

      const player2GameState: any = await player2GameStatePromise;
      expect(player2GameState.players).toHaveLength(2);
    }, 20000);
  });

  describe('IT-05: 無効なセッションでの再接続試行', () => {
    it('存在しないplayerIdでの再接続が拒否される', async () => {
      // クライアント接続（ゲームには参加しない）
      client1.connect();
      await new Promise((resolve) => client1.on('connect', resolve));

      // 存在しないplayerIdで再接続試行
      const errorPromise = new Promise((resolve) => {
        client1.on('error', resolve);
      });

      client1.emit('reconnectRequest', {
        playerId: 'invalid-player-id',
        roomId: 'invalid-room-id',
      });

      // RECONNECT_FAILEDエラー受信
      const error: any = await errorPromise;
      expect(error).toBeDefined();
      expect(error.code).toBe('RECONNECT_FAILED');
    }, 10000);
  });
});
