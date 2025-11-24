/**
 * DebugLogger.test.ts
 * DebugLoggerサービスのテスト
 */

import fs from 'fs/promises';
import path from 'path';
import { DebugLogger } from '../DebugLogger';

const TEST_LOG_DIR = 'server/logs-test';
const TEST_LOG_PATH = `${TEST_LOG_DIR}/debug.log`;

describe('DebugLogger', () => {
  let logger: DebugLogger;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // 環境変数を保存
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // テスト用ロガーを作成
    logger = new DebugLogger({ logPath: TEST_LOG_PATH });

    // テストディレクトリをクリーンアップ
    try {
      await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  });

  afterEach(async () => {
    // 環境変数を復元
    process.env.NODE_ENV = originalEnv;

    // テストディレクトリをクリーンアップ
    try {
      await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  });

  describe('initialize', () => {
    it('TC-001: ディレクトリが存在しない場合に作成される', async () => {
      await logger.initialize();

      const dirExists = await fs
        .access(TEST_LOG_DIR)
        .then(() => true)
        .catch(() => false);

      expect(dirExists).toBe(true);
    });

    it('TC-002: ディレクトリが既に存在する場合もエラーにならない', async () => {
      await fs.mkdir(TEST_LOG_DIR, { recursive: true });

      await expect(logger.initialize()).resolves.not.toThrow();
    });

    it('TC-003: 既存のログファイルが保持される', async () => {
      const existingContent = '[2025-11-22 10:00:00.000] [INFO] Existing log\n';

      await fs.mkdir(TEST_LOG_DIR, { recursive: true });
      await fs.writeFile(TEST_LOG_PATH, existingContent);

      await logger.initialize();

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toBe(existingContent);
    });

    it('TC-004: 本番環境ではログが無効化される', async () => {
      process.env.NODE_ENV = 'production';
      logger = new DebugLogger({ logPath: TEST_LOG_PATH });

      await logger.initialize();

      const dirExists = await fs
        .access(TEST_LOG_DIR)
        .then(() => true)
        .catch(() => false);

      expect(dirExists).toBe(false);
    });

    it('TC-005: 開発環境でログが有効化される', async () => {
      process.env.NODE_ENV = 'development';
      logger = new DebugLogger({ logPath: TEST_LOG_PATH });

      await logger.initialize();

      const dirExists = await fs
        .access(TEST_LOG_DIR)
        .then(() => true)
        .catch(() => false);

      expect(dirExists).toBe(true);
    });
  });

  describe('logSocketEvent', () => {
    beforeEach(async () => {
      await logger.initialize();
    });

    it('TC-007: joinRoomイベントが正しく記録される', async () => {
      await logger.logSocketEvent('joinRoom', {
        playerId: 'p1',
        roomId: 'abc123',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: joinRoom, playerId: p1, roomId: abc123');
    });

    it('TC-008: actionイベント(call)が正しく記録される', async () => {
      await logger.logSocketEvent('action', {
        playerId: 'p1',
        action: 'call',
        amount: 20,
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: action, playerId: p1, action: call, amount: 20');
    });

    it('TC-009: actionイベント(bet)が正しく記録される', async () => {
      await logger.logSocketEvent('action', {
        playerId: 'p2',
        action: 'bet',
        amount: 50,
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: action, playerId: p2, action: bet, amount: 50');
    });

    it('TC-010: actionイベント(raise)が正しく記録される', async () => {
      await logger.logSocketEvent('action', {
        playerId: 'p3',
        action: 'raise',
        amount: 100,
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: action, playerId: p3, action: raise, amount: 100');
    });

    it('TC-011: actionイベント(fold)が正しく記録される', async () => {
      await logger.logSocketEvent('action', {
        playerId: 'p4',
        action: 'fold',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: action, playerId: p4, action: fold');
    });

    it('TC-012: actionイベント(check)が正しく記録される', async () => {
      await logger.logSocketEvent('action', {
        playerId: 'p5',
        action: 'check',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: action, playerId: p5, action: check');
    });

    it('TC-013: startGameイベントが正しく記録される', async () => {
      await logger.logSocketEvent('startGame', {
        roomId: 'abc123',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: startGame, roomId: abc123');
    });

    it('TC-014: leaveRoomイベントが正しく記録される', async () => {
      await logger.logSocketEvent('leaveRoom', {
        playerId: 'p1',
        roomId: 'abc123',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: leaveRoom, playerId: p1, roomId: abc123');
    });

    it('TC-015: chatMessageイベントが正しく記録される', async () => {
      await logger.logSocketEvent('chatMessage', {
        playerId: 'p1',
        roomId: 'abc123',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: chatMessage, playerId: p1, roomId: abc123');
    });

    it('TC-016: reconnectRequestイベントが正しく記録される', async () => {
      await logger.logSocketEvent('reconnectRequest', {
        playerId: 'p1',
        roomId: 'abc123',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Socket event received: reconnectRequest, playerId: p1, roomId: abc123');
    });

    it('TC-019: 本番環境ではログが記録されない', async () => {
      process.env.NODE_ENV = 'production';
      logger = new DebugLogger({ logPath: TEST_LOG_PATH });
      await logger.initialize();

      await logger.logSocketEvent('joinRoom', {
        playerId: 'p1',
        roomId: 'abc123',
      });

      const fileExists = await fs
        .access(TEST_LOG_PATH)
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(false);
    });
  });

  describe('logProcessingResult', () => {
    beforeEach(async () => {
      await logger.initialize();
    });

    it('TC-020: 処理成功ログが正しく記録される (デフォルトINFO)', async () => {
      await logger.logProcessingResult('Player p1 joined room abc123');

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Player p1 joined room abc123');
    });

    it('TC-021: 処理成功ログが正しく記録される (INFO明示)', async () => {
      await logger.logProcessingResult('Action processed: Player p1 called 20', 'INFO');

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[INFO] Action processed: Player p1 called 20');
    });

    it('TC-022: DEBUGレベルのログが正しく記録される', async () => {
      await logger.logProcessingResult('Debug info: currentBettorIndex=0', 'DEBUG');

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[DEBUG] Debug info: currentBettorIndex=0');
    });
  });

  describe('logError', () => {
    beforeEach(async () => {
      await logger.initialize();
    });

    it('TC-024: バリデーションエラーが正しく記録される', async () => {
      await logger.logError(new Error('Invalid action'), 'player p2 not current bettor');

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[ERROR] Validation error: Invalid action - player p2 not current bettor');
    });

    it('TC-025: エラーオブジェクトのみ (コンテキストなし) でも記録される', async () => {
      await logger.logError(new Error('Unexpected error'));

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[ERROR] Unexpected error');
    });

    it('TC-026: ゲーム状態の不整合エラーが正しく記録される', async () => {
      await logger.logError(new Error('Game state mismatch'), 'currentBettorIndex out of range');

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[ERROR] Game state mismatch - currentBettorIndex out of range');
    });

    it('TC-027: スタックトレースは記録されない (メッセージのみ)', async () => {
      await logger.logError(new Error('Test error'));

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).not.toContain('at ');
      expect(content).toContain('[ERROR] Test error');
    });
  });

  describe('readLogs', () => {
    beforeEach(async () => {
      await logger.initialize();
    });

    it('TC-029: ログファイルが存在する場合、全内容を取得できる', async () => {
      const logContent = '[2025-11-22 10:00:00.000] [INFO] Test log 1\n[2025-11-22 10:00:01.000] [INFO] Test log 2\n';
      await fs.writeFile(TEST_LOG_PATH, logContent);

      const result = await logger.readLogs();

      expect(result).toBe(logContent);
    });

    it('TC-030: ログファイルが存在しない場合、空文字列を返す', async () => {
      await fs.rm(TEST_LOG_PATH, { force: true });

      const result = await logger.readLogs();

      expect(result).toBe('');
    });

    it('TC-031: ログファイルが空の場合、空文字列を返す', async () => {
      await fs.writeFile(TEST_LOG_PATH, '');

      const result = await logger.readLogs();

      expect(result).toBe('');
    });
  });

  describe('clearLogs', () => {
    beforeEach(async () => {
      await logger.initialize();
    });

    it('TC-034: ログファイルがクリアされる', async () => {
      const logContent = '[2025-11-22 10:00:00.000] [INFO] Test log\n';
      await fs.writeFile(TEST_LOG_PATH, logContent);

      await logger.clearLogs();

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toBe('');
    });

    it('TC-035: ログファイルが存在しない場合でもエラーにならない', async () => {
      await fs.rm(TEST_LOG_PATH, { force: true });

      await expect(logger.clearLogs()).resolves.not.toThrow();
    });

    it('TC-036: 本番環境ではログクリアが無効化される', async () => {
      const logContent = '[2025-11-22 10:00:00.000] [INFO] Test log\n';
      await fs.writeFile(TEST_LOG_PATH, logContent);

      process.env.NODE_ENV = 'production';
      logger = new DebugLogger({ logPath: TEST_LOG_PATH });

      await logger.clearLogs();

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toBe(logContent); // 変更されていない
    });
  });

  describe('タイムスタンプとフォーマット', () => {
    beforeEach(async () => {
      await logger.initialize();
    });

    it('TC-041: タイムスタンプがミリ秒まで記録される', async () => {
      await logger.logSocketEvent('joinRoom', {
        playerId: 'p1',
        roomId: 'abc123',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      // タイムスタンプのフォーマットを検証 (YYYY-MM-DD HH:mm:ss.SSS)
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/);
    });

    it('TC-042: ログレベルが正しく記録される', async () => {
      await logger.logProcessingResult('Test message', 'DEBUG');

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      expect(content).toContain('[DEBUG]');
    });

    it('TC-043: ログフォーマットが仕様通り', async () => {
      await logger.logSocketEvent('joinRoom', {
        playerId: 'p1',
        roomId: 'abc123',
      });

      const content = await fs.readFile(TEST_LOG_PATH, 'utf-8');
      // フォーマット: [{timestamp}] [{level}] {message}
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO\] Socket event received: joinRoom, playerId: p1, roomId: abc123/);
    });
  });
});
