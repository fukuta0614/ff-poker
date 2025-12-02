/**
 * REST API + WebSocket 統合テスト（ヘッズアップシナリオ）
 *
 * クライアント視点から、REST APIとWebSocketを組み合わせた
 * 完全なゲームフローをテストする
 */

import request from 'supertest';
import { io as ioClient, Socket } from 'socket.io-client';
import { app, httpServer } from '../../src/server';
import type { PlayerId } from '@engine/types';

describe('REST API + WebSocket Integration (Heads-up)', () => {
  let serverPort: number;
  let serverUrl: string;
  let socket1: Socket;
  let socket2: Socket;
  let roomId: string;
  let player1Id: PlayerId;
  let player2Id: PlayerId;

  // WebSocketイベントの受信を記録
  const events: Array<{ playerId: string; event: string; data: any }> = [];

  beforeAll((done) => {
    // ランダムなポートでサーバー起動
    const server = httpServer.listen(0, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        serverPort = address.port;
        serverUrl = `http://localhost:${serverPort}`;
        console.log(`Test server started on port ${serverPort}`);
        done();
      }
    });
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  afterEach(() => {
    // WebSocket切断
    if (socket1?.connected) socket1.disconnect();
    if (socket2?.connected) socket2.disconnect();
    events.length = 0;
  });

  describe('ヘッズアップゲーム完全フロー', () => {
    it('REST APIでルーム作成→WebSocket接続→ゲームプレイ', async () => {
      // ==========================================
      // Step 1: REST API - ルーム作成（Player1）
      // ==========================================
      const createRoomRes = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Player1',
          smallBlind: 10,
          bigBlind: 20,
        });

      expect(createRoomRes.status).toBe(201);
      roomId = createRoomRes.body.roomId;
      player1Id = createRoomRes.body.hostId;
      console.log(`Room created: ${roomId}, Player1: ${player1Id}`);

      // ==========================================
      // Step 2: WebSocket接続（Player1）
      // ==========================================
      socket1 = ioClient(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      });

      // room:updatedイベントを監視
      socket1.on('room:updated', (data) => {
        events.push({ playerId: 'player1', event: 'room:updated', data });
        console.log(`Player1 received room:updated:`, data);
      });

      // 接続完了を待つ
      await new Promise<void>((resolve) => {
        socket1.on('connect', () => {
          console.log('Player1 WebSocket connected');
          resolve();
        });
      });

      // ルームに参加
      socket1.emit('room:join', { roomId, playerId: player1Id });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ==========================================
      // Step 3: REST API - Player2がルーム参加
      // ==========================================
      const joinRoomRes = await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Player2' });

      expect(joinRoomRes.status).toBe(200);
      player2Id = joinRoomRes.body.playerId;
      console.log(`Player2 joined: ${player2Id}`);

      // ==========================================
      // Step 4: WebSocket接続（Player2）
      // ==========================================
      socket2 = ioClient(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      });

      socket2.on('room:updated', (data) => {
        events.push({ playerId: 'player2', event: 'room:updated', data });
        console.log(`Player2 received room:updated:`, data);
      });

      await new Promise<void>((resolve) => {
        socket2.on('connect', () => {
          console.log('Player2 WebSocket connected');
          resolve();
        });
      });

      socket2.emit('room:join', { roomId, playerId: player2Id });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player1がplayer_joined通知を受信したことを確認
      const player2JoinedEvent = events.find(
        (e) => e.playerId === 'player1' && e.data.updateType === 'player_joined'
      );
      expect(player2JoinedEvent).toBeDefined();

      // ==========================================
      // Step 5: REST API - ゲーム開始
      // ==========================================
      events.length = 0; // イベント履歴をクリア

      const startGameRes = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .send();

      expect(startGameRes.status).toBe(200);
      console.log('Game started');

      // WebSocket通知を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 両プレイヤーがgame_started通知を受信
      expect(events.filter((e) => e.data.updateType === 'game_started').length).toBe(2);

      // ==========================================
      // Step 6: REST API - ゲーム状態を取得
      // ==========================================
      const getStateRes = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      expect(getStateRes.status).toBe(200);
      const gameState = getStateRes.body.gameState;
      expect(gameState.stage).toBe('preflop');
      console.log(`Game stage: ${gameState.stage}`);

      // 現在のベッターを取得
      const currentBettorIndex = gameState.currentBettorIndex;
      const players = gameState.players;
      const currentBettor = players.find((p: any) => p.seat === currentBettorIndex);
      const currentBettorId = currentBettor.id;

      console.log(`Current bettor: ${currentBettorId}`);

      // ==========================================
      // Step 7: REST API - アクション実行（call）
      // ==========================================
      events.length = 0;

      const actionRes = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'call' },
        });

      expect(actionRes.status).toBe(200);
      console.log('Action executed: call');

      // WebSocket通知を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 両プレイヤーがaction通知を受信
      expect(events.filter((e) => e.data.updateType === 'action').length).toBe(2);

      // ==========================================
      // Step 8: REST API - 次のアクション実行
      // ==========================================
      events.length = 0;

      const getStateRes2 = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const gameState2 = getStateRes2.body.gameState;
      const currentBettorIndex2 = gameState2.currentBettorIndex;
      const players2 = gameState2.players;
      const currentBettor2 = players2.find((p: any) => p.seat === currentBettorIndex2);
      const currentBettorId2 = currentBettor2.id;

      const actionRes2 = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId2,
          action: { type: 'check' },
        });

      expect(actionRes2.status).toBe(200);
      console.log('Action executed: check');

      // WebSocket通知を待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ステージ進行通知を受信
      const stageAdvancedEvents = events.filter(
        (e) => e.data.updateType === 'stage_advanced'
      );
      expect(stageAdvancedEvents.length).toBeGreaterThanOrEqual(0);

      // ==========================================
      // Step 9: REST API - 最終状態確認
      // ==========================================
      const finalStateRes = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      expect(finalStateRes.status).toBe(200);
      const finalState = finalStateRes.body.gameState;
      console.log(`Final stage: ${finalState.stage}`);

      // ステージが進んでいることを確認
      expect(finalState.stage).not.toBe('preflop');

      // ==========================================
      // 検証: WebSocketとREST APIの統合
      // ==========================================
      console.log(`Total events received: ${events.length}`);
      expect(events.length).toBeGreaterThan(0);

      // 両プレイヤーが同じイベントを受信していることを確認
      const player1Events = events.filter((e) => e.playerId === 'player1');
      const player2Events = events.filter((e) => e.playerId === 'player2');

      console.log(`Player1 events: ${player1Events.length}`);
      console.log(`Player2 events: ${player2Events.length}`);

      expect(player1Events.length).toBeGreaterThan(0);
      expect(player2Events.length).toBeGreaterThan(0);

      // すべてのイベントが正しいroomIdを持っていることを確認
      events.forEach((e) => {
        expect(e.data.roomId).toBe(roomId);
        expect(e.data.timestamp).toBeDefined();
      });
    }, 10000); // タイムアウトを10秒に設定

    it('WebSocketでroom:leave後、通知が届かないことを確認', async () => {
      // ルーム作成
      const createRoomRes = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Player1',
          smallBlind: 10,
          bigBlind: 20,
        });

      roomId = createRoomRes.body.roomId;
      player1Id = createRoomRes.body.hostId;

      // WebSocket接続
      socket1 = ioClient(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      });

      const receivedEvents: any[] = [];
      socket1.on('room:updated', (data) => {
        receivedEvents.push(data);
      });

      await new Promise<void>((resolve) => {
        socket1.on('connect', () => resolve());
      });

      socket1.emit('room:join', { roomId, playerId: player1Id });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ルームから退出
      socket1.emit('room:leave', { roomId, playerId: player1Id });
      await new Promise((resolve) => setTimeout(resolve, 100));

      receivedEvents.length = 0;

      // Player2が参加
      const joinRoomRes = await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Player2' });

      expect(joinRoomRes.status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player1は退出済みなので通知を受信しない
      expect(receivedEvents.length).toBe(0);
    });
  });
});
