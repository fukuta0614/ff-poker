/**
 * ゲーム関連の型定義
 */

export type Player = {
  id: string; // socket.id または生成されたUUID
  name: string; // プレイヤー名
  chips: number; // 保有チップ数
  seat: number; // 座席番号（0〜5）
  connected: boolean; // 接続状態
  lastSeen: number; // 最終接続時刻（タイムスタンプ）
};

export type RoomState = 'waiting' | 'in_progress' | 'finished';

export type Room = {
  id: string; // ルームID
  hostId: string; // ホストプレイヤーのID
  players: Player[]; // プレイヤー配列（最大6人）
  state: RoomState; // ルーム状態
  dealerIndex: number; // ディーラーの位置
  smallBlind: number; // スモールブラインド額
  bigBlind: number; // ビッグブラインド額
  pot: number; // 現在のポット総額
  sidePots?: SidePot[]; // サイドポット配列
  deckState?: string; // デッキのシリアライズ状態（復元用）
  currentRound?: RoundState; // 現在のラウンド状態
  createdAt: number; // ルーム作成時刻
};

export type RoundStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type RoundState = {
  stage: RoundStage; // ラウンドステージ
  communityCards: string[]; // コミュニティカード（例: ["As", "Td", ...]）
  currentPlayerIndex: number; // 現在のターンのプレイヤーインデックス
  currentBet: number; // 現在のコール額
  bets: Record<string, number>; // 各プレイヤーのベット額
  folded: Set<string>; // フォールドしたプレイヤーのセット
};

export type SidePot = {
  amount: number; // ポット額
  eligiblePlayers: string[]; // このポットに参加できるプレイヤーID配列
};

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export type Action = {
  playerId: string;
  type: ActionType;
  amount?: number; // bet/raiseの場合に必須
};

// 公開されるプレイヤー情報（カード情報を含まない）
export type PublicPlayerInfo = {
  id: string;
  name: string;
  chips: number;
  seat: number;
  connected: boolean;
};

// ルームの公開情報
export type PublicRoomInfo = {
  id: string;
  playerCount: number;
  state: RoomState;
  smallBlind: number;
  bigBlind: number;
};
