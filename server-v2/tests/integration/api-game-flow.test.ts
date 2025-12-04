/**
 * HTTP API統合テスト - フルゲームフロー
 *
 * supertestを使用してREST APIをテスト
 */

import request from 'supertest';
import { createTestApp, getActivePlayerIds, sendAcknowledgments } from '../helpers/testServer';

describe('API Integration - Full Game Flow', () => {
  const app = createTestApp();
  let roomId: string;
  let hostId: string;
  let player2Id: string;
  let player3Id: string;

  describe('Room Creation and Player Join', () => {
    it('should create a new room', async () => {
      const response = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Alice',
          smallBlind: 10,
          bigBlind: 20,
        })
        .expect(201);

      expect(response.body).toHaveProperty('roomId');
      expect(response.body).toHaveProperty('hostId');
      expect(response.body.roomId).toMatch(/^room-/);
      expect(response.body.hostId).toMatch(/^player-/);

      roomId = response.body.roomId;
      hostId = response.body.hostId;
    });

    it('should get room information', async () => {
      const response = await request(app)
        .get(`/api/v1/rooms/${roomId}`)
        .expect(200);

      expect(response.body.id).toBe(roomId);
      expect(response.body.hostId).toBe(hostId);
      expect(response.body.players).toHaveLength(1);
      expect(response.body.state).toBe('waiting');
    });

    it('should allow player to join room', async () => {
      const response = await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Bob' })
        .expect(200);

      expect(response.body.roomId).toBe(roomId);
      expect(response.body.playerId).toMatch(/^player-/);
      expect(response.body.players).toHaveLength(2);

      player2Id = response.body.playerId;
    });

    it('should allow third player to join', async () => {
      const response = await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Charlie' })
        .expect(200);

      expect(response.body.players).toHaveLength(3);
      player3Id = response.body.playerId;
    });

    it('should return 404 for non-existent room', async () => {
      await request(app)
        .get('/api/v1/rooms/non-existent')
        .expect(404);
    });

    it('should return 400 for invalid room creation', async () => {
      await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: '', // Invalid
          smallBlind: 10,
          bigBlind: 20,
        })
        .expect(400);
    });
  });

  describe('Game Start', () => {
    it('should start the game', async () => {
      const response = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .expect(200);

      expect(response.body).toHaveProperty('gameState');
      expect(response.body.gameState.stage).toBe('preflop');
      expect(response.body.gameState.players).toHaveLength(3);
      expect(response.body.gameState.totalPot).toBeGreaterThan(0); // ブラインド分
    });

    it('should return game state for a player', async () => {
      const response = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: hostId })
        .expect(200);

      expect(response.body.gameState.stage).toBe('preflop');
      // 自分の手札は見える
      const hostPlayer = response.body.gameState.players.find((p: any) => p.id === hostId);
      expect(hostPlayer.hand).toBeDefined();
      expect(hostPlayer.hand).toHaveLength(2);
    });

    it('should not start game with insufficient players', async () => {
      // 新しいルームを作成（1人だけ）
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Solo',
          smallBlind: 10,
          bigBlind: 20,
        })
        .expect(201);

      // ゲーム開始を試みる
      await request(app)
        .post(`/api/v1/rooms/${createResponse.body.roomId}/start`)
        .expect(400);
    });
  });

  describe('Player Actions', () => {
    let currentBettorId: string;

    beforeEach(async () => {
      // 現在のゲーム状態を取得して、ターンのプレイヤーを確認
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: hostId });

      const gameState = stateResponse.body.gameState;
      const currentBettor = gameState.players[gameState.currentBettorIndex];
      currentBettorId = currentBettor.id;
    });

    it('should execute a call action', async () => {
      const response = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: {
            type: 'call',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.gameState).toBeDefined();
    });

    it('should reject action from wrong player', async () => {
      // 現在のターンでないプレイヤーのIDを取得
      const wrongPlayerId = [hostId, player2Id, player3Id].find((id) => id !== currentBettorId);

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: wrongPlayerId,
          action: {
            type: 'fold',
          },
        })
        .expect(400);
    });

    it('should reject invalid action type', async () => {
      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: {
            type: 'invalid_action',
          },
        })
        .expect(400);
    });
  });

  describe('Full Game Scenario', () => {
    let scenario_roomId: string;
    let scenario_players: string[];

    beforeAll(async () => {
      // 新しいルームを作成してフルゲームをテスト
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Player1',
          smallBlind: 5,
          bigBlind: 10,
        });

      scenario_roomId = createResponse.body.roomId;
      scenario_players = [createResponse.body.hostId];

      // 2人追加
      const join1 = await request(app)
        .post(`/api/v1/rooms/${scenario_roomId}/join`)
        .send({ playerName: 'Player2' });
      scenario_players.push(join1.body.playerId);

      const join2 = await request(app)
        .post(`/api/v1/rooms/${scenario_roomId}/join`)
        .send({ playerName: 'Player3' });
      scenario_players.push(join2.body.playerId);

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${scenario_roomId}/start`);
    });

    it('should play through multiple actions', async () => {
      let actionsExecuted = 0;

      // 最大10回までアクションを試行
      for (let i = 0; i < 10; i++) {
        // 現在のゲーム状態を取得
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${scenario_roomId}/state`)
          .query({ playerId: scenario_players[0] });

        const gameState = stateResponse.body.gameState;

        // ゲームが終了していたら中断
        if (gameState.stage === 'ended' || gameState.stage === 'showdown') {
          break;
        }

        const currentBettor = gameState.players[gameState.currentBettorIndex];

        // アクション実行（コール）
        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${scenario_roomId}/actions`)
          .send({
            playerId: currentBettor.id,
            action: { type: 'call' },
          });

        // 成功した場合のみカウント
        if (actionResponse.status === 200) {
          expect(actionResponse.body.success).toBe(true);
          actionsExecuted++;

          // アクション後、全プレイヤーから acknowledge を送信
          const activePlayerIds = await getActivePlayerIds(app, scenario_roomId, scenario_players[0]);
          await sendAcknowledgments(app, scenario_roomId, activePlayerIds);
        } else {
          // 400エラーの場合は終了（ゲームが進行できない状態）
          break;
        }
      }

      // 少なくとも2回はアクションが実行されたことを確認（プリフロップのブラインド後）
      expect(actionsExecuted).toBeGreaterThanOrEqual(2);

      // 最終的なゲーム状態を確認
      const finalState = await request(app)
        .get(`/api/v1/rooms/${scenario_roomId}/state`)
        .query({ playerId: scenario_players[0] });

      expect(finalState.body.gameState).toBeDefined();
      // ゲームが進行していることを確認
      expect(['preflop', 'flop', 'turn', 'river', 'showdown', 'ended']).toContain(
        finalState.body.gameState.stage
      );
    });
  });
});
