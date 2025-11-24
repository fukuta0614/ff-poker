/**
 * Express アプリケーション設定
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameManager } from './game/GameManager';
import { DebugLogger } from './services/DebugLogger';
import { createRoutes } from './api/routes';

// 環境変数の読み込み
dotenv.config();

export default function createApp(gameManager: GameManager, debugLogger: DebugLogger): Application {
  const app: Application = express();

  // ミドルウェア
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ヘルスチェック
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
    });
  });

  // APIルーティング
  const apiRoutes = createRoutes(gameManager, debugLogger);
  app.use('/api', apiRoutes);

  return app;
}
