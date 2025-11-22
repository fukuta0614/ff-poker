/**
 * ゲームマネージャークラス
 * 全てのルームの管理を行う
 */

import { Room, PublicRoomInfo, Player } from '../types/game';
import { Round } from './Round';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_BUY_IN, MAX_PLAYERS } from '../utils/constants';

export class GameManager {
  private rooms: Map<string, Room>;
  private activeRounds: Map<string, Round>; // roomId -> Round

  constructor() {
    this.rooms = new Map();
    this.activeRounds = new Map();
  }

  /**
   * 新しいルームを作成
   * @param hostName ホストプレイヤー名
   * @param smallBlind スモールブラインド額
   * @param bigBlind ビッグブラインド額
   * @returns 作成されたルームとホストプレイヤー情報
   */
  public createRoom(hostName: string, smallBlind: number, bigBlind: number): { room: Room; host: Player } {
    const roomId = uuidv4().slice(0, 8); // 短いID
    const hostId = uuidv4();

    // ホストプレイヤーを作成
    const hostPlayer: Player = {
      id: hostId,
      name: hostName,
      chips: DEFAULT_BUY_IN,
      seat: 0,
      connected: true,
      lastSeen: Date.now(),
    };

    const room: Room = {
      id: roomId,
      hostId,
      players: [hostPlayer], // ホストを最初のプレイヤーとして追加
      state: 'waiting',
      dealerIndex: 0,
      smallBlind,
      bigBlind,
      pot: 0,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    console.log(`Room created: ${roomId} by ${hostName} (Player ID: ${hostId})`);

    return { room, host: hostPlayer };
  }

  /**
   * ルームを取得
   * @param roomId ルームID
   * @returns ルーム、存在しない場合はundefined
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * ルームを削除
   * @param roomId ルームID
   */
  public deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    console.log(`Room deleted: ${roomId}`);
  }

  /**
   * 全てのルームの公開情報を取得
   * @returns ルーム公開情報の配列
   */
  public listRooms(): PublicRoomInfo[] {
    return Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      playerCount: room.players.length,
      state: room.state,
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind,
    }));
  }

  /**
   * アクティブなルーム数を取得
   * @returns ルーム数
   */
  public getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * プレイヤーをルームに参加させる
   * @param roomId ルームID
   * @param playerName プレイヤー名
   * @returns 参加したプレイヤー情報
   */
  public addPlayer(roomId: string, playerName: string): Player {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    if (room.state !== 'waiting') {
      throw new Error('Game already started');
    }

    if (room.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full');
    }

    const player: Player = {
      id: uuidv4(),
      name: playerName,
      chips: DEFAULT_BUY_IN,
      seat: room.players.length,
      connected: true,
      lastSeen: Date.now(),
    };

    room.players.push(player);
    console.log(`Player ${playerName} joined room ${roomId}`);

    return player;
  }

  /**
   * ゲーム開始
   * @param roomId ルームID
   */
  public startGame(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    if (room.state !== 'waiting') {
      throw new Error('Game already started');
    }

    if (room.players.length < 2) {
      throw new Error('Need at least 2 players');
    }

    room.state = 'in_progress';

    // 新しいラウンドを開始
    this.startNewRound(roomId);
  }

  /**
   * 新しいラウンドを開始
   * @param roomId ルームID
   */
  private startNewRound(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const round = new Round(
      room.players,
      room.dealerIndex,
      room.smallBlind,
      room.bigBlind
    );

    round.start();
    this.activeRounds.set(roomId, round);

    console.log(`Round started in room ${roomId}`);
  }

  /**
   * プレイヤーアクションを実行
   * @param roomId ルームID
   * @param playerId プレイヤーID
   * @param action アクション
   * @param amount 金額（レイズ時）
   */
  public executePlayerAction(
    roomId: string,
    playerId: string,
    action: 'fold' | 'call' | 'raise' | 'check' | 'allin',
    amount?: number
  ): void {
    const round = this.activeRounds.get(roomId);
    if (!round) throw new Error('No active round');

    round.executeAction(playerId, action, amount);

    // NOTE: ベッティングラウンド完了とストリート進行の制御はsocketHandlerで行う
    // GameManagerはアクション実行のみに専念
  }

  /**
   * ラウンド終了処理
   * @param roomId ルームID
   */
  private endRound(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    this.activeRounds.delete(roomId);

    // ディーラーボタンを移動
    room.dealerIndex = (room.dealerIndex + 1) % room.players.length;

    // チップが0のプレイヤーを除外
    room.players = room.players.filter((p) => p.chips > 0);

    if (room.players.length < 2) {
      // ゲーム終了
      room.state = 'finished';
      console.log(`Game finished in room ${roomId}`);
    } else {
      // 次のラウンドを開始
      this.startNewRound(roomId);
    }
  }

  /**
   * アクティブなラウンドを取得
   * @param roomId ルームID
   * @returns ラウンド、存在しない場合はundefined
   */
  public getActiveRound(roomId: string): Round | undefined {
    return this.activeRounds.get(roomId);
  }
}
