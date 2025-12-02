/**
 * サーバー起動エントリーポイント
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { GameManager } from './game/GameManager';
import { setupSocketHandlers } from './socket/socketHandler';
import { SessionManager } from './services/SessionManager';
import { TurnTimerManager } from './services/TurnTimerManager';
import { LoggerService } from './services/LoggerService';

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// サービスの初期化
const logger = new LoggerService();
const gameManager = new GameManager();
const sessionManager = new SessionManager();
const turnTimerManager = new TurnTimerManager();

// HTTPサーバーの作成
const httpServer = createServer(app(gameManager));

// Socket.IOサーバーの作成
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.ioハンドラのセットアップ
setupSocketHandlers(io, gameManager, sessionManager, turnTimerManager, logger);

// セッションクリーンアップ開始
sessionManager.startCleanupInterval();

// サーバー起動
httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`CORS origin: ${CORS_ORIGIN}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  sessionManager.stopCleanupInterval();
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

export { io };
