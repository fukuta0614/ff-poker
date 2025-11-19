/**
 * サーバー起動エントリーポイント
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { GameManager } from './game/GameManager';
import { setupSocketHandlers } from './socket/socketHandler';

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// GameManagerの初期化
const gameManager = new GameManager();

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
setupSocketHandlers(io, gameManager);

// サーバー起動
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});

export { io };
