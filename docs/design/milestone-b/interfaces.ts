/**
 * マイルストーンB TypeScript型定義
 *
 * このファイルはマイルストーンBで追加される型定義を含みます。
 * 既存の型定義（server/src/types/game.ts, server/src/types/socket.ts）に追加される形で実装します。
 */

// ============================================================================
// セッション管理関連 🔵 REQ-001~004より
// ============================================================================

/**
 * プレイヤーセッション情報
 * SessionManager内で管理される
 */
export interface PlayerSession {
  /** プレイヤーID（UUID） */
  playerId: string;

  /** 現在のSocket ID */
  socketId: string;

  /** 最終接続時刻（タイムスタンプ） */
  lastSeen: number;

  /** セッション作成時刻 */
  createdAt: number;
}

/**
 * セッション検証結果
 */
export interface SessionValidationResult {
  /** セッションが有効かどうか */
  valid: boolean;

  /** セッション情報（有効な場合） */
  session?: PlayerSession;

  /** エラーメッセージ（無効な場合） */
  error?: string;
}

// ============================================================================
// タイムアウト処理関連 🔵 REQ-008~010より
// ============================================================================

/**
 * ターンタイマー情報
 */
export interface TurnTimer {
  /** ルームID */
  roomId: string;

  /** 対象プレイヤーID */
  playerId: string;

  /** タイマー開始時刻 */
  startTime: number;

  /** タイムアウト時間（ミリ秒） */
  duration: number;

  /** NodeJS.Timeout インスタンス */
  timeout: NodeJS.Timeout;
}

/**
 * タイマー更新イベント（Socket.io）
 */
export interface TimerUpdateEvent {
  /** 残り時間（秒） */
  remainingSeconds: number;

  /** 警告状態（残り10秒以下） */
  isWarning: boolean;
}

/**
 * 自動アクション種別
 */
export type AutoActionType = 'check' | 'fold';

/**
 * タイムアウトイベント（Socket.io）
 */
export interface TimeoutEvent {
  /** タイムアウトしたプレイヤーID */
  playerId: string;

  /** 実行された自動アクション */
  autoAction: AutoActionType;

  /** メッセージ */
  message: string;
}

// ============================================================================
// エラーハンドリング関連 🔵 REQ-011~013より
// ============================================================================

/**
 * エラーコード定義
 */
export enum ErrorCode {
  /** 自分のターンでない */
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',

  /** 不正なアクション */
  INVALID_ACTION = 'INVALID_ACTION',

  /** 不正なベット額 */
  INVALID_BET_AMOUNT = 'INVALID_BET_AMOUNT',

  /** ルームが見つからない */
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',

  /** 再接続失敗 */
  RECONNECT_FAILED = 'RECONNECT_FAILED',

  /** タイムアウト */
  TIMEOUT = 'TIMEOUT',

  /** 内部エラー */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  /** ルームが満員 */
  ROOM_FULL = 'ROOM_FULL',

  /** ゲーム進行中 */
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS',
}

/**
 * エラーレスポンス（Socket.io）
 */
export interface ErrorResponse {
  /** エラーコード */
  code: ErrorCode;

  /** ユーザー向けメッセージ（日本語） */
  message: string;

  /** 詳細情報（デバッグ用） */
  details?: {
    /** フィールド名 */
    field?: string;

    /** 期待値 */
    expected?: any;

    /** 実際の値 */
    actual?: any;

    /** 追加のコンテキスト */
    [key: string]: any;
  };
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  /** バリデーション成功 */
  valid: boolean;

  /** エラーコード（失敗時） */
  errorCode?: ErrorCode;

  /** エラーメッセージ（失敗時） */
  errorMessage?: string;

  /** 詳細情報（失敗時） */
  details?: object;
}

// ============================================================================
// ロギング関連 🔵 REQ-014~023より
// ============================================================================

/**
 * ログレベル
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * ログメタデータ（共通）
 */
export interface LogMetadata {
  /** タイムスタンプ */
  timestamp: string;

  /** ログレベル */
  level: LogLevel;

  /** ルームID（該当する場合） */
  roomId?: string;

  /** プレイヤーID（該当する場合） */
  playerId?: string;

  /** Socket ID（該当する場合） */
  socketId?: string;

  /** 追加のコンテキスト */
  [key: string]: any;
}

/**
 * ゲーム開始ログ
 */
export interface GameStartLog extends LogMetadata {
  /** メッセージ */
  message: 'Game started';

  /** プレイヤー一覧 */
  players: string[];

