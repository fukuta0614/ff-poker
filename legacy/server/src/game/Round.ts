/**
 * ラウンド管理クラス
 * 1つのゲームラウンド（プリフロップ〜リバー、ショーダウン）を管理
 */

import { Deck } from './Deck';
import { HandEvaluator } from './HandEvaluator';
import { PotCalculator } from './PotCalculator';
import type { Player, RoundStage, SidePot } from '../types/game';

// カード型の定義（"As", "Kh"などの文字列）
type Card = string;

export class Round {
  private deck: Deck;
  private players: Player[];
  private dealerIndex: number;
  private smallBlind: number;
  private bigBlind: number;
  private stage: RoundStage;
  private currentBettor: number;
  private communityCards: Card[];
  private playerHands: Map<string, [Card, Card]>;
  private playerBets: Map<string, number>; // 現在のストリートでのベット額
  private cumulativeBets: Map<string, number>; // 全ストリート累計のベット額
  private folded: Set<string>;
  private pot: number;
  private sidePots: SidePot[];
  private hasActed: Set<string>; // アクション済みプレイヤー
  private lastAggressorId: string | null; // 最後にベット/レイズしたプレイヤー
  private minRaiseAmount: number; // 最小レイズ額
  private bigBlindPlayerId: string; // BBプレイヤーのID（プリフロップ用）

  constructor(
    players: Player[],
    dealerIndex: number,
    smallBlind: number,
    bigBlind: number
  ) {
    this.deck = new Deck();
    this.players = players;
    this.dealerIndex = dealerIndex;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.stage = 'preflop';
    this.communityCards = [];
    this.playerHands = new Map();
    this.playerBets = new Map();
    this.cumulativeBets = new Map();
    this.folded = new Set();
    this.pot = 0;
    this.sidePots = [];
    this.hasActed = new Set();
    this.lastAggressorId = null;
    this.minRaiseAmount = bigBlind;

    // プリフロップの最初のベッターを初期化
    // 2人プレイヤー: Small Blind (ディーラー)
    // 3人以上: Big Blindの次 (UTG)
    if (players.length === 2) {
      this.currentBettor = this.getSmallBlindIndex();
    } else {
      this.currentBettor = this.getNextPlayerIndex(this.getBigBlindIndex());
    }

    // BBプレイヤーのIDを保存（プリフロップ用）
    const bbIndex = this.getBigBlindIndex();
    this.bigBlindPlayerId = players[bbIndex].id;
  }

