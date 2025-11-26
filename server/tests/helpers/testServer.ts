/**
 * 統合テスト用サーバーヘルパー
 * 実際のExpressサーバーとSocket.ioを起動してテストに使用
 */

import express from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setupSocketHandlers } from '../../src/socket/socketHandler';
import { GameManager } from '../../src/game/GameManager';
import { SessionManager } from '../../src/services/SessionManager';
import { TurnTimerManager } from '../../src/services/TurnTimerManager';
import { LoggerService } from '../../src/services/LoggerService';

export interface TestServerInstance {
  httpServer: HTTPServer;
  io: SocketIOServer;
  gameManager: GameManager;
  sessionManager: SessionManager;
  port: number;
}

/**
 * テスト用サーバーを起動
 * @param port ポート番号（デフォルト: 3001）
 * @param gracePeriod グレースピリオド（デフォルト: 5000ms = 5秒）
 */
export async function startTestServer(
  port: number = 3001,
  gracePeriod: number = 5000
): Promise<TestServerInstance> {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // サービス初期化（テスト用グレースピリオド）
  // 注意: TEST_GRACE_PERIOD環境変数で設定
  const gameManager = new GameManager();
  const sessionManager = new SessionManager();
  const turnTimerManager = new TurnTimerManager();
  const logger = new LoggerService();

  // Socketハンドラーセットアップ
  setupSocketHandlers(io, gameManager, sessionManager, turnTimerManager, logger);

  // サーバー起動
  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => {
      console.log(`[TestServer] Started on port ${port} (grace period: ${gracePeriod}ms)`);
      resolve();
    });
  });

  return {
    httpServer,
    io,
    gameManager,
    sessionManager,
    port,
  };
}

/**
 * テスト用サーバーを停止
 */
export async function stopTestServer(instance: TestServerInstance): Promise<void> {
  return new Promise((resolve) => {
    instance.io.close(() => {
      instance.httpServer.close((err) => {
        if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
          console.error('[TestServer] Error stopping server:', err);
        } else {
          console.log('[TestServer] Stopped');
        }
        // エラーがあっても resolve（テスト終了を保証）
        resolve();
      });
    });
  });
}
