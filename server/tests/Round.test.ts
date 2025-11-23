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

    // 2人プレイ: p1=Dealer/SB(seat0), p2=BB(seat1)
    // プリフロップ: p1(SB)が最初
    round.executeAction('p1', 'call');
    round.executeAction('p2', 'check');

    // フロップ以降: p2(BB)が最初 (SBはDealerなので最後)
    // Wait, in 2-player:
    // Preflop: SB (Dealer) acts first.
    // Postflop: BB acts first (Dealer acts last).
    
    round.advanceRound();
    // Flop: p2 (BB) acts first
    round.executeAction('p2', 'check');
    round.executeAction('p1', 'check');

    round.advanceRound();
    // Turn
    round.executeAction('p2', 'check');
    round.executeAction('p1', 'check');

    round.advanceRound();
    // River
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

    // 2人プレイ: p1=SB, p2=BB
    // p1(SB)がフォールド
    round.executeAction('p1', 'fold');

    // p2(BB)が勝利
    const winnings = round.performShowdown();

    expect(winnings.size).toBe(1);
    expect(winnings.get('p2')).toBe(30); // SB(10) + BB(20)

    // p2はBBで20払い、ポット30獲得なので、最終的に+10 (1000 -> 1010)
    // Note: players[1] is a reference to the object in the round, so it's updated
    expect(players[1].chips).toBe(1010);
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
  
  // ... (3-player tests remain unchanged) ...

  test('2人プレイ: プリフロップでSBがレイズ→BBがコールで進む', () => {
    const twoPlayers: Player[] = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
    ];

    const round = new Round(twoPlayers, 0, 10, 20);
    round.start();

    // 2人プレイ: p1=Dealer/SB, p2=BB
    // プリフロップ: p1が最初
    expect(round.getCurrentBettorId()).toBe('p1');

    round.executeAction('p1', 'raise', 40);
    expect(round.getCurrentBettorId()).toBe('p2');
    expect(round.isBettingComplete()).toBe(false);

    round.executeAction('p2', 'call');
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

describe('Round - アクションの組み合わせ網羅テスト', () => {
  let players: Player[];

  beforeEach(() => {
    players = [
      { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
      { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
      { id: 'p3', name: 'Charlie', chips: 1000, seat: 2, connected: true, lastSeen: Date.now() },
    ];
  });

  test('3人プレイ: P1フォールド -> P2コール -> P3チェック (P1除外で進行)', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // プリフロップ: P1(UTG) -> P2(SB) -> P3(BB)
    round.executeAction('p1', 'fold');
    expect(round.getActivePlayersCount()).toBe(2);
    expect(round.getCurrentBettorId()).toBe('p2');

    round.executeAction('p2', 'call');
    expect(round.getCurrentBettorId()).toBe('p3');

    round.executeAction('p3', 'check');
    expect(round.isBettingComplete()).toBe(true);
    
    // フロップへ
    round.advanceRound();
    expect(round.getState()).toBe('flop');
    // フロップはSBから (P2)
    expect(round.getCurrentBettorId()).toBe('p2');
  });

  test('3人プレイ: 全員チェックでショーダウンまで進行', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // Preflop
    round.executeAction('p1', 'call');
    round.executeAction('p2', 'call');
    round.executeAction('p3', 'check');
    round.advanceRound();

    // Flop
    round.executeAction('p2', 'check');
    round.executeAction('p3', 'check');
    round.executeAction('p1', 'check');
    round.advanceRound();

    // Turn
    round.executeAction('p2', 'check');
    round.executeAction('p3', 'check');
    round.executeAction('p1', 'check');
    round.advanceRound();

    // River
    round.executeAction('p2', 'check');
    round.executeAction('p3', 'check');
    round.executeAction('p1', 'check');
    expect(round.isBettingComplete()).toBe(true);
    
    round.advanceRound();
    expect(round.getState()).toBe('showdown');
  });

  test('レイズ合戦: P1レイズ -> P2リレイズ -> P3フォールド -> P1コール', () => {
    const round = new Round(players, 0, 10, 20);
    round.start();

    // P1 Raise 50
    round.executeAction('p1', 'raise', 50);
    
    // P2 Re-raise 100
    round.executeAction('p2', 'raise', 100);

    // P3 Fold
    round.executeAction('p3', 'fold');
    expect(round.getActivePlayersCount()).toBe(2);

    // P1 Call (needs to add 50 more)
    expect(round.getCurrentBettorId()).toBe('p1');
    round.executeAction('p1', 'call');

    expect(round.isBettingComplete()).toBe(true);
    round.advanceRound();
    expect(round.getState()).toBe('flop');
  });
});