  /**
   * ラウンド開始
   */
  public start(): void {
    this.deck.shuffle();

    // 各プレイヤーに2枚ずつ配る
    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        const card = this.deck.deal(1)[0];
        if (!card) throw new Error('Not enough cards in deck');

        if (!this.playerHands.has(player.id)) {
          this.playerHands.set(player.id, [card, card]); // 一時的に同じカード
        } else {
          const hand = this.playerHands.get(player.id)!;
          this.playerHands.set(player.id, [hand[0], card]);
        }
      }
    }

    // ブラインドを徴収
    this.collectBlinds();
  }

  /**
   * ブラインド徴収
   */
  private collectBlinds(): void {
    const sbIndex = this.getSmallBlindIndex();
    const bbIndex = this.getBigBlindIndex();

    const sbPlayer = this.players[sbIndex];
    const bbPlayer = this.players[bbIndex];

    // スモールブラインド
    const sbAmount = Math.min(this.smallBlind, sbPlayer.chips);
    sbPlayer.chips -= sbAmount;
    this.playerBets.set(sbPlayer.id, sbAmount);
    this.cumulativeBets.set(sbPlayer.id, sbAmount);
    this.pot += sbAmount;

    // ビッグブラインド
    const bbAmount = Math.min(this.bigBlind, bbPlayer.chips);
    bbPlayer.chips -= bbAmount;
    this.playerBets.set(bbPlayer.id, bbAmount);
    this.cumulativeBets.set(bbPlayer.id, bbAmount);
    this.pot += bbAmount;
  }

  /**
   * プレイヤーアクション実行
   */
  public executeAction(
    playerId: string,
    action: 'fold' | 'call' | 'raise' | 'check' | 'allin',
    amount?: number
  ): void {
    // ターンプレイヤー検証
    if (playerId !== this.getCurrentBettorId()) {
      throw new Error('Not your turn');
    }

    // フォールド済みチェック
    if (this.folded.has(playerId)) {
      throw new Error('Player has folded');
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Player not found');

    const currentBet = this.getCurrentBet();
    const playerBet = this.playerBets.get(playerId) || 0;

    switch (action) {
      case 'fold':
        this.folded.add(playerId);
        break;

      case 'check':
        if (playerBet < currentBet) {
          throw new Error('Cannot check, must call or raise');
        }
        break;

      case 'call': {
        const callAmount = currentBet - playerBet;
        const actualAmount = Math.min(callAmount, player.chips);
        player.chips -= actualAmount;
        this.playerBets.set(playerId, playerBet + actualAmount);
        const cumulativeBet = (this.cumulativeBets.get(playerId) || 0) + actualAmount;
        this.cumulativeBets.set(playerId, cumulativeBet);
        this.pot += actualAmount;
        break;
      }

      case 'raise': {
        if (!amount) throw new Error('Raise amount required');
        const totalBet = playerBet + amount;
        if (totalBet <= currentBet) {
          throw new Error('Raise amount too small');
        }
        // 最小レイズ額チェック
        const raiseAmount = totalBet - currentBet;
        if (raiseAmount < this.minRaiseAmount && raiseAmount !== player.chips) {
          throw new Error(`Minimum raise is ${this.minRaiseAmount}`);
        }
        const actualAmount = Math.min(amount, player.chips);
        player.chips -= actualAmount;
        this.playerBets.set(playerId, playerBet + actualAmount);
        const cumulativeBet = (this.cumulativeBets.get(playerId) || 0) + actualAmount;
        this.cumulativeBets.set(playerId, cumulativeBet);
        this.pot += actualAmount;
        // 最小レイズ額を更新
        this.minRaiseAmount = raiseAmount;
        this.lastAggressorId = playerId;
        break;
      }

      case 'allin': {
        const allInAmount = player.chips;
        player.chips = 0;
        this.playerBets.set(playerId, playerBet + allInAmount);
        const cumulativeBet = (this.cumulativeBets.get(playerId) || 0) + allInAmount;
        this.cumulativeBets.set(playerId, cumulativeBet);
        this.pot += allInAmount;
        // オールインがレイズ相当の場合、アグレッサーを更新
        const totalBet = playerBet + allInAmount;
        if (totalBet > currentBet) {
          this.lastAggressorId = playerId;
          const raiseAmount = totalBet - currentBet;
          if (raiseAmount > this.minRaiseAmount) {
            this.minRaiseAmount = raiseAmount;
          }
        }
        break;
      }
    }

    // アクション履歴を記録
    this.hasActed.add(playerId);

    // 次のプレイヤーへ
    this.advanceBettor();
  }

  /**
   * 次のベッティングラウンドへ進む
   */
  public advanceRound(): void {
    // ベット情報をリセット
    this.playerBets.clear();

    // アクション履歴をリセット
    this.hasActed.clear();

    // アグレッサーをリセット
    this.lastAggressorId = null;

    // 最小レイズ額をBBにリセット
    this.minRaiseAmount = this.bigBlind;

    switch (this.stage) {
      case 'preflop':
        // フロップ（3枚）
        this.dealCommunityCards(3);
        this.stage = 'flop';
        break;

      case 'flop':
        // ターン（1枚）
        this.dealCommunityCards(1);
        this.stage = 'turn';
        break;

      case 'turn':
        // リバー（1枚）
        this.dealCommunityCards(1);
        this.stage = 'river';
        break;

      case 'river':
        // ショーダウン
        this.stage = 'showdown';
        break;

      case 'showdown':
        // ラウンド終了
        break;
    }

    // 次のベッターをディーラーの次に設定（SB位置）
    this.currentBettor = this.getNextPlayerIndex(this.dealerIndex);
  }

  /**
   * コミュニティカードを配る
   */
  private dealCommunityCards(count: number): void {
    const cards = this.deck.deal(count);
    if (cards.length < count) throw new Error('Not enough cards in deck');
    this.communityCards.push(...cards);
  }

  /**
   * ショーダウン実行
   */
  public performShowdown(): Map<string, number> {
    const activePlayers = this.players.filter((p) => !this.folded.has(p.id));

    if (activePlayers.length === 1) {
      // 全員フォールドした場合
      const winner = activePlayers[0];
      winner.chips += this.pot;
      return new Map([[winner.id, this.pot]]);
    }

    // 手役評価
    const handResults = new Map<string, { rank: string; value: number }>();
    for (const player of activePlayers) {
      const hand = this.playerHands.get(player.id)!;
      const result = HandEvaluator.evaluate([...hand], this.communityCards);
      handResults.set(player.id, { rank: result.rank, value: result.value });
    }

    // サイドポット計算（累積ベット額を使用）
    this.sidePots = PotCalculator.calculate(this.cumulativeBets, this.folded);

    // 各ポットの勝者決定
    const potWinners = new Map<number, string[]>();
    for (let i = 0; i < this.sidePots.length; i++) {
      const pot = this.sidePots[i];
      const eligiblePlayers = pot.eligiblePlayers;

      let bestValue = -1;
      const winners: string[] = [];

      for (const playerId of eligiblePlayers) {
        const result = handResults.get(playerId);
        if (!result) continue;

        if (result.value > bestValue) {
          bestValue = result.value;
          winners.length = 0;
          winners.push(playerId);
        } else if (result.value === bestValue) {
          winners.push(playerId);
        }
      }

      potWinners.set(i, winners);
    }

    // 配当分配
    const winnings = PotCalculator.distribute(this.sidePots, potWinners);

    // チップ加算
    for (const [playerId, amount] of winnings) {
      const player = this.players.find((p) => p.id === playerId);
      if (player) {
        player.chips += amount;
      }
    }

    return winnings;
  }

  /**
   * アクティブプレイヤー取得（フォールド済み・オールイン済みを除外）
   */
  private getActivePlayers(): Player[] {
    return this.players.filter(p =>
      !this.folded.has(p.id) && p.chips > 0
    );
  }

  /**
   * 全員がアクション済みか
   */
  private hasEveryoneActed(): boolean {
    const activePlayers = this.getActivePlayers();

    // 特殊ケース: 1人だけ残っている
    if (activePlayers.length <= 1) {
      return true;
    }

    // 全アクティブプレイヤーがアクション済みか
    return activePlayers.every(p => this.hasActed.has(p.id));
  }

  /**
   * ベット額が揃っているか
   */
  private areBetsSettled(): boolean {
    const activePlayers = this.getActivePlayers();

    if (activePlayers.length === 0) {
      return true;
    }

    const currentBet = this.getCurrentBet();

    return activePlayers.every(p => {
      const playerBet = this.playerBets.get(p.id) || 0;
      // ベット額が揃っている、またはオールイン
      return playerBet === currentBet || p.chips === 0;
    });
  }

  /**
   * ベッティングラウンドが完了したか
   */
  public isBettingComplete(): boolean {
    // フォールドしていないプレイヤー（オールイン含む）
    const remainingPlayers = this.players.filter((p) => !this.folded.has(p.id));

    // 1人だけ残っている（全員フォールド）
    if (remainingPlayers.length === 1) {
      return true;
    }

    // プリフロップの特殊ケース: BBがアクションする権利を持つ
    if (this.stage === 'preflop' && !this.folded.has(this.bigBlindPlayerId)) {
      // BBがまだアクションしていない場合、ベッティングは未完了
      if (!this.hasActed.has(this.bigBlindPlayerId)) {
        console.log(`[DEBUG] isBettingComplete: false (Preflop - BB has not acted yet)`);
        return false;
      }
    }

    // 全員がアクション済みかつベット額が揃っている
    const acted = this.hasEveryoneActed();
    const settled = this.areBetsSettled();
    console.log(`[DEBUG] isBettingComplete: ${acted && settled} (Acted: ${acted}, Settled: ${settled})`);
    return acted && settled;
  }

  /**
   * ラウンドが完了したか
   */
  public isComplete(): boolean {
    return this.stage === 'showdown';
  }

  /**
   * 現在の最大ベット額
   */
  private getCurrentBet(): number {
    let maxBet = 0;
    for (const bet of this.playerBets.values()) {
      if (bet > maxBet) maxBet = bet;
    }
    return maxBet;
  }

  /**
   * 次のベッター決定
   */
  private advanceBettor(): void {
    this.currentBettor = this.getNextPlayerIndex(this.currentBettor);
  }

  /**
   * 次のプレイヤーのインデックス取得（フォールド済みをスキップ）
   */
  private getNextPlayerIndex(fromIndex: number): number {
    let next = (fromIndex + 1) % this.players.length;
    let attempts = 0;
    const maxAttempts = this.players.length;

    while (this.folded.has(this.players[next].id)) {
      next = (next + 1) % this.players.length;
      attempts++;

      if (attempts >= maxAttempts) {
        // 全員フォールドしている場合
        throw new Error('No active players remaining');
      }
    }
    return next;
  }

  /**
   * スモールブラインドのインデックス
   */
  private getSmallBlindIndex(): number {
    // 2人プレイヤーの場合: ディーラー = Small Blind
    if (this.players.length === 2) {
      return this.dealerIndex;
    }
    // 3人以上: ディーラーの次 = Small Blind
    return (this.dealerIndex + 1) % this.players.length;
  }

  /**
   * ビッグブラインドのインデックス
   */
  private getBigBlindIndex(): number {
    // 2人プレイヤーの場合: ディーラーの次（対面）= Big Blind
    if (this.players.length === 2) {
      return (this.dealerIndex + 1) % this.players.length;
    }
    // 3人以上: ディーラーの次の次 = Big Blind
    return (this.dealerIndex + 2) % this.players.length;
  }

  // Getters
  public getState(): RoundStage {
    return this.stage;
  }

  public getCommunityCards(): Card[] {
    return [...this.communityCards];
  }

  public getPlayerHand(playerId: string): [Card, Card] | undefined {
    return this.playerHands.get(playerId);
  }

  public getPot(): number {
    return this.pot;
  }

  public getCurrentBettorId(): string {
    return this.players[this.currentBettor].id;
  }

  public getPlayerBet(playerId: string): number {
    return this.playerBets.get(playerId) || 0;
  }

  public getAllPlayerBets(): Record<string, number> {
    const bets: Record<string, number> = {};
    for (const [playerId, bet] of this.playerBets) {
      bets[playerId] = bet;
    }
    return bets;
  }

  /**
   * プレイヤーが実行可能なアクション一覧を取得
   */
  public getValidActions(playerId: string): Array<'fold' | 'check' | 'call' | 'raise' | 'allin'> {
    const validActions: Array<'fold' | 'check' | 'call' | 'raise' | 'allin'> = [];

    // ターンでなければ何もできない
    if (playerId !== this.getCurrentBettorId()) {
      return validActions;
    }

    // フォールド済みなら何もできない
    if (this.folded.has(playerId)) {
      return validActions;
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return validActions;

    // チップがなければ何もできない（オールイン済み）
    if (player.chips === 0) {
      return validActions;
    }

    const currentBet = this.getCurrentBet();
    const playerBet = this.playerBets.get(playerId) || 0;
    const callAmount = currentBet - playerBet;

    // フォールドは常に可能
    validActions.push('fold');

    // チェック可能条件: ベット額が揃っている
    if (playerBet >= currentBet) {
      validActions.push('check');
    }

    // コール可能条件: ベットがある、かつチップがある
    if (callAmount > 0 && player.chips > 0) {
      validActions.push('call');
    }

    // レイズ可能条件: チップが最小レイズ額以上ある
    const minRaiseTotal = currentBet + this.minRaiseAmount;
    const requiredChips = minRaiseTotal - playerBet;
    if (player.chips >= requiredChips) {
      validActions.push('raise');
    }

    // オールイン可能条件: チップがある
    if (player.chips > 0) {
      validActions.push('allin');
    }

    return validActions;
  }

  /**
   * アクティブ（フォールドしていない）プレイヤー数を取得
   */
  public getActivePlayersCount(): number {
    return this.players.filter((p) => !this.folded.has(p.id)).length;
  }
}
