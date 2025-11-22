/**
 * マイルストーンB 型定義
 * エラーハンドリング関連
 */

/**
 * エラーコード定義
 */
export enum ErrorCode {
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_BET_AMOUNT = 'INVALID_BET_AMOUNT',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  RECONNECT_FAILED = 'RECONNECT_FAILED',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  ROOM_FULL = 'ROOM_FULL',
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS',
}

/**
 * エラーレスポンス（Socket.io）
 */
export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: {
    field?: string;
    expected?: any;
    actual?: any;
    [key: string]: any;
  };
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errorCode?: ErrorCode;
  errorMessage?: string;
  details?: object;
}
