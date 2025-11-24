/**
 * デバッグログ機能 TypeScript型定義
 *
 * このファイルはサーバー側で使用する型定義を含む
 *
 * 【信頼性レベル】: 🔵 EARS要件定義書・dataflow.mdより
 *
 * @module debugLog
 */

// =============================================================================
// ログレベル
// =============================================================================

/**
 * ログレベル
 *
 * 【信頼性レベル】: 🔵 要件REQ-301,test-design.mdより
 */
export type LogLevel = 'INFO' | 'ERROR' | 'DEBUG';

// =============================================================================
// ログエントリ
// =============================================================================

/**
 * ログエントリの構造
 *
 * 【信頼性レベル】: 🔵 要件REQ-004,dataflow.mdより
 */
export interface LogEntry {
  /** ISO 8601形式のタイムスタンプ */
  timestamp: string;

  /** ログレベル */
  level: LogLevel;

  /** ログメッセージ */
  message: string;

  /** 追加のメタデータ (オプション) */
  metadata?: Record<string, any>;
}

/**
 * ログフォーマッタの戻り値
 *
 * プレーンテキスト形式のログ行
 * フォーマット: [{timestamp}] [{level}] {message}
 *
 * 【信頼性レベル】: 🔵 要件REQ-004,NFR-301より
 */
export type FormattedLogLine = string;

// =============================================================================
// Socket.io イベント関連
// =============================================================================

/**
 * Socket.ioイベント名
 *
 * 【信頼性レベル】: 🔵 既存socket.ts,要件REQ-105~107より
 */
export type SocketEventName =
  | 'joinRoom'
  | 'leaveRoom'
  | 'startGame'
  | 'action'
  | 'chatMessage'
  | 'reconnectRequest';

/**
 * ログに記録するSocket.ioイベントデータ
 *
 * 【信頼性レベル】: 🔵 既存game.ts,要件REQ-105~107より
 */
export interface LoggableSocketData {
  /** イベント名 */
  event: SocketEventName;

  /** プレイヤーID (存在する場合) */
  playerId?: string;

  /** ルームID (存在する場合) */
  roomId?: string;

  /** アクション種別 (actionイベントの場合) */
  action?: 'fold' | 'check' | 'call' | 'bet' | 'raise';

  /** ベット額 (bet/raiseの場合) */
  amount?: number;

  /** その他のデータ */
  [key: string]: any;
}

// =============================================================================
// DebugLogger サービスインターフェース
// =============================================================================

/**
 * DebugLoggerサービスのオプション
 *
 * 【信頼性レベル】: 🟡 architecture.mdから妥当な推測
 */
export interface DebugLoggerOptions {
  /** ログファイルのパス (デフォルト: 'server/logs/debug.log') */
  logPath?: string;

  /** 本番環境でログを有効化するか (デフォルト: false) */
  enableInProduction?: boolean;

  /** ログレベル (デフォルト: 'INFO') */
  minLogLevel?: LogLevel;
}

/**
 * DebugLoggerサービスのインターフェース
 *
 * 【信頼性レベル】: 🔵 architecture.md,要件REQ-001~003より
 */
export interface IDebugLogger {
  /**
   * ログファイルを初期化する
   *
   * サーバー起動時に呼び出される
   * ディレクトリが存在しない場合は作成する
   *
   * 【信頼性レベル】: 🔵 要件REQ-001,REQ-201より
   */
  initialize(): Promise<void>;

  /**
   * Socket.ioイベントをログに記録する
   *
   * @param eventName - イベント名
   * @param data - イベントデータ
   *
   * 【信頼性レベル】: 🔵 要件REQ-002,REQ-105~107より
   */
  logSocketEvent(eventName: SocketEventName, data: any): Promise<void>;

  /**
   * 処理結果をログに記録する
   *
   * @param message - ログメッセージ
   * @param level - ログレベル (デフォルト: 'INFO')
   *
   * 【信頼性レベル】: 🔵 要件REQ-003,REQ-108より
   */
  logProcessingResult(message: string, level?: LogLevel): Promise<void>;

  /**
   * エラーをログに記録する
   *
   * @param error - エラーオブジェクト
   * @param context - エラーコンテキスト
   *
   * 【信頼性レベル】: 🔵 要件REQ-108より
   */
  logError(error: Error, context?: string): Promise<void>;

  /**
   * ログファイルの内容を読み込む
   *
   * @returns ログファイルの全内容 (ファイルが存在しない場合は空文字列)
   *
   * 【信頼性レベル】: 🔵 要件REQ-006,EDGE-101より
   */
  readLogs(): Promise<string>;

  /**
   * ログファイルをクリアする (開発用)
   *
   * 【信頼性レベル】: 🟡 開発効率化のため妥当な推測
   */
  clearLogs(): Promise<void>;
}

// =============================================================================
// 定数
// =============================================================================

/**
 * デフォルトのログファイルパス
 *
 * 【信頼性レベル】: 🔵 要件REQ-005より
 */
export const DEFAULT_LOG_PATH = 'server/logs/debug.log';

/**
 * ログレベルの優先順位
 *
 * DEBUG < INFO < ERROR
 *
 * 【信頼性レベル】: 🟡 ログレベル仕様から妥当な推測
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  ERROR: 2,
};
