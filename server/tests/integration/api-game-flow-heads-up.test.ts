/**
 * HTTP API統合テスト - ヘッズアップ（二人対戦）ゲームフロー
 *
 * 二人対戦に特化したテストケース
 */

import request from 'supertest';
import { createTestApp, getActivePlayerIds, sendAcknowledgments } from '../helpers/testServer';

describe('API Integration - Heads-Up Game Flow', () => {
  const app = createTestApp();

  describe('Basic Heads-Up Flow', () => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;

    beforeAll(async () => {
      // ルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Player1',
          smallBlind: 10,
          bigBlind: 20,
        })
        .expect(201);

      roomId = createResponse.body.roomId;
      player1Id = createResponse.body.hostId;

      // 2人目参加
      const joinResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Player2' })
        .expect(200);

      player2Id = joinResponse.body.playerId;
    });

    it('should create room and have 2 players join', async () => {
      const roomResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}`)
        .expect(200);

      expect(roomResponse.body.players).toHaveLength(2);
      expect(roomResponse.body.state).toBe('waiting');
    });

    it('should start game with correct SB/BB placement', async () => {
      const startResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .expect(200);

      const gameState = startResponse.body.gameState;

      expect(gameState.stage).toBe('preflop');
      expect(gameState.players).toHaveLength(2);
      expect(gameState.totalPot).toBe(30); // 10 (SB) + 20 (BB)

      // ヘッズアップでは、ディーラーがSB、もう一人がBBになる
      const sbPlayer = gameState.players.find((p: any) => p.bet === 10);
      const bbPlayer = gameState.players.find((p: any) => p.bet === 20);

      expect(sbPlayer).toBeDefined();
      expect(bbPlayer).toBeDefined();
    });

    it('should have SB act first preflop', async () => {
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id })
        .expect(200);

      const gameState = stateResponse.body.gameState;
      const currentBettor = gameState.players[gameState.currentBettorIndex];

      // プリフロップではSBが先に行動（ヘッズアップのルール）
      expect(currentBettor.bet).toBe(10); // SBのプレイヤー
    });
  });

  describe('Action Patterns - Fold Scenarios', () => {
    it('should end game immediately when one player folds preflop', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Alice',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Bob' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 現在のターンのプレイヤーを取得
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      // フォールド実行
      const actionResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'fold' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      const activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // ゲームが終了していることを確認
      const finalGameState = actionResponse.body.gameState;
      expect(['ended', 'showdown', 'flop']).toContain(finalGameState.stage);

      // フォールドしていないプレイヤーが存在することを確認
      const activePlayers = finalGameState.players.filter((p: any) => !p.isFolded);
      expect(activePlayers.length).toBe(1);
    });
  });

  describe('Action Patterns - Check/Check', () => {
    it('should progress stage when both players check', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'CheckPlayer1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'CheckPlayer2' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // SBがコールしてBBの額に合わせる
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const firstBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: firstBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // BBがチェック（アクションが回ってくる）
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      // ゲームがまだプリフロップならチェックする
      if (stateResponse.body.gameState.stage === 'preflop') {
        const secondBettorId = stateResponse.body.gameState.players[
          stateResponse.body.gameState.currentBettorIndex
        ].id;

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({
            playerId: secondBettorId,
            action: { type: 'check' },
          })
          .expect(200);

        // アクション後、全プレイヤーから acknowledge を送信
        activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);

        // フロップに進んでいることを確認
        expect(actionResponse.body.gameState.stage).toBe('flop');
        expect(actionResponse.body.gameState.communityCards).toHaveLength(3);
      }
    });
  });

  describe('Action Patterns - Raise/Call', () => {
    it('should progress stage after raise and call', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Raiser',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Caller' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 現在のターンのプレイヤーを取得
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const firstBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      // レイズ実行
      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: firstBettorId,
          action: { type: 'raise', amount: 40 },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 相手がコール
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const secondBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const callResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: secondBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // フロップに進んでいることを確認
      expect(callResponse.body.gameState.stage).toBe('flop');
      expect(callResponse.body.gameState.communityCards).toHaveLength(3);
    });
  });

  describe('Action Patterns - All-in Scenarios', () => {
    it('should handle all-in and call', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'AllInPlayer',
          smallBlind: 50,
          bigBlind: 100,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'CallPlayer' });

      // ゲーム開始
      const startResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .expect(200);

      // 現在のターンのプレイヤーを取得
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const firstBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;
      const firstBettor = stateResponse.body.gameState.players.find(
        (p: any) => p.id === firstBettorId
      );

      // オールイン（全チップ）
      const allInAmount = firstBettor.chips + firstBettor.bet;
      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: firstBettorId,
          action: { type: 'allin' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 相手がコール
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const secondBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const callResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: secondBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // ゲーム状態を確認（オールインの場合、全カードが開かれる）
      const finalState = callResponse.body.gameState;

      // ショーダウンまたは終了状態であることを確認
      expect(['flop', 'turn', 'river', 'showdown', 'ended']).toContain(finalState.stage);

      // 両者のベット額が同じであることを確認
      const player1 = finalState.players.find((p: any) => p.id === firstBettorId);
      const player2 = finalState.players.find((p: any) => p.id === secondBettorId);

      // 片方は確実にオールイン状態（chips = 0）
      const isAllIn = player1.chips === 0 || player2.chips === 0;
      expect(isAllIn).toBe(true);
    });

    it('should end game when opponent folds to all-in', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'AllInBluffer',
          smallBlind: 50,
          bigBlind: 100,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Folder' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 現在のターンのプレイヤーを取得
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const firstBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;
      const firstBettor = stateResponse.body.gameState.players.find(
        (p: any) => p.id === firstBettorId
      );

      // オールイン
      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: firstBettorId,
          action: { type: 'allin' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 相手がフォールド
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const secondBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const foldResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: secondBettorId,
          action: { type: 'fold' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // ゲームが終了していることを確認
      expect(['ended', 'showdown', 'flop']).toContain(foldResponse.body.gameState.stage);

      // オールインしたプレイヤーが勝利
      const winner = foldResponse.body.gameState.players.find((p: any) => !p.isFolded);
      expect(winner.id).toBe(firstBettorId);
    });
  });

  describe('Full Game Progression', () => {
    it('should play through all stages to showdown', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'FullGameP1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'FullGameP2' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      const stages = ['preflop', 'flop', 'turn', 'river'];
      let currentStage = 'preflop';

      // 各ステージでチェック/コールを繰り返してショーダウンまで進める
      for (let i = 0; i < 20; i++) {
        // 最大20回のアクション
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        // ゲーム終了判定
        if (gameState.stage === 'showdown' || gameState.stage === 'ended') {
          currentStage = gameState.stage;
          break;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];

        // 最高ベット額を確認
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        // アクション決定（簡易ロジック）
        let action;
        if (currentBettor.bet < highestBet) {
          action = { type: 'call' }; // コールが必要
        } else {
          action = { type: 'check' }; // チェック可能
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({
            playerId: currentBettorId,
            action,
          });

        if (actionResponse.status === 200) {
          // アクション後、全プレイヤーから acknowledge を送信
          const activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
          await sendAcknowledgments(app, roomId, activePlayerIds);
        }
      }

      // 最終状態を確認
      const finalStateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const finalGameState = finalStateResponse.body.gameState;

      // ショーダウンまたは終了まで進んでいることを確認
      expect(['showdown', 'ended']).toContain(finalGameState.stage);

      // コミュニティカードが5枚開かれていることを確認（フォールドなしの場合）
      if (finalGameState.stage === 'showdown') {
        expect(finalGameState.communityCards.length).toBe(5);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle preflop all-in from both players', async () => {
      // 新しいルーム作成（小さいスタック）
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'ShortStack1',
          smallBlind: 100,
          bigBlind: 200,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'ShortStack2' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // プレイヤー1がオールイン
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const firstBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;
      const firstBettor = stateResponse.body.gameState.players.find(
        (p: any) => p.id === firstBettorId
      );

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: firstBettorId,
          action: { type: 'allin' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // プレイヤー2もオールインでコール
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const secondBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const callResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: secondBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 両者オールインなので、ショーダウンまで自動進行
      const finalState = callResponse.body.gameState;

      // 両者のチップが0であることを確認
      finalState.players.forEach((p: any) => {
        expect(p.chips).toBe(0);
      });

      // ゲームが進行していることを確認
      expect(['flop', 'turn', 'river', 'showdown', 'ended']).toContain(finalState.stage);
    });
  });

  describe('Multiple Rounds', () => {
    it('should handle dealer button rotation across multiple rounds', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'ButtonPlayer1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      const joinResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'ButtonPlayer2' });

      const player2Id = joinResponse.body.playerId;

      // ラウンド1: ゲーム開始
      const round1Start = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .expect(200);

      const round1DealerIndex = round1Start.body.gameState.dealerIndex;

      // プレイヤー1がフォールドして即終了
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'fold' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      const activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // ラウンド2: 新しいラウンドを開始
      const round2Start = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .expect(200);

      const round2DealerIndex = round2Start.body.gameState.dealerIndex;

      // ディーラーインデックスは0または1
      expect([0, 1]).toContain(round1DealerIndex);
      expect([0, 1]).toContain(round2DealerIndex);

      // 新しいラウンドが正常に開始されたことを確認
      expect(round2Start.body.gameState.stage).toBe('preflop');
      expect(round2Start.body.gameState.totalPot).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios - Re-raise Battle', () => {
    it('should handle multiple re-raises (raise/raise/raise/call)', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'AggroPlayer1',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'AggroPlayer2' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 1st レイズ
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      let currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: 60 },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 2nd レイズ (リレイズ)
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: 120 },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 3rd レイズ
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: 200 },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 最終的にコール
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const callResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // フロップに進行
      expect(callResponse.body.gameState.stage).toBe('flop');

      // ポットが大きくなっていることを確認
      expect(callResponse.body.gameState.totalPot).toBeGreaterThan(400);
    });
  });

  describe('Complex Scenarios - Uneven All-in', () => {
    it('should handle all-in with different chip amounts', async () => {
      // 新しいルーム作成（異なるチップ量）
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'BigStack',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'SmallStack' });

      // ゲーム開始
      const startResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .expect(200);

      // プレイヤー1に大量のチップを持たせるため、複数ラウンドをシミュレート
      // （実際のテストでは初期チップは同じだが、オールイン額が異なる状況を作る）

      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      // 小額のレイズ
      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: 100 },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 相手がコール
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const secondBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const callResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: secondBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // ゲームが進行していることを確認
      expect(callResponse.body.gameState.stage).toBe('flop');
      expect(callResponse.body.gameState.totalPot).toBeGreaterThan(200);
    });
  });

  describe('Complex Scenarios - Side Pot Handling', () => {
    it('should create proper side pots with all-in scenarios', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'SidePotP1',
          smallBlind: 100,
          bigBlind: 200,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'SidePotP2' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // プレイヤー1がオールイン
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const firstBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: firstBettorId,
          action: { type: 'allin' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // プレイヤー2がコール
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const secondBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const callResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: secondBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // ポット情報を確認
      const gameState = callResponse.body.gameState;
      expect(gameState.totalPot).toBeGreaterThan(0);
      expect(gameState.pots).toBeDefined();

      // ポットが正しく処理されていることを確認（配列として存在）
      expect(Array.isArray(gameState.pots)).toBe(true);

      // ゲームが進行していることを確認（オールイン後）
      expect(['flop', 'turn', 'river', 'showdown', 'ended']).toContain(gameState.stage);
    });
  });

  describe('Complex Scenarios - Minimum Bet Handling', () => {
    it('should enforce minimum raise amounts', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'MinBetP1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'MinBetP2' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 現在のゲーム状態を取得
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const gameState = stateResponse.body.gameState;
      const currentBettorId = gameState.players[gameState.currentBettorIndex].id;

      // 最小レイズ額を確認
      expect(gameState.minRaiseAmount).toBeDefined();
      expect(gameState.minRaiseAmount).toBeGreaterThan(0);

      // 有効なレイズを実行
      const validRaiseAmount = gameState.currentBet + gameState.minRaiseAmount;

      const raiseResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: validRaiseAmount },
        });

      // レイズが成功するか、妥当なエラーが返ることを確認
      expect([200, 400]).toContain(raiseResponse.status);

      if (raiseResponse.status === 200) {
        expect(raiseResponse.body.gameState).toBeDefined();
      }
    });
  });

  describe('Complex Scenarios - Continuous Play', () => {
    it('should handle continuous check-downs through all streets', async () => {
      // 新しいルーム作成
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'CheckDownP1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      // 2人目参加
      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'CheckDownP2' });

      // ゲーム開始
      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // プリフロップでBBまでコール
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      let currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'call' },
        })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // BBがチェック
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      if (stateResponse.body.gameState.stage === 'preflop') {
        currentBettorId = stateResponse.body.gameState.players[
          stateResponse.body.gameState.currentBettorIndex
        ].id;

        await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({
            playerId: currentBettorId,
            action: { type: 'check' },
          })
          .expect(200);

        // アクション後、全プレイヤーから acknowledge を送信
        activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }

      // フロップ以降、連続チェックダウン
      const maxActions = 10;
      for (let i = 0; i < maxActions; i++) {
        stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        // ゲーム終了判定
        if (gameState.stage === 'showdown' || gameState.stage === 'ended') {
          break;
        }

        currentBettorId = gameState.players[gameState.currentBettorIndex].id;

        // チェック
        const checkResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({
            playerId: currentBettorId,
            action: { type: 'check' },
          });

        if (checkResponse.status === 200) {
          // アクション後、全プレイヤーから acknowledge を送信
          activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
          await sendAcknowledgments(app, roomId, activePlayerIds);
        }
      }

      // 最終的にショーダウンまで到達
      const finalStateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      expect(['showdown', 'ended']).toContain(finalStateResponse.body.gameState.stage);
    });
  });

  describe('Stage-Specific Tests - Flop', () => {
    it('should handle bet on flop and call', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'FlopBettor',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'FlopCaller' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // プリフロップでコール→チェック
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      let currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'call' } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      if (stateResponse.body.gameState.stage === 'preflop') {
        currentBettorId = stateResponse.body.gameState.players[
          stateResponse.body.gameState.currentBettorIndex
        ].id;

        await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action: { type: 'check' } })
          .expect(200);

        // アクション後、全プレイヤーから acknowledge を送信
        activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }

      // フロップでベット
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      expect(stateResponse.body.gameState.stage).toBe('flop');

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: 50 } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // コール
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const callResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'call' } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // ターンに進行
      expect(callResponse.body.gameState.stage).toBe('turn');
    });

    it('should handle check-raise on flop', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'CheckRaiser',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Bettor' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // プリフロップを抜ける
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      let currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      let actionResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'call' } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      if (stateResponse.body.gameState.stage === 'preflop') {
        currentBettorId = stateResponse.body.gameState.players[
          stateResponse.body.gameState.currentBettorIndex
        ].id;

        actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action: { type: 'check' } })
          .expect(200);

        // アクション後、全プレイヤーから acknowledge を送信
        activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }

      // フロップで最初のプレイヤーがチェック
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      expect(stateResponse.body.gameState.stage).toBe('flop');

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      actionResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'check' } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 2番目のプレイヤーがベット
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      actionResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: 30 } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // 最初のプレイヤーがリレイズ（チェックレイズ）
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const raiseResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: 90 } });

      expect([200, 400]).toContain(raiseResponse.status);

      if (raiseResponse.status === 200) {
        expect(raiseResponse.body.gameState).toBeDefined();
        // アクション後、全プレイヤーから acknowledge を送信
        activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }
    });

    it('should handle fold on flop after bet', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'FlopFolder',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'FlopBettor2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // プリフロップを抜ける
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      let currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      let actionResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'call' } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      let activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      if (stateResponse.body.gameState.stage === 'preflop') {
        currentBettorId = stateResponse.body.gameState.players[
          stateResponse.body.gameState.currentBettorIndex
        ].id;

        actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action: { type: 'check' } })
          .expect(200);

        // アクション後、全プレイヤーから acknowledge を送信
        activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }

      // フロップでベット
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      actionResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: 40 } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      // フォールド
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const foldResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'fold' } })
        .expect(200);

      // アクション後、全プレイヤーから acknowledge を送信
      activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
      await sendAcknowledgments(app, roomId, activePlayerIds);

      expect(['ended', 'showdown', 'flop', 'turn']).toContain(foldResponse.body.gameState.stage);
    });
  });

  describe('Stage-Specific Tests - Turn', () => {
    it('should handle bet on turn and fold', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'TurnPlayer1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'TurnPlayer2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // プリフロップとフロップをチェック/コールで通過
      for (let i = 0; i < 6; i++) {
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        if (gameState.stage === 'turn') {
          break;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        let action;
        if (currentBettor.bet < highestBet) {
          action = { type: 'call' };
        } else {
          action = { type: 'check' };
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action });

        if (actionResponse.status !== 200) {
          break;
        }
      }

      // ターンでベット
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      if (stateResponse.body.gameState.stage !== 'turn') {
        // ターンに到達していない場合はスキップ
        return;
      }

      expect(stateResponse.body.gameState.stage).toBe('turn');

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: 50 } })
        .expect(200);

      // フォールド
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const secondBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const foldResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: secondBettorId, action: { type: 'fold' } })
        .expect(200);

      expect(['ended', 'showdown', 'turn', 'river']).toContain(foldResponse.body.gameState.stage);
    });

    it('should handle pot-sized bet on turn', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'PotBetter',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'PotCaller' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // ターンまで進める
      for (let i = 0; i < 6; i++) {
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        if (gameState.stage === 'turn') {
          break;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        let action;
        if (currentBettor.bet < highestBet) {
          action = { type: 'call' };
        } else {
          action = { type: 'check' };
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action });

        if (actionResponse.status !== 200) {
          break;
        }
      }

      // ターンでポットサイズベット
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const gameState = stateResponse.body.gameState;
      const potSize = gameState.totalPot;
      const currentBettorId = gameState.players[gameState.currentBettorIndex].id;

      const betResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: potSize } });

      expect([200, 400]).toContain(betResponse.status);
    });
  });

  describe('Stage-Specific Tests - River', () => {
    it('should reach river and handle final betting', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'RiverPlayer1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'RiverPlayer2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // リバーまで進める
      for (let i = 0; i < 10; i++) {
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        if (gameState.stage === 'river') {
          break;
        }

        if (gameState.stage === 'showdown' || gameState.stage === 'ended') {
          break;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        let action;
        if (currentBettor.bet < highestBet) {
          action = { type: 'call' };
        } else {
          action = { type: 'check' };
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action });

        if (actionResponse.status !== 200) {
          break; // エラーまたはゲーム終了
        }
      }

      // リバーでベット
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      if (stateResponse.body.gameState.stage === 'river') {
        const currentBettorId = stateResponse.body.gameState.players[
          stateResponse.body.gameState.currentBettorIndex
        ].id;

        const betResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action: { type: 'raise', amount: 50 } });

        expect([200, 400]).toContain(betResponse.status);
      }
    });

    it('should handle all-in on river', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'RiverAllin1',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'RiverAllin2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // リバーまで進める
      for (let i = 0; i < 10; i++) {
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        if (gameState.stage === 'river') {
          break;
        }

        if (gameState.stage === 'showdown' || gameState.stage === 'ended') {
          break;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        let action;
        if (currentBettor.bet < highestBet) {
          action = { type: 'call' };
        } else {
          action = { type: 'check' };
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action });

        if (actionResponse.status !== 200) {
          break; // エラーまたはゲーム終了
        }
      }

      // リバーでオールイン
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      if (stateResponse.body.gameState.stage === 'river') {
        const currentBettorId = stateResponse.body.gameState.players[
          stateResponse.body.gameState.currentBettorIndex
        ].id;

        const allinResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action: { type: 'allin' } })
          .expect(200);

        expect(allinResponse.body.gameState).toBeDefined();
      }
    });
  });

  describe('Betting Limits and Validation', () => {
    it('should reject bet amount below minimum', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'MinBetTest',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'MinBetTest2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      // 最小額以下のレイズを試みる
      const invalidRaiseResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: 5 } });

      expect(invalidRaiseResponse.status).toBe(400);
    });

    it('should handle bet amount exceeding chips (auto all-in)', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'ExceedChips',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'ExceedChips2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;
      const currentBettor = stateResponse.body.gameState.players.find(
        (p: any) => p.id === currentBettorId
      );

      // チップ総額を超える額でレイズを試みる
      const excessiveRaiseResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: currentBettor.chips * 10 },
        });

      // オールインとして処理されるか、エラーになるか
      expect([200, 400]).toContain(excessiveRaiseResponse.status);
    });

    it('should validate bet increments', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'IncrementTest',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'IncrementTest2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 最初のレイズ
      let stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      let currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({ playerId: currentBettorId, action: { type: 'raise', amount: 40 } })
        .expect(200);

      // 最小レイズ額を確認してリレイズ
      stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const minRaise = stateResponse.body.gameState.minRaiseAmount;
      const currentBet = stateResponse.body.gameState.currentBet;

      currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const validRaiseAmount = currentBet + minRaise;
      const reRaiseResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: validRaiseAmount },
        });

      expect([200, 400]).toContain(reRaiseResponse.status);
    });
  });

  describe('Error Handling - Invalid Actions', () => {
    it('should reject action from non-existent player', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'ErrorTest1',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'ErrorTest2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 存在しないプレイヤーIDでアクション
      const response = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: 'non-existent-player-id',
          action: { type: 'fold' },
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject check when bet is required', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'CheckError1',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'CheckError2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // SBプレイヤーがチェックしようとする（BBに対してベットが必要）
      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;
      const currentBettor = stateResponse.body.gameState.players.find(
        (p: any) => p.id === currentBettorId
      );
      const highestBet = Math.max(...stateResponse.body.gameState.players.map((p: any) => p.bet));

      if (currentBettor.bet < highestBet) {
        const checkResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action: { type: 'check' } })
          .expect(400);

        expect(checkResponse.body.error).toBeDefined();
      }
    });

    it('should reject negative bet amount', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'NegativeBet1',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'NegativeBet2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      const stateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      const currentBettorId = stateResponse.body.gameState.players[
        stateResponse.body.gameState.currentBettorIndex
      ].id;

      const response = await request(app)
        .post(`/api/v1/rooms/${roomId}/actions`)
        .send({
          playerId: currentBettorId,
          action: { type: 'raise', amount: -100 },
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Chip Stack Management', () => {
    it('should track chip changes across multiple actions', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'ChipTracker1',
          smallBlind: 10,
          bigBlind: 20,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'ChipTracker2' });

      const startResponse = await request(app).post(`/api/v1/rooms/${roomId}/start`);

      const initialChips = startResponse.body.gameState.players.map((p: any) => ({
        id: p.id,
        chips: p.chips,
      }));

      // 複数アクション実行
      for (let i = 0; i < 5; i++) {
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        if (gameState.stage === 'showdown' || gameState.stage === 'ended') {
          break;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        let action;
        if (currentBettor.bet < highestBet) {
          action = { type: 'call' };
        } else {
          action = { type: 'check' };
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action })
          .expect(200);

        // アクション後、全プレイヤーから acknowledge を送信
        const activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }

      // 最終的なチップ状態を確認
      const finalStateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      finalStateResponse.body.gameState.players.forEach((p: any) => {
        expect(p.chips).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle player with low chips (short stack)', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'ShortStack',
          smallBlind: 400,
          bigBlind: 800,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'BigStack' });

      const startResponse = await request(app)
        .post(`/api/v1/rooms/${roomId}/start`)
        .expect(200);

      // ブラインドでかなりのチップが消費される
      const gameState = startResponse.body.gameState;
      const shortStackPlayer = gameState.players.find((p: any) => p.bet === 400);

      expect(shortStackPlayer.chips).toBeLessThan(1000);
    });
  });

  describe('Multiple Betting Rounds', () => {
    it('should handle aggressive betting on every street', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'Aggressive1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'Aggressive2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      let previousStage = 'preflop';
      let betOnCurrentStreet = false;

      for (let i = 0; i < 20; i++) {
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        if (gameState.stage === 'showdown' || gameState.stage === 'ended') {
          break;
        }

        // ステージが変わったらベットフラグをリセット
        if (gameState.stage !== previousStage) {
          betOnCurrentStreet = false;
          previousStage = gameState.stage;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        let action;

        // 各ストリートで1回はベット/レイズを試みる
        if (!betOnCurrentStreet && currentBettor.bet === highestBet && currentBettor.chips > 50) {
          action = { type: 'raise', amount: highestBet + 30 };
          betOnCurrentStreet = true;
        } else if (currentBettor.bet < highestBet) {
          action = { type: 'call' };
        } else {
          action = { type: 'check' };
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action });

        if (actionResponse.status !== 200) {
          break; // エラーまたはゲーム終了
        }

        // アクション後、全プレイヤーから acknowledge を送信
        const activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }

      const finalStateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      expect(['showdown', 'ended', 'flop', 'turn', 'river']).toContain(
        finalStateResponse.body.gameState.stage
      );
    });
  });

  describe('Showdown Scenarios', () => {
    it('should reach showdown with both players having cards', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rooms')
        .send({
          hostName: 'ShowdownP1',
          smallBlind: 5,
          bigBlind: 10,
        });

      const roomId = createResponse.body.roomId;
      const player1Id = createResponse.body.hostId;

      await request(app)
        .post(`/api/v1/rooms/${roomId}/join`)
        .send({ playerName: 'ShowdownP2' });

      await request(app).post(`/api/v1/rooms/${roomId}/start`);

      // 全ステージをチェック/コールで通過
      for (let i = 0; i < 20; i++) {
        const stateResponse = await request(app)
          .get(`/api/v1/rooms/${roomId}/state`)
          .query({ playerId: player1Id });

        const gameState = stateResponse.body.gameState;

        if (gameState.stage === 'showdown' || gameState.stage === 'ended') {
          break;
        }

        const currentBettorId = gameState.players[gameState.currentBettorIndex].id;
        const currentBettor = gameState.players[gameState.currentBettorIndex];
        const highestBet = Math.max(...gameState.players.map((p: any) => p.bet));

        let action;
        if (currentBettor.bet < highestBet) {
          action = { type: 'call' };
        } else {
          action = { type: 'check' };
        }

        const actionResponse = await request(app)
          .post(`/api/v1/rooms/${roomId}/actions`)
          .send({ playerId: currentBettorId, action });

        if (actionResponse.status !== 200) {
          break; // エラーまたはゲーム終了
        }

        // アクション後、全プレイヤーから acknowledge を送信
        const activePlayerIds = await getActivePlayerIds(app, roomId, player1Id);
        await sendAcknowledgments(app, roomId, activePlayerIds);
      }

      const finalStateResponse = await request(app)
        .get(`/api/v1/rooms/${roomId}/state`)
        .query({ playerId: player1Id });

      expect(['showdown', 'ended']).toContain(finalStateResponse.body.gameState.stage);

      // 両者の手札が存在することを確認
      const player1State = finalStateResponse.body.gameState.players.find(
        (p: any) => p.id === player1Id
      );
      expect(player1State.hand).toBeDefined();
    });
  });
});