  /** スモールブラインド */
  smallBlind: number;

  /** ビッグブラインド */
  bigBlind: number;

  /** ディーラーインデックス */
  dealerIndex: number;
}

/**
 * カード配布ログ
 */
export interface CardDealLog extends LogMetadata {
  /** メッセージ */
  message: 'Cards dealt';

  /** デッキハッシュ値（監査用） */
  deckHash: string;

  /** 配布枚数 */
  cardCount: number;
}

/**
 * プレイヤーアクションログ
 */
export interface PlayerActionLog extends LogMetadata {
  /** メッセージ */
  message: 'Player action';

  /** アクション種別 */
  action: string;

  /** ベット額（該当する場合） */
  amount?: number;

  /** 残チップ数 */
  remainingChips: number;

  /** ラウンドステージ */
  stage: string;
}

/**
 * ポット計算ログ
 */
export interface PotCalculationLog extends LogMetadata {
  /** メッセージ */
  message: 'Pot calculated';

  /** メインポット額 */
  mainPot: number;

  /** サイドポット詳細 */
  sidePots: Array<{
    amount: number;
    eligiblePlayers: string[];
  }>;

  /** 合計ポット額 */
  totalPot: number;
}

/**
 * 接続ログ
 */
export interface ConnectionLog extends LogMetadata {
  /** メッセージ */
  message: 'Client connected' | 'Client disconnected';

  /** プレイヤー名（該当する場合） */
  playerName?: string;
}

/**
 * エラーログ
 */
export interface ErrorLog extends LogMetadata {
  /** メッセージ */
  message: string;

  /** エラーコード */
  errorCode?: ErrorCode;

  /** スタックトレース */
  stack?: string;

  /** エラーオブジェクト */
  error?: Error;
}

// ============================================================================
// Socket.ioイベント定義（追加分） 🔵 要件定義書より
// ============================================================================

/**
 * 再接続リクエスト（Client → Server）
 */
export interface ReconnectRequestData {
  /** ルームID */
  roomId: string;

  /** プレイヤーID */
  playerId: string;
}

/**
 * 再接続成功レスポンス（Server → Client）
 */
export interface ReconnectSuccessData {
  /** 再接続成功メッセージ */
  message: string;

  /** 現在のゲーム状態 */
  gameState: any; // 既存のGameState型を参照

  /** プレイヤーの手札 */
  privateHand: string[];
}

/**
 * プレイヤー切断通知（Server → Client）
 */
export interface PlayerDisconnectedData {
  /** 切断したプレイヤーID */
  playerId: string;

  /** プレイヤー名 */
  playerName: string;

  /** 残りグレースピリオド（秒） */
  remainingSeconds: number;
}

/**
 * プレイヤー再接続通知（Server → Client）
 */
export interface PlayerReconnectedData {
  /** 再接続したプレイヤーID */
  playerId: string;

  /** プレイヤー名 */
  playerName: string;
}

/**
 * プレイヤータイムアウト通知（Server → Client）
 */
export interface PlayerTimeoutData {
  /** タイムアウトしたプレイヤーID */
  playerId: string;

  /** プレイヤー名 */
  playerName: string;

  /** 理由 */
  reason: 'grace_period_expired' | 'turn_timeout';
}

/**
 * ターン開始通知（Server → Client）
 */
export interface TurnStartData {
  /** 対象プレイヤーID */
  playerId: string;

  /** タイムリミット（秒） */
  timeLimit: number;

  /** 許可されたアクション */
  allowedActions: string[];
}

// ============================================================================
// クライアント側状態管理（追加分） 🟡 React Context設計の妥当な推測
// ============================================================================

/**
 * 接続状態
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

/**
 * クライアント側エラーメッセージ
 */
export interface ClientErrorMessage {
  /** エラーコード */
  code: ErrorCode;

  /** 表示メッセージ */
  message: string;

  /** 表示時刻 */
  timestamp: number;

  /** 自動消去までの時間（ミリ秒） */
  duration: number;
}

/**
 * クライアント側ゲーム状態（既存GameStateに追加するフィールド）
 */
export interface ClientGameStateExtension {
  /** 接続状態 */
  connectionStatus: ConnectionStatus;

  /** 再接続タイマー残り時間（秒、null=非アクティブ） */
  reconnectTimer: number | null;

  /** ターンタイマー残り時間（秒、null=非アクティブ） */
  turnTimer: number | null;

  /** タイマー警告状態 */
  isTimerWarning: boolean;

  /** エラーメッセージ（null=エラーなし） */
  error: ClientErrorMessage | null;

