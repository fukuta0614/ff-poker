/**
 * Socket.io関連の型定義
 */

/**
 * ゲーム状態データ（再接続時に受信）
 */
export interface GameStateData {
  roomId: string;
  players: Array<{
    id: string;
    name: string;
    chips: number;
    seat: number;
  }>;
  communityCards: string[];
  pot: number;
  currentBettorId: string | null;
  playerBets: Record<string, number>;
  hand: [string, string] | null;
}

/**
 * Socket エラーデータ
 */
export interface SocketErrorData {
  message: string;
  code: string;
}

/**
 * 再接続リクエストデータ
 */
export interface ReconnectRequestData {
  playerId: string;
  roomId: string;
}
