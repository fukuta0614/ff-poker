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

describe('Round - ゲームフロー完全テスト（選択肢が現れない問題の調査）', () => {
  let players: Player[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2, connected: true, lastSeen: Date.now() },
    ];
  });

  test('3人プレイ: プリフロップ全員コール→フロップ全員チェックでターンへ進む', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // プリフロップ: p1(UTG)→p2(SB)→p3(BB)
    expect(round.getCurrentBettorId()).toBe('p1');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p1', 'call'); // p1: 20
    expect(round.getCurrentBettorId()).toBe('p2');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p2', 'call'); // p2: 20 (10→20)
    expect(round.getCurrentBettorId()).toBe('p3');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p3', 'check'); // p3: 20 (already BB)
    expect(round.isBettingComplete()).toBe(true);

    // フロップへ
    round.advanceRound();
    expect(round.getState()).toBe('flop');
    expect(round.getCommunityCards().length).toBe(3);

    // フロップ: p2(SB)→p3(BB)→p1
    expect(round.getCurrentBettorId()).toBe('p2');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p2', 'check');
    expect(round.getCurrentBettorId()).toBe('p3');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p3', 'check');
    expect(round.getCurrentBettorId()).toBe('p1');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p1', 'check');
    expect(round.isBettingComplete()).toBe(true);

    // ターンへ
    round.advanceRound();
    expect(round.getState()).toBe('turn');
    expect(round.getCommunityCards().length).toBe(4);
  });

  test('3人プレイ: フロップでレイズ→コール→コールで進む', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // プリフロップ: 全員コール
    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');

    // フロップへ
    round.advanceRound();
    expect(round.getState()).toBe('flop');

    // フロップ: p2がレイズ
    expect(round.getCurrentBettorId()).toBe('p2');
    round.executeAction('p2', 'raise', 50);
    expect(round.getCurrentBettorId()).toBe('p3');
    expect(round.isBettingComplete()).toBe(false);

    // p3がコール
    round.executeAction('p3', 'call');
    expect(round.getCurrentBettorId()).toBe('p1');
    expect(round.isBettingComplete()).toBe(false);

    // p1がコール
    round.executeAction('p1', 'call');
    expect(round.isBettingComplete()).toBe(true);

    // ターンへ進める
    round.advanceRound();
    expect(round.getState()).toBe('turn');
  });

  test('3人プレイ: フロップでベット→フォールド→コールで進む', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // プリフロップ: 全員コール
    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');

    // フロップへ
    round.advanceRound();

    // p2がレイズ
    round.executeAction('p2', 'raise', 50);

    // p3がフォールド
    round.executeAction('p3', 'fold');
    expect(round.getCurrentBettorId()).toBe('p1');
    expect(round.isBettingComplete()).toBe(false);

    // p1がコール
    round.executeAction('p1', 'call');
    expect(round.isBettingComplete()).toBe(true);
  });

  test('2人プレイ: プリフロップでSBがレイズ→BBがコールで進む', () => {
    const twoPlayers: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
    ];

    const round = new Round(twoPlayers, 0, 10, 20);
    round.start();

    // 2人プレイ: p1=Dealer/BB, p2=SB
    // プリフロップ: p2が最初
    expect(round.getCurrentBettorId()).toBe('p2');

    round.executeAction('p2', 'raise', 40);
    expect(round.getCurrentBettorId()).toBe('p1');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p1', 'call');
    expect(round.isBettingComplete()).toBe(true);

    // フロップへ
    round.advanceRound();
    expect(round.getState()).toBe('flop');
  });

  test('ベッティング完了後もターンが正しく管理される', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // プリフロップ完了
    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');
    expect(round.isBettingComplete()).toBe(true);

    // この時点でcurrentBettorIdは次のプレイヤーを指しているはず
    // advanceRound()を呼ぶ前に、現在のベッターを確認
    const bettorBeforeAdvance = round.getCurrentBettorId();

    round.advanceRound();

    // フロップでは最初はSB（p2）から
    expect(round.getCurrentBettorId()).toBe('p2');
  });

  test('全員チェック後にベッティング完了となる', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');
    round.advanceRound();

    // フロップで全員チェック
    expect(round.isBettingComplete()).toBe(false);
    round.executeAction('p2', 'check');
    expect(round.isBettingComplete()).toBe(false);
    round.executeAction('p3', 'check');
    expect(round.isBettingComplete()).toBe(false);
    round.executeAction('p1', 'check');
    expect(round.isBettingComplete()).toBe(true);
  });

  test('レイズ後、全員がレイズ前の最後のプレイヤーまでアクションする', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');
    round.advanceRound();

    // フロップ: p2チェック→p3チェック→p1がレイズ
    round.executeAction('p2', 'check');
    round.executeAction('p3', 'check');
    round.executeAction('p1', 'raise', 50);

    expect(round.isBettingComplete()).toBe(false);

    // p2がコール
    round.executeAction('p2', 'call');
    expect(round.isBettingComplete()).toBe(false);

    // p3がコールで完了
    round.executeAction('p3', 'call');
    expect(round.isBettingComplete()).toBe(true);
  });
});

