/**
 * サーバーエントリーポイント
 * Express + Socket.io サーバーを起動
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { GameManagerV2 } from './managers/GameManager';
import { GameService } from './services/GameService';
import { createRoomsRouter } from './api/routes/rooms';
import { createActionsRouter } from './api/routes/actions';

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// GameManagerとGameServiceの初期化
const gameManager = new GameManagerV2();
const gameService = new GameService(gameManager);

// Expressアプリケーション作成
const app = express();

// ミドルウェア設定
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ヘルスチェックエンドポイント
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// OpenAPI仕様書の読み込み
const openApiPath = path.join(__dirname, 'api', 'openapi.yaml');
const openApiSpec = YAML.parse(fs.readFileSync(openApiPath, 'utf8'));

// Swagger UI設定
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FF Poker API Documentation',
}));

// API v1 ルーター
const roomsRouter = createRoomsRouter(gameManager, gameService);
const actionsRouter = createActionsRouter(gameManager, gameService);

app.use('/api/v1/rooms', roomsRouter);
app.use('/api/v1/rooms', actionsRouter);

// API v1 ルートエンドポイント
app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    message: 'FF Poker API v2',
    documentation: '/api-docs',
    version: '2.0.0',
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

// HTTPサーバーの作成
const httpServer = createServer(app);

// サーバー起動（テスト環境では起動しない）
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server v2 is running on port ${PORT}`);
    console.log(`📖 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
  });

  // グレースフルシャットダウン
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
    });
  });
}

export { app, httpServer };