  /** 切断中のプレイヤー一覧 */
  disconnectedPlayers: Map<
    string,
    {
      playerName: string;
      remainingSeconds: number;
    }
  >;
}

// ============================================================================
// サービスクラスインターフェース 🔵 architecture.md設計より
// ============================================================================

/**
 * SessionManagerインターフェース
 */
export interface ISessionManager {
  /**
   * 新規セッション作成
   */
  createSession(playerId: string, socketId: string): void;

  /**
   * セッション更新（lastSeen更新）
   */
  updateSession(playerId: string, socketId: string): void;

  /**
   * 再接続処理
   * @returns 再接続成功の場合true
   */
  reconnect(playerId: string, newSocketId: string): boolean;

  /**
   * セッション有効性確認
   */
  isSessionValid(playerId: string): boolean;

  /**
   * 期限切れセッションのクリーンアップ
   */
  cleanupExpiredSessions(): void;

  /**
   * セッション取得
   */
  getSession(playerId: string): PlayerSession | undefined;
}

/**
 * TurnTimerManagerインターフェース
 */
export interface ITurnTimerManager {
  /**
   * タイマー開始
   */
  startTimer(roomId: string, playerId: string, onTimeout: () => void): void;

  /**
   * タイマーキャンセル
   */
  cancelTimer(roomId: string): void;

  /**
   * 残り時間取得
   * @returns 残り時間（秒）、タイマー非アクティブの場合null
   */
  getRemainingTime(roomId: string): number | null;

  /**
   * タイマーが警告状態か確認（残り10秒以下）
   */
  isWarning(roomId: string): boolean;
}

/**
 * LoggerServiceインターフェース
 */
export interface ILoggerService {
  /**
   * DEBUGレベルログ
   */
  debug(message: string, meta?: object): void;

  /**
   * INFOレベルログ
   */
  info(message: string, meta?: object): void;

  /**
   * WARNレベルログ
   */
  warn(message: string, meta?: object): void;

  /**
   * ERRORレベルログ
   */
  error(message: string, error?: Error, meta?: object): void;

  /**
   * ゲーム開始ログ
   */
  logGameStart(roomId: string, players: string[], config: { smallBlind: number; bigBlind: number; dealerIndex: number }): void;

  /**
   * カード配布ログ
   */
  logCardDeal(roomId: string, deckHash: string, cardCount: number): void;

  /**
   * プレイヤーアクションログ
   */
  logPlayerAction(roomId: string, playerId: string, action: string, amount: number | undefined, remainingChips: number, stage: string): void;

  /**
   * ポット計算ログ
   */
  logPotCalculation(roomId: string, mainPot: number, sidePots: any[], totalPot: number): void;

  /**
   * 接続/切断ログ
   */
  logConnection(socketId: string, playerId: string | undefined, playerName: string | undefined, connected: boolean): void;
}

// ============================================================================
// ユーティリティ型 🟡 実装上の妥当な推測
// ============================================================================

/**
 * 成功レスポンス
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * 失敗レスポンス
 */
export interface FailureResponse {
  success: false;
  error: ErrorResponse;
}

/**
 * APIレスポンス（成功または失敗）
 */
export type ApiResponse<T = any> = SuccessResponse<T> | FailureResponse;

/**
 * Promise型のヘルパー
 */
export type AsyncResult<T> = Promise<ApiResponse<T>>;

// ============================================================================
// 定数定義 🔵 ユーザーヒアリング2025-11-22より
// ============================================================================

/**
 * タイムアウト関連定数
 */
export const TIMEOUT_CONSTANTS = {
  /** グレースピリオド（ミリ秒） */
  GRACE_PERIOD: 120000, // 120秒

  /** ターンタイムアウト（ミリ秒） */
  TURN_TIMEOUT: 60000, // 60秒

  /** タイマー警告閾値（ミリ秒） */
  WARNING_THRESHOLD: 10000, // 10秒

  /** タイマー更新間隔（ミリ秒） */
  TIMER_UPDATE_INTERVAL: 1000, // 1秒

  /** セッションクリーンアップ間隔（ミリ秒） */
  CLEANUP_INTERVAL: 30000, // 30秒
} as const;

/**
 * UI定数
 */
export const UI_CONSTANTS = {
  /** エラートースト表示時間（ミリ秒） */
  TOAST_DURATION: 3000, // 3秒

  /** 再接続モーダル自動非表示時間（ミリ秒） */
  RECONNECT_MODAL_DURATION: 5000, // 5秒
} as const;
