/**
 * Express アプリケーション設定
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

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

// ルーティング（今後追加）
// import routes from './api/routes';
// app.use('/api', routes);

export default app;
