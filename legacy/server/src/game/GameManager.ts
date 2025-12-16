import { Player, PublicRoomInfo, GameActionResult, GameEvent, ActionType } from '../types/game';
import { Room } from './Room';
import { Round } from './Round';
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
   * @returns 作成されたルームとホストプレイヤー情報
   */
  public createRoom(hostName: string, smallBlind: number, bigBlind: number): { room: Room; host: Player } {
    const hostId = uuidv4();
    const room = new Room(hostId, hostName, smallBlind, bigBlind);

    this.rooms.set(room.id, room);
    console.log(`Room created: ${room.id} by ${hostName} (Player ID: ${hostId})`);

    // Host is already added in constructor
    const host = room.getPlayer(hostId)!;

    return { room, host };
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
    return Array.from(this.rooms.values()).map((room) => room.getPublicInfo());
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

    const player = room.addPlayer(playerName);
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

    room.startRound();
    console.log(`Round started in room ${roomId}`);
  }

  /**
   * プレイヤーアクションを実行し、ゲーム状態を進行させる
   * @param roomId ルームID
   * @param playerId プレイヤーID
   * @param action アクション
   * @param amount 金額（レイズ時）
   * @returns アクション結果と発生したイベント
   */
  public handlePlayerAction(
    roomId: string,
    playerId: string,
    action: ActionType,
    amount?: number
  ): GameActionResult {
    const events: GameEvent[] = [];
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found', events };
    }

    const round = room.getRound();
    if (!round) {
      return { success: false, error: 'No active round', events };
    }

    try {
      // 1. Action Execution
      const roundAction = action === 'bet' ? 'raise' : action;
      round.executeAction(playerId, roundAction, amount);

      events.push({
        type: 'actionPerformed',
        payload: {
          playerId,
          action,
          amount,
          pot: round.getPot(),
          playerBets: round.getAllPlayerBets(),
        },
      });

      // 2. Check Game State Transitions
      if (round.isComplete()) {
        // Showdown (River complete)
        this.handleShowdown(room, round, events);
        this.handleNextRound(room, events);
      } else if (round.isBettingComplete()) {
        if (round.getActivePlayersCount() === 1) {
          // Win by fold
          this.handleShowdown(room, round, events);
          this.handleNextRound(room, events);
        } else {
          // Advance Street
          round.advanceRound();
          events.push({
            type: 'newStreet',
            payload: {
              state: round.getState(),
              communityCards: round.getCommunityCards(),
            },
          });

          if (round.isComplete()) {
            // Showdown (reached after advancing)
            this.handleShowdown(room, round, events);
            this.handleNextRound(room, events);
          } else {
            // Next Turn
            this.addTurnChangeEvent(round, events);
          }
        }
      } else {
        // Betting continues
        this.addTurnChangeEvent(round, events);
      }

      return { success: true, events };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error', 
        events 
      };
    }
  }

  private handleShowdown(room: Room, round: Round, events: GameEvent[]): void {
    round.performShowdown();
    events.push({
      type: 'showdown',
      payload: {
        players: room.players.map((p) => ({
          id: p.id,
          chips: p.chips,
          hand: round.getPlayerHand(p.id),
        })),
      },
    });
  }

  private handleNextRound(room: Room, events: GameEvent[]): void {
    console.log(`[GameManager] Starting next round for room ${room.id}`);
    room.endRound();

    if (room.state === 'finished') {
      console.log(`[GameManager] Game ended - not enough players`);
      events.push({ type: 'gameEnded', payload: { reason: 'Not enough players' } });
      return;
    }

    const newRound = room.getRound();
    if (newRound) {
      console.log(`[GameManager] New round started - dealer index: ${room.dealerIndex}`);
      events.push({
        type: 'roundStarted',
        payload: {
          roomId: room.id,
          dealerIndex: room.dealerIndex,
          players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            chips: p.chips,
            seat: p.seat,
            connected: p.connected,
            lastSeen: p.lastSeen
          })),
        },
      });

      this.addTurnChangeEvent(newRound, events);
    } else {
      console.log(`[GameManager] Warning: No new round created after endRound()`);
    }
  }

  private addTurnChangeEvent(round: Round, events: GameEvent[]): void {
    const nextBettorId = round.getCurrentBettorId();
    events.push({
      type: 'turnChange',
      payload: {
        playerId: nextBettorId,
        currentBet: round.getPlayerBet(nextBettorId),
        playerBets: round.getAllPlayerBets(),
        validActions: round.getValidActions(nextBettorId),
      },
    });
  }

  /**
   * プレイヤーアクションを実行 (Legacy wrapper for compatibility if needed, but prefer handlePlayerAction)
   * @deprecated Use handlePlayerAction instead
   */
  public executePlayerAction(
    roomId: string,
    playerId: string,
    action: 'fold' | 'call' | 'raise' | 'check' | 'allin',
    amount?: number
  ): void {
    const result = this.handlePlayerAction(roomId, playerId, action, amount);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * ラウンド終了処理
   * @param roomId ルームID
   */
  public endRound(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    room.endRound();
  }

  /**
   * アクティブなラウンドを取得
   * @param roomId ルームID
   * @returns ラウンド、存在しない場合はundefined
   */
  public getActiveRound(roomId: string): Round | undefined {
    const room = this.rooms.get(roomId);
    return room?.getRound() || undefined;
  }
}
