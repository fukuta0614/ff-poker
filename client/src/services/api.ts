/**
 * FF Poker API Client
 * OpenAPI仕様に基づくREST API通信クライアント
 */

import type { components } from '../types/api';

// Remove trailing slash to avoid double slashes in URLs
const API_BASE_URL = (import.meta.env.VITE_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');

// ============================================
// Type Aliases
// ============================================

export type CreateRoomRequest = components['schemas']['CreateRoomRequest'];
export type CreateRoomResponse = components['schemas']['CreateRoomResponse'];
export type RoomResponse = components['schemas']['RoomResponse'];
export type JoinRoomRequest = components['schemas']['JoinRoomRequest'];
export type JoinRoomResponse = components['schemas']['JoinRoomResponse'];
export type ActionRequest = components['schemas']['ActionRequest'];
export type ActionResponse = components['schemas']['ActionResponse'];
export type GameStateResponse = components['schemas']['GameStateResponse'];
export type GameState = components['schemas']['GameState'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

// ============================================
// Custom Error Class
// ============================================

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ============================================
// API Client Class
// ============================================

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * HTTP リクエストのヘルパー関数
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as ErrorResponse;
      const errorMessage = errorData.error?.message || response.statusText;
      const errorCode = errorData.error?.code || 'UNKNOWN_ERROR';
      throw new ApiError(errorMessage, errorCode, errorData.error?.details);
    }

    return response.json();
  }

  // ============================================
  // Room Management APIs
  // ============================================

  /**
   * POST /api/v1/rooms
   * ルーム作成
   */
  async createRoom(data: CreateRoomRequest): Promise<CreateRoomResponse> {
    return this.request<CreateRoomResponse>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * GET /api/v1/rooms/:roomId
   * ルーム情報取得
   */
  async getRoom(roomId: string): Promise<RoomResponse> {
    return this.request<RoomResponse>(`/rooms/${roomId}`, {
      method: 'GET',
    });
  }

  /**
   * POST /api/v1/rooms/:roomId/join
   * ルーム参加
   */
  async joinRoom(
    roomId: string,
    data: JoinRoomRequest
  ): Promise<JoinRoomResponse> {
    return this.request<JoinRoomResponse>(`/rooms/${roomId}/join`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // Game Action APIs
  // ============================================

  /**
   * POST /api/v1/rooms/:roomId/start
   * ゲーム開始
   */
  async startGame(roomId: string): Promise<GameStateResponse> {
    return this.request<GameStateResponse>(`/rooms/${roomId}/start`, {
      method: 'POST',
    });
  }

  /**
   * POST /api/v1/rooms/:roomId/actions
   * プレイヤーアクション実行
   */
  async executeAction(
    roomId: string,
    data: ActionRequest
  ): Promise<ActionResponse> {
    return this.request<ActionResponse>(`/rooms/${roomId}/actions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * GET /api/v1/rooms/:roomId/state?playerId=xxx
   * ゲーム状態取得（プレイヤー視点）
   */
  async getGameState(
    roomId: string,
    playerId: string
  ): Promise<GameStateResponse> {
    return this.request<GameStateResponse>(
      `/rooms/${roomId}/state?playerId=${encodeURIComponent(playerId)}`,
      {
        method: 'GET',
      }
    );
  }
}

// ============================================
// Singleton Export
// ============================================

export const apiClient = new ApiClient();
