/**
 * Socket.io イベント関連の型定義
 */

import { Socket } from 'socket.io';
import { Action, PublicPlayerInfo, PublicRoomInfo, RoundState } from './game';

/**
 * サーバーサイドのSocketに独自プロパティを追加
 */
export interface ServerSocket extends Socket {
  playerId?: string;
  roomId?: string;
}

// クライアント → サーバー

export type JoinRoomData = {
  roomId: string;
  playerName: string;
};

export type LeaveRoomData = {
  roomId: string;
};

export type StartGameData = {
  roomId: string;
};

export type ActionData = {
  roomId: string;
  playerId: string;
  action: Action;
};

export type ChatMessageData = {
  roomId: string;
  playerId: string;
  text: string;
};

export type ReconnectRequestData = {
  roomId: string;
  playerId: string;
};

// サーバー → クライアント

export type RoomStateData = {
  room: {
    id: string;
    players: PublicPlayerInfo[];
    state: string;
    dealerIndex: number;
    pot: number;
  };
};

export type GameStateData = {
  roundState: RoundState;
  playersPublic: PublicPlayerInfo[];
};

export type PrivateHandData = {
  playerId: string;
  cards: string[]; // 例: ["Ah", "Kd"]
};

export type PlayerActionRequestData = {
  playerIndex: number;
  allowedActions: ('fold' | 'check' | 'call' | 'bet' | 'raise')[];
  minBet?: number;
  maxBet?: number;
};

export type ActionResultData = {
  action: Action;
  nextPlayerIndex: number;
  updatedState: Partial<RoundState>;
};

export type GameOverData = {
  winners: {
    playerId: string;
    hand: string;
    payout: number;
  }[];
  payouts: Record<string, number>;
};

export type ErrorData = {
  message: string;
  code?: string;
};
