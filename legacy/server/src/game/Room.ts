import { Player, RoomState, PublicRoomInfo, PublicPlayerInfo } from '../types/game';
import { Round } from './Round';
import { MAX_PLAYERS, DEFAULT_BUY_IN } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';

export class Room {
  public readonly id: string;
  public readonly hostId: string;
  public players: Player[];
  public state: RoomState;
  public dealerIndex: number;
  public smallBlind: number;
  public bigBlind: number;
  public pot: number;
  public createdAt: number;
  
  private activeRound: Round | null;

  constructor(hostId: string, hostName: string, smallBlind: number, bigBlind: number) {
    this.id = uuidv4().slice(0, 8);
    this.hostId = hostId;
    this.players = [];
    this.state = 'waiting';
    this.dealerIndex = 0;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.pot = 0;
    this.createdAt = Date.now();
    this.activeRound = null;

    // Add host as first player
    this.addPlayer(hostName, hostId);
  }

  public addPlayer(playerName: string, playerId: string = uuidv4()): Player {
    if (this.state !== 'waiting') {
      throw new Error('Game already started');
    }

    if (this.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full');
    }

    const player: Player = {
      id: playerId,
      name: playerName,
      chips: DEFAULT_BUY_IN,
      seat: this.players.length,
      connected: true,
      lastSeen: Date.now(),
    };

    this.players.push(player);
    return player;
  }

  public getPlayer(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  public removePlayer(playerId: string): void {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  public startRound(): Round {
    if (this.players.length < 2) {
      throw new Error('Need at least 2 players');
    }

    this.state = 'in_progress';
    
    this.activeRound = new Round(
      this.players,
      this.dealerIndex,
      this.smallBlind,
      this.bigBlind
    );
    
    this.activeRound.start();
    return this.activeRound;
  }

  public getRound(): Round | null {
    return this.activeRound;
  }

  public endRound(): void {
    console.log(`[Room ${this.id}] Ending round...`);
    this.activeRound = null;

    // Remove players with 0 chips
    const currentDealer = this.players[this.dealerIndex];
    const playersBefore = this.players.length;
    this.players = this.players.filter(p => p.chips > 0);
    console.log(`[Room ${this.id}] Players remaining: ${this.players.length} (was ${playersBefore})`);

    if (this.players.length < 2) {
      console.log(`[Room ${this.id}] Not enough players, marking as finished`);
      this.state = 'finished';
      return;
    }

    this.rotateDealer(currentDealer);
    console.log(`[Room ${this.id}] Dealer rotated to index ${this.dealerIndex}`);

    // Start next round immediately
    console.log(`[Room ${this.id}] Starting new round...`);
    this.startRound();
    console.log(`[Room ${this.id}] New round started successfully`);
  }

  private rotateDealer(previousDealer: Player): void {
    // Check if previous dealer is still in the game
    const dealerStillExists = this.players.find(p => p.id === previousDealer.id);

    if (dealerStillExists) {
      // Find next player by seat
      const nextDealer = this.players.find(p => p.seat > previousDealer.seat);
      if (nextDealer) {
        this.dealerIndex = this.players.findIndex(p => p.id === nextDealer.id);
      } else {
        this.dealerIndex = 0;
      }
    } else {
      // If dealer was eliminated, find player with next seat
      const nextDealer = this.players.find(p => p.seat > previousDealer.seat);
      if (nextDealer) {
        this.dealerIndex = this.players.findIndex(p => p.id === nextDealer.id);
      } else {
        this.dealerIndex = 0;
      }
    }
  }

  public getPublicInfo(): PublicRoomInfo {
    return {
      id: this.id,
      playerCount: this.players.length,
      state: this.state,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
    };
  }
}