describe('Round - 有効なアクション判定（getValidActions）', () => {
  let players: Player[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2, connected: true, lastSeen: Date.now() },
    ];
  });

  test('プリフロップ最初のプレイヤー（UTG）はfold, call, raise, allinが可能', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    const validActions = round.getValidActions('p1');
    expect(validActions).toContain('fold');
    expect(validActions).toContain('call');
    expect(validActions).toContain('raise');
    expect(validActions).toContain('allin');
    expect(validActions).not.toContain('check'); // BBより少ないのでチェック不可
  });

  test('プリフロップBBはfold, check, raise, allinが可能（全員コール後）', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');

    const validActions = round.getValidActions('p3');
    expect(validActions).toContain('fold');
    expect(validActions).toContain('check'); // 既にBB払っているのでチェック可能
    expect(validActions).toContain('raise');
    expect(validActions).toContain('allin');
    expect(validActions).not.toContain('call'); // 既にベット額が揃っているのでコール不要
  });

  test('フロップ最初のプレイヤーはfold, check, raise, allinが可能', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');
    round.advanceRound();

    const validActions = round.getValidActions('p2');
    expect(validActions).toContain('fold');
    expect(validActions).toContain('check'); // ベットがないのでチェック可能
    expect(validActions).toContain('raise');
    expect(validActions).toContain('allin');
    expect(validActions).not.toContain('call'); // ベットがないのでコール不要
  });

  test('レイズ後のプレイヤーはfold, call, raise, allinが可能', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');
    round.advanceRound();

    round.executeAction('p2', 'raise', 50);

    const validActions = round.getValidActions('p3');
    expect(validActions).toContain('fold');
    expect(validActions).toContain('call');
    expect(validActions).toContain('raise');
    expect(validActions).toContain('allin');
    expect(validActions).not.toContain('check'); // レイズされているのでチェック不可
  });

  test('チップ不足でレイズ不可', () => {
    const lowChipPlayers: Player[] = [
      { id: 'p1', name: 'Alice', chips: 30, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2, connected: true, lastSeen: Date.now() },
    ];

    const round = new Round(lowChipPlayers, 0, 10, 20);
    round.start();

    const validActions = round.getValidActions('p1');
    expect(validActions).toContain('fold');
    expect(validActions).toContain('call');
    expect(validActions).toContain('allin');
    expect(validActions).not.toContain('raise'); // チップ不足でレイズ不可
  });

  test('ターンでないプレイヤーは何もできない', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    const validActions = round.getValidActions('p2'); // p1のターン
    expect(validActions).toEqual([]);
  });

  test('フォールド済みプレイヤーは何もできない', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'fold');

    const validActions = round.getValidActions('p1');
    expect(validActions).toEqual([]);
  });

  test('オールイン済みプレイヤーは何もできない', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    round.executeAction('p1', 'allin');
    // p1のチップは0になる

    const validActions = round.getValidActions('p1');
    expect(validActions).toEqual([]);
  });
});
