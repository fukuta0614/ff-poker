/**
 * テスト用サーバーヘルパー
 * 統合テストで使用するExpressアプリケーションインスタンスを提供
 */

import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { GameManagerV2 } from '../../src/managers/GameManager';
import { GameService } from '../../src/services/GameService';
import { createRoomsRouter } from '../../src/api/routes/rooms';
import { createActionsRouter } from '../../src/api/routes/actions';

/**
 * テスト用のExpressアプリケーションを作成
 * サーバーを起動せず、アプリケーションインスタンスのみを返す
 */
export function createTestApp() {
  // GameManagerとGameServiceの初期化（各テストで独立したインスタンス）
  const gameManager = new GameManagerV2();
  const gameService = new GameService(gameManager);

  // Expressアプリケーション作成
  const app = express();

  // ミドルウェア設定
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ヘルスチェックエンドポイント
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: '2.0.0-test', timestamp: new Date().toISOString() });
  });

  // OpenAPI仕様書の読み込み
  const openApiPath = path.join(__dirname, '../..', 'openapi.yaml');
  const openApiSpec = YAML.parse(fs.readFileSync(openApiPath, 'utf8'));

  // Swagger UI設定
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'FF Poker API Documentation (Test)',
  }));

  // API v1 ルーター
  const roomsRouter = createRoomsRouter(gameManager, gameService);
  const actionsRouter = createActionsRouter(gameManager, gameService);

  app.use('/api/v1/rooms', roomsRouter);
  app.use('/api/v1/rooms', actionsRouter);

  // API v1 ルートエンドポイント
  app.get('/api/v1', (_req: Request, res: Response) => {
    res.json({
      message: 'FF Poker API v2 (Test)',
      documentation: '/api-docs',
      version: '2.0.0-test',
    });
  });

  // エラーハンドリングミドルウェア
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Internal server error',
      },
    });
  });

  // 404ハンドラー
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  return app;
}

/**
 * ゲーム状態を取得して、アクティブなプレイヤーIDのリストを返す
 * (folded していないプレイヤー)
 */
export async function getActivePlayerIds(
  app: Application,
  roomId: string,
  requestingPlayerId: string
): Promise<string[]> {
  const stateResponse = await request(app)
    .get(`/api/v1/rooms/${roomId}/state`)
    .query({ playerId: requestingPlayerId });

  if (stateResponse.status !== 200) {
    return [];
  }

  const gameState = stateResponse.body.gameState;
  return gameState.players
    .filter((p: any) => !p.isFolded)
    .map((p: any) => p.id);
}

/**
 * 全アクティブプレイヤーから acknowledge を送信
 */
export async function sendAcknowledgments(
  app: Application,
  roomId: string,
  playerIds: string[]
): Promise<void> {
  for (const playerId of playerIds) {
    await request(app)
      .post(`/api/v1/rooms/${roomId}/actions`)
      .send({
        playerId,
        action: { type: 'acknowledge' },
      });
  }
}

/**
 * アクション実行 + 自動 acknowledge 送信
 *
 * 統合テストで acknowledgment システムに対応するためのヘルパー関数。
 * アクション実行後、全アクティブプレイヤーから自動的に acknowledge を送信する。
 */
export async function executeActionWithAck(
  app: Application,
  roomId: string,
  playerId: string,
  action: any,
  allPlayerIds: string[]
): Promise<any> {
  // アクション実行
  const actionResponse = await request(app)
    .post(`/api/v1/rooms/${roomId}/actions`)
    .send({ playerId, action });

  if (actionResponse.status !== 200) {
    return actionResponse;
  }

  // 全プレイヤーから acknowledge 送信
  await sendAcknowledgments(app, roomId, allPlayerIds);

  return actionResponse;
}
