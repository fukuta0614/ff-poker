/**
 * テスト用サーバーヘルパー
 * 統合テストで使用するExpressアプリケーションインスタンスを提供
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
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
  const openApiPath = path.join(__dirname, '../../src/api', 'openapi.yaml');
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
