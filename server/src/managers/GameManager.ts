/**
 * GameManagerV2 - ゲーム状態管理層
 *
 * 責務:
 * - ルーム管理（作成、取得、削除）
 * - ゲーム状態管理（Map<roomId, GameState>）
 * - プレイヤー管理
 */

import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, PlayerId } from '@engine/types';
import { Room, RoomState } from '../types/internal';
import { generateShortRoomId } from '../utils/room-id';

const DEFAULT_STARTING_CHIPS = 1000;
const MAX_PLAYERS = 9;
const MAX_ROOM_ID_ATTEMPTS = 10;

export class GameManagerV2 {
  private rooms: Map<string, Room>;
  private gameStates: Map<string, GameState>;

  constructor() {
    this.rooms = new Map();
    this.gameStates = new Map();
  }

  /**
   * ルーム作成
   */
  createRoom(hostName: string, smallBlind: number, bigBlind: number): Room {
    // 短いRoom IDを生成（重複チェック付き）
    let roomId: string;
    let attempts = 0;
    do {
      roomId = generateShortRoomId();
      attempts++;
      if (attempts > MAX_ROOM_ID_ATTEMPTS) {
        throw new Error('Failed to generate unique room ID');
      }
    } while (this.rooms.has(roomId));

    const hostId = `player-${uuidv4()}`;

    const hostPlayer: Player = {
      id: hostId,
      name: hostName,
      chips: DEFAULT_STARTING_CHIPS,
      seat: 0,
    };

    const room: Room = {
      id: roomId,
      hostId,
      players: [hostPlayer],
      state: 'waiting',
      smallBlind,
      bigBlind,
      dealerIndex: 0,
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * ルーム取得
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * ルーム削除
   */
  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    this.gameStates.delete(roomId);
  }

  /**
   * 全ルーム取得
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * プレイヤー追加
   */
  addPlayer(roomId: string, playerName: string, chips?: number): Player {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }

    if (room.state !== 'waiting') {
      throw new Error('Cannot join room: game already in progress');
    }

    if (room.players.length >= MAX_PLAYERS) {
      throw new Error(`Room is full (max ${MAX_PLAYERS} players)`);
    }

    const playerId = `player-${uuidv4()}`;
    const seat = room.players.length;

    const player: Player = {
      id: playerId,
      name: playerName,
      chips: chips ?? DEFAULT_STARTING_CHIPS,
      seat,
    };

    room.players.push(player);
    return player;
  }

  /**
   * プレイヤー削除
   */
  removePlayer(roomId: string, playerId: PlayerId): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }

    room.players = room.players.filter((p) => p.id !== playerId);

    // 全プレイヤーが退出したらルーム削除
    if (room.players.length === 0) {
      this.deleteRoom(roomId);
    }
  }

  /**
   * ゲーム状態を設定
   */
  setGameState(roomId: string, gameState: GameState): void {
    this.gameStates.set(roomId, gameState);
  }

  /**
   * ゲーム状態を取得
   */
  getGameState(roomId: string): GameState | undefined {
    return this.gameStates.get(roomId);
  }

  /**
   * ルームの状態を更新
   */
  setRoomState(roomId: string, state: RoomState): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.state = state;
    }
  }

  /**
   * プレイヤーを取得
   */
  getPlayer(roomId: string, playerId: PlayerId): Player | undefined {
    const room = this.rooms.get(roomId);
    return room?.players.find((p) => p.id === playerId);
  }

  /**
   * ルーム内の全プレイヤーを取得
   */
  getPlayers(roomId: string): Player[] {
    const room = this.rooms.get(roomId);
    return room?.players ?? [];
  }

  /**
   * ディーラーインデックスを進める
   */
  advanceDealerIndex(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
    }
  }
}
