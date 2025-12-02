/**
 * PotCalculator クラスのユニットテスト
 */

import { PotCalculator } from '../../src/game/PotCalculator';
import { SidePot } from '../../src/types/game';

describe('PotCalculator', () => {
  describe('メインポット計算', () => {
    test('全員が同額ベットした場合、1つのポット', () => {
      const bets = new Map([
        ['player1', 100],
        ['player2', 100],
        ['player3', 100],
      ]);
      const folded = new Set<string>();

      const pots = PotCalculator.calculate(bets, folded);

      expect(pots).toHaveLength(1);
      expect(pots[0].amount).toBe(300);
      expect(pots[0].eligiblePlayers).toHaveLength(3);
    });

    test('フォールドしたプレイヤーもポットに含まれる', () => {
      const bets = new Map([
        ['player1', 100],
        ['player2', 50],
        ['player3', 100],
      ]);
      const folded = new Set(['player2']);

      const pots = PotCalculator.calculate(bets, folded);

      expect(pots[0].amount).toBeGreaterThan(0);
      // player2はfoldedだが、ベット額はポットに含まれる
    });
  });

  describe('サイドポット計算', () => {
    test('1人がオールインした場合、2つのポット', () => {
      const bets = new Map([
        ['player1', 50], // オールイン
        ['player2', 100],
        ['player3', 100],
      ]);
      const folded = new Set<string>();

      const pots = PotCalculator.calculate(bets, folded);

      expect(pots).toHaveLength(2);

      // メインポット: 50 x 3 = 150
      expect(pots[0].amount).toBe(150);
      expect(pots[0].eligiblePlayers).toHaveLength(3);
      expect(pots[0].eligiblePlayers).toContain('player1');

      // サイドポット: 50 x 2 = 100
      expect(pots[1].amount).toBe(100);
      expect(pots[1].eligiblePlayers).toHaveLength(2);
      expect(pots[1].eligiblePlayers).not.toContain('player1');
    });

    test('複数人がオールインした場合、複数のサイドポット', () => {
      const bets = new Map([
        ['player1', 30], // オールイン
        ['player2', 70], // オールイン
        ['player3', 100],
        ['player4', 100],
      ]);
      const folded = new Set<string>();

      const pots = PotCalculator.calculate(bets, folded);

      expect(pots).toHaveLength(3);

      // メインポット: 30 x 4 = 120
      expect(pots[0].amount).toBe(120);
      expect(pots[0].eligiblePlayers).toHaveLength(4);

      // サイドポット1: 40 x 3 = 120
      expect(pots[1].amount).toBe(120);
      expect(pots[1].eligiblePlayers).toHaveLength(3);

      // サイドポット2: 30 x 2 = 60
      expect(pots[2].amount).toBe(60);
      expect(pots[2].eligiblePlayers).toHaveLength(2);
    });

    test('フォールドしたプレイヤーはサイドポットに参加できない', () => {
      const bets = new Map([
        ['player1', 50],
        ['player2', 100],
        ['player3', 100],
      ]);
      const folded = new Set(['player1']);

      const pots = PotCalculator.calculate(bets, folded);

      // player1はフォールドしているので、どのポットにも参加できない
      pots.forEach((pot) => {
        expect(pot.eligiblePlayers).not.toContain('player1');
      });
    });
  });

  describe('ポット配分', () => {
    test('1人の勝者がメインポットを獲得', () => {
      const pots: SidePot[] = [
        { amount: 300, eligiblePlayers: ['player1', 'player2', 'player3'] },
      ];
      const winners = new Map([[0, ['player1']]]);

      const payouts = PotCalculator.distribute(pots, winners);

      expect(payouts.get('player1')).toBe(300);
      expect(payouts.get('player2')).toBeUndefined();
      expect(payouts.get('player3')).toBeUndefined();
    });

    test('複数の勝者でポットを分割', () => {
      const pots: SidePot[] = [
        { amount: 300, eligiblePlayers: ['player1', 'player2', 'player3'] },
      ];
      const winners = new Map([[0, ['player1', 'player2']]]);

      const payouts = PotCalculator.distribute(pots, winners);

      expect(payouts.get('player1')).toBe(150);
      expect(payouts.get('player2')).toBe(150);
      expect(payouts.get('player3')).toBeUndefined();
    });

    test('複数のポットで異なる勝者', () => {
      const pots: SidePot[] = [
        { amount: 120, eligiblePlayers: ['player1', 'player2', 'player3'] },
        { amount: 100, eligiblePlayers: ['player2', 'player3'] },
      ];
      const winners = new Map([
        [0, ['player1']],
        [1, ['player2']],
      ]);

      const payouts = PotCalculator.distribute(pots, winners);

      expect(payouts.get('player1')).toBe(120);
      expect(payouts.get('player2')).toBe(100);
      expect(payouts.get('player3')).toBeUndefined();
    });

    test('割り切れない場合、余りは最初の勝者に', () => {
      const pots: SidePot[] = [
        { amount: 301, eligiblePlayers: ['player1', 'player2', 'player3'] },
      ];
      const winners = new Map([[0, ['player1', 'player2']]]);

      const payouts = PotCalculator.distribute(pots, winners);

      // 301 / 2 = 150.5 → player1: 151, player2: 150
      expect(payouts.get('player1')).toBe(151);
      expect(payouts.get('player2')).toBe(150);
    });
  });

  describe('エッジケース', () => {
    test('ベットがない場合、空の配列', () => {
      const bets = new Map<string, number>();
      const folded = new Set<string>();

      const pots = PotCalculator.calculate(bets, folded);

      expect(pots).toHaveLength(0);
    });

    test('全員フォールドした場合でもポットを計算', () => {
      const bets = new Map([
        ['player1', 50],
        ['player2', 50],
      ]);
      const folded = new Set(['player1', 'player2']);

      const pots = PotCalculator.calculate(bets, folded);

      expect(pots).toHaveLength(1);
      expect(pots[0].amount).toBe(100);
      expect(pots[0].eligiblePlayers).toHaveLength(0);
    });

    test('0ベットのプレイヤーは無視される', () => {
      const bets = new Map([
        ['player1', 100],
        ['player2', 0],
        ['player3', 100],
      ]);
      const folded = new Set<string>();

      const pots = PotCalculator.calculate(bets, folded);

      expect(pots[0].eligiblePlayers).not.toContain('player2');
    });
  });

  describe('実際のゲームシナリオ', () => {
    test('典型的なオールインシナリオ', () => {
      // Player1: 20チップ残り（オールイン）
      // Player2: 100ベット
      // Player3: フォールド（50ベット済み）
      // Player4: 100ベット
      const bets = new Map([
        ['player1', 20],
        ['player2', 100],
        ['player3', 50],
        ['player4', 100],
      ]);
      const folded = new Set(['player3']);

      const pots = PotCalculator.calculate(bets, folded);

      // Pot0: 20 x 4 = 80 (player1, player2, player3, player4)
      // Pot1: 30 x 3 = 90 (player2, player3, player4)
      // Pot2: 50 x 2 = 100 (player2, player4)
      expect(pots).toHaveLength(3);

      // メインポット: player1も参加可能
      expect(pots[0].amount).toBe(80);
      expect(pots[0].eligiblePlayers).toContain('player1');
      expect(pots[0].eligiblePlayers).toContain('player2');
      expect(pots[0].eligiblePlayers).toContain('player4');

      // サイドポット1: player3はフォールドなので除外
      expect(pots[1].eligiblePlayers).toContain('player2');
      expect(pots[1].eligiblePlayers).toContain('player4');
      expect(pots[1].eligiblePlayers).not.toContain('player1');
      expect(pots[1].eligiblePlayers).not.toContain('player3');

      // サイドポット2: player2とplayer4のみ
      expect(pots[2].eligiblePlayers).toContain('player2');
      expect(pots[2].eligiblePlayers).toContain('player4');
      expect(pots[2].eligiblePlayers).not.toContain('player1');
    });
  });
});
