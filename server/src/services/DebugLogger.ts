/**
 * DebugLogger.ts
 * デバッグログサービス
 *
 * サーバー起動以降のSocket.ioイベントと処理結果をファイルに記録する
 */

import fs from 'fs/promises';
import path from 'path';
import { formatLogEntry } from '../utils/logFormatter';
import type {
  IDebugLogger,
  DebugLoggerOptions,
  SocketEventName,
  LogLevel,
  LogEntry,
  DEFAULT_LOG_PATH,
} from '../types/debugLog';

/**
 * DebugLoggerサービス
 *
 * 開発環境でのみ有効化される (process.env.NODE_ENV !== 'production')
 */
export class DebugLogger implements IDebugLogger {
  private logPath: string;
  private enableInProduction: boolean;

  constructor(options: DebugLoggerOptions = {}) {
    this.logPath = options.logPath || 'logs/debug.log';
    this.enableInProduction = options.enableInProduction || false;
  }

  /**
   * ログが有効かどうかを動的に判定
   * 現在は常に有効
   */
  private get isEnabled(): boolean {
    return true; // 常に有効
    // return this.enableInProduction || process.env.NODE_ENV !== 'production';
  }

  /**
   * ログファイルを初期化する
   *
   * サーバー起動時に呼び出される
   * ディレクトリが存在しない場合は作成する
   */
  async initialize(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const logDir = path.dirname(this.logPath);

      // ディレクトリの存在確認
      try {
        await fs.access(logDir);
        // ディレクトリが既に存在する場合は何もしない
      } catch {
        // ディレクトリが存在しない場合は作成
        await fs.mkdir(logDir, { recursive: true });
      }

      // 既存のログファイルを確認（存在する場合は保持）
      try {
        await fs.readFile(this.logPath, 'utf-8');
        // ファイルが存在する場合は保持（上書きしない）
      } catch {
        // ファイルが存在しない場合は何もしない
      }
    } catch (error) {
      console.error('Failed to initialize log directory:', error);
    }
  }

  /**
   * Socket.ioイベントをログに記録する
   *
   * @param eventName - イベント名
   * @param data - イベントデータ
   */
  async logSocketEvent(eventName: SocketEventName, data: any): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    const message = this.formatSocketEvent(eventName, data);
    await this.writeLog('INFO', message);
  }

  /**
   * 処理結果をログに記録する
   *
   * @param message - ログメッセージ
   * @param level - ログレベル (デフォルト: 'INFO')
   */
  async logProcessingResult(message: string, level: LogLevel = 'INFO'): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.writeLog(level, message);
  }

  /**
   * エラーをログに記録する
   *
   * @param error - エラーオブジェクト
   * @param context - エラーコンテキスト
   */
  async logError(error: Error, context?: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    let message = error.message;

    if (context) {
      // バリデーションエラーの場合のフォーマット
      if (message.includes('Invalid') || message.includes('Validation')) {
        message = `Validation error: ${message} - ${context}`;
      } else {
        message = `${message} - ${context}`;
      }
    }

    await this.writeLog('ERROR', message);
  }

  /**
   * ログファイルの内容を読み込む
   *
   * @returns ログファイルの全内容 (ファイルが存在しない場合は空文字列)
   */
  async readLogs(): Promise<string> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // ファイルが存在しない場合は空文字列を返す
        return '';
      }

      console.error('Failed to read log file:', error);
      return '';
    }
  }

  /**
   * ログファイルをクリアする (開発用)
   */
  async clearLogs(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      await fs.writeFile(this.logPath, '');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // ファイルが存在しない場合は何もしない
        return;
      }

      console.error('Failed to clear log file:', error);
    }
  }

  /**
   * ログをファイルに書き込む (プライベートメソッド)
   *
   * @param level - ログレベル
   * @param message - ログメッセージ
   */
  private async writeLog(level: LogLevel, message: string): Promise<void> {
    try {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
      };

      const formattedLine = formatLogEntry(entry);
      await fs.appendFile(this.logPath, formattedLine + '\n');
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Socket.ioイベントをフォーマットする (プライベートメソッド)
   *
   * @param eventName - イベント名
   * @param data - イベントデータ
   * @returns フォーマット済みメッセージ
   */
  private formatSocketEvent(eventName: SocketEventName, data: any): string {
    const parts: string[] = [`Socket event received: ${eventName}`];

    if (data.playerId) {
      parts.push(`playerId: ${data.playerId}`);
    }

    if (data.roomId) {
      parts.push(`roomId: ${data.roomId}`);
    }

    if (data.action) {
      parts.push(`action: ${data.action}`);
    }

    if (data.amount !== undefined) {
      parts.push(`amount: ${data.amount}`);
    }

    return parts.join(', ');
  }
}
