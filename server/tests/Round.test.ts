/**
 * Round クラスのユニットテスト
 */

import { Round } from '../src/game/Round';
import { Player } from '../src/types/game';

describe('Round - ターン管理とアクション検証', () => {
  let players: Player[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2, connected: true, lastSeen: Date.now() },
    ];
  });

  describe('executeAction - ターンプレイヤー検証', () => {
    test('現在のターンプレイヤーのみがアクションできる', () => {
      const round = new Round(players, 0, 10, 20);
      round.start();

      const currentBettorId = round.getCurrentBettorId();
      expect(currentBettorId).toBe('p1');

      expect(() => {
        round.executeAction('p1', 'call');
      }).not.toThrow();
    });

    test('ターンでないプレイヤーがアクションするとエラー', () => {
      const round = new Round(players, 0, 10, 20);
      round.start();

      expect(() => {
        round.executeAction('p2', 'call');
      }).toThrow('Not your turn');
    });
  });

  describe('executeAction - チェックの検証', () => {
    test('ベット額が揃っていない場合チェック不可', () => {
      const round = new Round(players, 0, 10, 20);
      round.start();

      expect(() => {
        round.executeAction('p1', 'check');
      }).toThrow('Cannot check, must call or raise');
    });

    test('全員がコールした後、BBはチェック可能', () => {
      const round = new Round(players, 0, 10, 20);
      round.start();

      round.executeAction('p1', 'call');
      round.executeAction('p2', 'call');

      expect(() => {
        round.executeAction('p3', 'check');
      }).not.toThrow();
    });
  });

  describe('executeAction - コールの検証', () => {
    test('コールで正しい額が差し引かれる', () => {
      const round = new Round(players, 0, 10, 20);
      round.start();

      const player = players.find(p => p.id === 'p1')!;
      const initialChips = player.chips;

      round.executeAction('p1', 'call');

      expect(player.chips).toBe(initialChips - 20);
      expect(round.getPlayerBet('p1')).toBe(20);
    });
  });

  describe('executeAction - レイズの検証', () => {
    test('レイズで正しい額が追加される', () => {
      const round = new Round(players, 0, 10, 20);
      round.start();

      const player = players.find(p => p.id === 'p1')!;
      const initialChips = player.chips;

      round.executeAction('p1', 'raise', 50);

      expect(player.chips).toBe(initialChips - 50);
      expect(round.getPlayerBet('p1')).toBe(50);
    });
  });
});

describe('Round - ベッティングラウンド完了判定', () => {
  let players: Player[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2, connected: true, lastSeen: Date.now() },
    ];
  });

  test('全員がコールしただけではまだ完了しない', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');

    expect(round.isBettingComplete()).toBe(false);
  });

  test('BBがチェックするとベッティング完了', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');

    expect(round.isBettingComplete()).toBe(true);
  });

  test('全員フォールドしたら即座に完了', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'fold');
    round.executeAction('p2', 'fold');

    expect(round.isBettingComplete()).toBe(true);
  });
});

describe('Round - ショーダウン', () => {
  let players: Player[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
    ];
  });

  test('performShowdown で勝者が決定される', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // 2人プレイ: p1=Dealer/BB(seat0), p2=SB(seat1)
    // プリフロップ: p2が最初
    round.executeAction('p2', 'call');
    round.executeAction('p1', 'check');

    // フロップ以降: p2が最初
    round.advanceRound();
    round.executeAction('p2', 'check');
    round.executeAction('p1', 'check');

    round.advanceRound();
    round.executeAction('p2', 'check');
    round.executeAction('p1', 'check');

    round.advanceRound();
    round.executeAction('p2', 'check');
    round.executeAction('p1', 'check');

    round.advanceRound();

    const winnings = round.performShowdown();

    expect(winnings.size).toBeGreaterThan(0);

    const totalWinnings = Array.from(winnings.values()).reduce((sum, amount) => sum + amount, 0);
    expect(totalWinnings).toBe(round.getPot());
  });

  test('全員フォールドした場合、最後のプレイヤーが全額獲得', () => {
    const round = new Round(players, 0, 10, 20);

    const p1InitialChips = players[0].chips; // ブラインド支払い前のチップ数

    round.start();

    // p2(SB)がフォールド
    round.executeAction('p2', 'fold');

    // p1(BB)が勝利
    const winnings = round.performShowdown();

    expect(winnings.size).toBe(1);
    expect(winnings.get('p1')).toBe(30);

    // p1はBBで20払い、ポット30獲得なので、最終的に+10
    expect(players[0].chips).toBe(p1InitialChips + 10);
  });
});
