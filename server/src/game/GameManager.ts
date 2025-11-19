/**
 * ゲームマネージャークラス
 * 全てのルームの管理を行う
 */

import { Room, PublicRoomInfo } from '../types/game';
import { v4 as uuidv4 } from 'uuid';

export class GameManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map();
  }

  /**
   * 新しいルームを作成
   * @param hostName ホストプレイヤー名
   * @param smallBlind スモールブラインド額
   * @param bigBlind ビッグブラインド額
   * @returns 作成されたルーム
   */
  public createRoom(hostName: string, smallBlind: number, bigBlind: number): Room {
    const roomId = uuidv4().slice(0, 8); // 短いID
    const hostId = uuidv4();

    const room: Room = {
      id: roomId,
      hostId,
      players: [],
      state: 'waiting',
      dealerIndex: 0,
      smallBlind,
      bigBlind,
      pot: 0,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    console.log(`Room created: ${roomId} by ${hostName}`);

    return room;
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
}
