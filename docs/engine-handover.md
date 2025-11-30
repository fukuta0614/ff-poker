# 純粋関数型ゲームエンジン 引き継ぎ資料

**作成日**: 2025-11-29
**プロジェクト**: FF Poker
**対象**: `server/src/engine/` ディレクトリ

---

## 📋 目次

1. [概要](#概要)
2. [実装完了状況](#実装完了状況)
3. [アーキテクチャ設計](#アーキテクチャ設計)
4. [ファイル構成](#ファイル構成)
5. [主要な設計判断](#主要な設計判断)
6. [使用方法](#使用方法)
7. [テスト戦略](#テスト戦略)
8. [今後の実装予定](#今後の実装予定)
9. [注意事項](#注意事項)
10. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### プロジェクトの目的

既存のクラスベース・ミューテーション型ゲームエンジン (`server/src/game/`) を、純粋関数型アプローチでリファクタリングする。

### 達成した目標

- ✅ 完全な不変性（readonly, 副作用なし）
- ✅ fp-tsによる型安全なエラーハンドリング（Either）
- ✅ null安全性（Option）
- ✅ TDD駆動開発（テストファースト）
- ✅ **130テスト全パス、96.09%カバレッジ達成**

### 設計思想

```
currentState -> userAction -> newState
```

- 全ての関数が純粋関数
- 状態は常に新しいオブジェクトとして返される
- 元の状態は決して変更されない

---

## 実装完了状況

### ✅ 完了した機能

| モジュール | ファイル | テスト数 | カバレッジ | 状態 |
|----------|---------|---------|-----------|------|
| 型定義 | `types.ts` | - | - | ✅ 完了 |
| デッキ管理 | `deck.ts` | 21 | 100% | ✅ 完了 |
| ユーティリティ | `utils.ts` | 31 | 100% | ✅ 完了 |
| アクション処理 | `actions.ts` | 36 | 93.69% | ✅ 完了 |
| ポット計算 | `pot.ts` | 9 | 97.5% | ✅ 完了 |
| ゲーム初期化 | `game-init.ts` | 15 | 95.94% | ✅ 完了 |
| ステージ遷移 | `stage.ts` | 18 | 92.59% | ✅ 完了 |
| エクスポート | `index.ts` | - | - | ✅ 完了 |

**合計: 130テスト, 96.09%カバレッジ**

### 🚧 未実装の機能

以下の機能は、既存の `server/src/game/` に実装済みで、純粋関数型版への移行が必要：

1. **ハンド評価** - `HandEvaluator.ts`
   - pokersolver ライブラリとの統合
   - 純粋関数型ラッパーが必要

2. **ショーダウン処理** - 勝者決定とチップ分配
   - `performShowdown`
   - `determineWinners`
   - `distributeWinnings`

3. **GameManager統合** - 既存システムとの接続
   - 現在のRoundクラスから関数型エンジンへの移行
   - アダプターパターンの実装

4. **統合テスト** - 完全なゲームフローのエンドツーエンドテスト

---

## アーキテクチャ設計

### 階層構造

```
┌─────────────────────────────────────────┐
│         アプリケーション層               │
│    (Socket.io handlers, GameManager)    │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│      純粋関数型ゲームエンジン            │
│         (server/src/engine/)            │
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │ types.ts │  │ index.ts │           │
│  └──────────┘  └──────────┘           │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Core Functions                  │  │
│  ├──────────────────────────────────┤  │
│  │ • deck.ts    (カード管理)        │  │
│  │ • utils.ts   (ヘルパー)          │  │
│  │ • actions.ts (アクション処理)    │  │
│  │ • pot.ts     (ポット計算)        │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Game Flow Functions             │  │
│  ├──────────────────────────────────┤  │
│  │ • game-init.ts (初期化)          │  │
│  │ • stage.ts     (ステージ遷移)    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│           外部ライブラリ                 │
│        (fp-ts, pokersolver)             │
└─────────────────────────────────────────┘
```

### データフロー

```typescript
// 1. ゲーム初期化
const players = [p1, p2, p3];
initializeRound(players, 0, 10, 20)
  → Either<GameError, GameState>

// 2. アクション処理
processAction({ playerId: 'p1', type: 'raise', amount: 50 }, state)
  → Either<GameError, GameState>

// 3. ステージ進行
isBettingComplete(state) ? advanceStage(state) : state
  → Either<GameError, GameState>

// 4. ポット計算
calculatePots(state)
  → readonly Pot[]
```

---

## ファイル構成

### `types.ts` - 型定義

**目的**: 全ての型定義を一元管理

**主要な型**:
```typescript
// 基本型
PlayerId, Card, ActionType, Stage

// ゲーム状態
GameState, Player, PlayerState

// エラー型（ユニオン型で型安全）
GameError =
  | { type: 'InvalidTurn'; ... }
  | { type: 'PlayerNotFound'; ... }
  | ...

// 結果型
ActionResult, ShowdownResult, WinnerInfo
```

**重要ポイント**:
- 全てのプロパティは `readonly`
- `Option<T>` を使ってnull安全性を保証
- エラー型は discriminated union で型ガードが効く

### `deck.ts` - デッキ管理

**テスト**: 21テスト, 100%カバレッジ

**関数**:
```typescript
createDeck(): readonly Card[]
  // 52枚のデッキを生成

shuffleDeck(deck: readonly Card[]): readonly Card[]
  // Fisher-Yatesアルゴリズムでシャッフル

dealCards(deck: readonly Card[], count: number): { dealtCards, remainingDeck }
  // カードをディール（エラー時throw）

isValidCard(card: string): card is Card
  // カード形式のバリデーション
```

**特徴**:
- 元のdeckは変更されない（常に新しい配列を返す）
- Typeガードで型安全性を保証

### `utils.ts` - ユーティリティ関数

**テスト**: 31テスト, 100%カバレッジ

**主要関数**:
```typescript
getPlayer(playerId, state): Option<Player>
  // プレイヤーを取得（存在しない場合はNone）

getActivePlayers(state): readonly Player[]
  // フォールドしていないプレイヤーのリスト

calculateCallAmount(playerId, state): number
  // コール額を計算

getValidActions(playerId, state): readonly ActionType[]
  // プレイヤーが実行可能なアクションリスト

isBettingComplete(state): boolean
  // ベットラウンドが完了したかチェック
```

**重要ポイント**:
- `Option` を使って存在しないプレイヤーを型安全に扱う
- all-in プレイヤーを考慮したベット完了判定
- 最小レイズ額の計算ロジック

### `actions.ts` - アクション処理

**テスト**: 36テスト, 93.69%カバレッジ

**主要関数**:
```typescript
processAction(action: PlayerAction, state: GameState): Either<GameError, GameState>
  // メイン関数: アクションを検証して実行

executeFold(playerId, state): Either<GameError, GameState>
executeCheck(playerId, state): Either<GameError, GameState>
executeCall(playerId, state): Either<GameError, GameState>
executeRaise(playerId, amount, state): Either<GameError, GameState>
executeAllIn(playerId, state): Either<GameError, GameState>
  // 各アクションの個別実装

validateAction(action, state): Either<GameError, void>
  // アクションのバリデーション（ターン確認、有効性チェック）
```

**処理フロー**:
```typescript
processAction(action, state)
  1. validateAction() でバリデーション
  2. エラーならLeft返却
  3. 成功なら対応するexecute関数を呼び出し
  4. 新しいGameStateを返す
```

**注意点**:
- レイズの最小額チェック（all-in時は例外）
- プレイヤーのチップ残高チェック
- ターン順序の厳密なチェック

### `pot.ts` - ポット計算

**テスト**: 9テスト, 97.5%カバレッジ

**関数**:
```typescript
calculatePots(state: GameState): readonly Pot[]
  // メイン + サイドポットを計算
```

**アルゴリズム**:
```
1. 全プレイヤーのcumulativeBet（累積ベット額）を取得
2. ベット額でソート（昇順）
3. 各レベルでポットを作成
   - 最小ベット額から順に処理
   - フォールドしたプレイヤーは除外
   - 同じeligible playersを持つポットは統合
4. ポット配列を返す
```

**重要ポイント**:
- `bet`（現在のストリート）ではなく `cumulativeBet`（累積）を使用
- 複数all-inシナリオに対応
- ポット統合で無駄なポットを削減

### `game-init.ts` - ゲーム初期化

**テスト**: 15テスト, 95.94%カバレッジ

**主要関数**:
```typescript
initializeRound(players, dealerIndex, smallBlind, bigBlind): Either<GameError, GameState>
  // 新しいラウンドを初期化

collectBlinds(players, dealerIndex, smallBlind, bigBlind): Either<GameError, {...}>
  // ブラインドを徴収

dealHoleCards(players, deck): Either<GameError, {...}>
  // ホールカードを配る

resetForNewStreet(playerStates): ReadonlyMap<PlayerId, PlayerState>
  // 新しいストリート用にベットをリセット

advanceBettor(currentIndex, numPlayers): number
  // 次のベッターに進む
```

**ヘッズアップ対応**:
```typescript
if (numPlayers === 2) {
  // ディーラー = SB, 相手 = BB
  sbIndex = dealerIndex;
  bbIndex = (dealerIndex + 1) % 2;
} else {
  // 通常のブラインド
  sbIndex = (dealerIndex + 1) % numPlayers;
  bbIndex = (dealerIndex + 2) % numPlayers;
}
```

**all-in on blinds 対応**:
```typescript
const sbAmount = Math.min(smallBlind, sbPlayer.chips);
const bbAmount = Math.min(bigBlind, bbPlayer.chips);
```

### `stage.ts` - ステージ遷移

**テスト**: 18テスト, 92.59%カバレッジ

**主要関数**:
```typescript
advanceStage(state): Either<GameError, GameState>
  // 現在のステージに応じて次へ進む

dealFlop(state): Either<GameError, GameState>
  // バーン1枚 + フロップ3枚

dealTurn(state): Either<GameError, GameState>
  // バーン1枚 + ターン1枚

dealRiver(state): Either<GameError, GameState>
  // バーン1枚 + リバー1枚
```

**処理内容**:
```typescript
dealFlop(state)
  1. ステージ確認（preflop のみ）
  2. カード枚数確認（4枚必要）
  3. バーンカード1枚をスキップ
  4. フロップ3枚をディール
  5. ベットをリセット（resetForNewStreet）
  6. 最初のベッターをSB位置に設定
  7. 新しいGameStateを返す
```

---

## 主要な設計判断

### 1. なぜ fp-ts を使うのか？

**理由**:
- `Either<L, R>` で型安全なエラーハンドリング
- `Option<T>` でnull安全性
- `pipe` / `flow` で関数合成
- TypeScriptの型システムと相性が良い

**具体例**:
```typescript
// Either使用前（例外ベース）
try {
  const newState = processAction(action, state);
  // 成功処理
} catch (error) {
  // エラー処理（型が不明）
}

// Either使用後（型安全）
const result = processAction(action, state);
if (E.isRight(result)) {
  const newState = result.right; // GameState型
} else {
  const error = result.left; // GameError型（詳細な型情報）
}
```

### 2. なぜ readonly を徹底するのか？

**理由**:
- 意図しない状態変更を防ぐ
- 並行処理に安全
- タイムトラベルデバッグが可能

**コスト**:
- Map/Setのコピーコスト
- → 現状のスケールでは問題なし
- → 将来的にStructural Sharingを検討

### 3. なぜ `bet` と `cumulativeBet` の両方が必要か？

**理由**:
```typescript
// プリフロップ
player1: bet=50, cumulativeBet=50

// フロップ（ベットリセット後）
player1: bet=0, cumulativeBet=50

// フロップでさらに100ベット
player1: bet=100, cumulativeBet=150

// ショーダウン時のポット計算はcumulativeBetを使用
```

- `bet`: 現在のストリートのベット（ステージ毎にリセット）
- `cumulativeBet`: 累積ベット（サイドポット計算に必要）

### 4. なぜ validateAction と executeAction を分離するのか？

**理由**:
- 関心の分離（Separation of Concerns）
- テストしやすさ
- エラーメッセージの明確化

**フロー**:
```typescript
validateAction()  // バリデーションのみ（副作用なし）
  ↓
executeAction()  // 実際の状態変更
```

---

## 使用方法

### 基本的な統合例

```typescript
import * as E from 'fp-ts/Either';
import {
  initializeRound,
  processAction,
  advanceStage,
  isBettingComplete,
  calculatePots,
  type Player,
  type GameState,
} from './engine';

// 1. プレイヤー準備
const players: Player[] = [
  { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
  { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
];

// 2. ラウンド初期化
const initResult = initializeRound(players, 0, 10, 20);

if (E.isLeft(initResult)) {
  console.error('初期化エラー:', initResult.left);
  return;
}

let state: GameState = initResult.right;

// 3. アクション処理
const actionResult = processAction(
  { playerId: 'p1', type: 'raise', amount: 50 },
  state
);

if (E.isRight(actionResult)) {
  state = actionResult.right;
}

// 4. ベット完了チェック & ステージ進行
if (isBettingComplete(state)) {
  const stageResult = advanceStage(state);

  if (E.isRight(stageResult)) {
    state = stageResult.right;
    console.log('新しいステージ:', state.stage);
  }
}

// 5. ポット計算
const pots = calculatePots(state);
console.log('ポット:', pots);
```

### 既存システムとの統合（アダプターパターン）

```typescript
// 既存のRoundクラス内
class Round {
  private functionalState: GameState;

  executeAction(playerId: string, action: string, amount?: number): void {
    // 関数型エンジンを使用
    const functionalAction: PlayerAction = {
      playerId,
      type: action as ActionType,
      amount,
    };

    const result = processAction(functionalAction, this.functionalState);

    pipe(
      result,
      E.fold(
        (error) => {
          throw new Error(`Action failed: ${error.type}`);
        },
        (newState) => {
          this.functionalState = newState;
          this.syncToClassState(newState);
        }
      )
    );
  }

  private syncToClassState(state: GameState): void {
    // GameStateをクラスのプロパティに同期
    this.pot = state.totalPot;
    this.currentBet = state.currentBet;
    // ...
  }
}
```

---

## テスト戦略

### テストの構造

```
tests/engine/
├── deck.test.ts        (21テスト)
├── utils.test.ts       (31テスト)
├── actions.test.ts     (36テスト)
├── pot.test.ts         (9テスト)
├── game-init.test.ts   (15テスト)
└── stage.test.ts       (18テスト)
```

### テストのカテゴリ

1. **Happy Path テスト** - 正常系の動作確認
2. **Error Path テスト** - エラーケースの確認
3. **Edge Case テスト** - 境界値、all-in、ヘッズアップなど
4. **Immutability テスト** - 元の状態が変更されないことを確認

### テスト例

```typescript
describe('executeFold', () => {
  it('should mark player as folded', () => {
    const state = createTestGameState();
    const result = executeFold('p1', state);

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      expect(result.right.playerStates.get('p1')?.isFolded).toBe(true);
    }
  });

  it('should not mutate original state', () => {
    const state = createTestGameState();
    const originalPlayerState = state.playerStates.get('p1');

    executeFold('p1', state);

    expect(state.playerStates.get('p1')).toBe(originalPlayerState);
  });

  it('should return Left when player not found', () => {
    const state = createTestGameState();
    const result = executeFold('nonexistent', state);

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.type).toBe('PlayerNotFound');
    }
  });
});
```

### カバレッジ目標

- ✅ 全体: 96.09%（目標: 95%以上）
- ✅ deck.ts: 100%
- ✅ utils.ts: 100%
- 🟡 actions.ts: 93.69%（未カバー: エラーハンドリングの一部）
- 🟡 stage.ts: 92.59%（未カバー: catch句の一部）

---

## 今後の実装予定

### 優先度: 高

1. **ハンド評価関数** (1-2日)
   ```typescript
   // 既存のHandEvaluatorをラップ
   evaluateHand(
     holeCards: [Card, Card],
     communityCards: readonly Card[]
   ): HandEvaluation

   compareHands(
     hand1: HandEvaluation,
     hand2: HandEvaluation
   ): number  // -1, 0, 1
   ```

2. **ショーダウン関数** (2-3日)
   ```typescript
   performShowdown(state: GameState): Either<GameError, ShowdownResult>
   determineWinners(state: GameState, pots: readonly Pot[]): WinnerInfo[]
   distributeWinnings(state: GameState, winners: WinnerInfo[]): GameState
   ```

3. **統合テスト** (1-2日)
   - 完全なゲームフローのエンドツーエンドテスト
   - プリフロップ → ショーダウンまで

### 優先度: 中

4. **GameManager統合** (3-5日)
   - 既存のGameManagerを関数型エンジンで動作させる
   - アダプターパターンの実装
   - 段階的な移行戦略

5. **パフォーマンス最適化** (必要に応じて)
   - Structural Sharing（immer導入検討）
   - 不要なコピーの削減

### 優先度: 低

6. **追加機能**
   - Straddle対応
   - アンティ対応
   - トーナメントモード

---

## 注意事項

### 🚨 重要な制約

1. **`any` 型は絶対に使用しない**
   - 現在の実装には `any` が0個
   - 型安全性を維持すること

2. **readonly を徹底する**
   - 全てのプロパティは `readonly`
   - 配列は `readonly T[]`
   - Map/Setは `ReadonlyMap` / `ReadonlySet`

3. **副作用を避ける**
   - console.log以外の副作用を関数内に書かない
   - ランダム性はcaller側で注入（shuffleDeck等）

4. **エラーハンドリングは Either で**
   - throw を使わない
   - 全てのエラーケースを `GameError` ユニオン型で表現

### 🔍 デバッグのコツ

1. **Either の中身を確認**
   ```typescript
   if (E.isLeft(result)) {
     console.log('Error type:', result.left.type);
     console.log('Full error:', result.left);
   }
   ```

2. **状態のスナップショット**
   ```typescript
   // 状態は不変なので、いつでもスナップショット可能
   const snapshot = state;
   // アクション実行
   const newState = processAction(action, state);
   // 前後比較
   console.log('Before:', snapshot);
   console.log('After:', newState);
   ```

3. **pipe デバッグ**
   ```typescript
   import { pipe } from 'fp-ts/function';

   pipe(
     state,
     (s) => { console.log('Step 1:', s); return s; },
     processAction(action1),
     (r) => { console.log('After action1:', r); return r; },
     E.chain(processAction(action2))
   );
   ```

---

## トラブルシューティング

### よくあるエラー

#### 1. `Property 'xxx' does not exist on type 'GameError'`

**原因**: 型ガードなしでユニオン型のプロパティにアクセス

**解決**:
```typescript
// ❌ ダメな例
if (E.isLeft(result)) {
  console.log(result.left.reason); // エラー
}

// ✅ 良い例
if (E.isLeft(result)) {
  if (result.left.type === 'InvalidAction') {
    console.log(result.left.reason); // OK
  }
}
```

#### 2. `Cannot assign to 'xxx' because it is a read-only property`

**原因**: readonly プロパティへの代入

**解決**:
```typescript
// ❌ ダメな例
state.currentBet = 100;

// ✅ 良い例
const newState = {
  ...state,
  currentBet: 100,
};
```

#### 3. ベットラウンドが終わらない

**原因**: `isBettingComplete` がfalseを返し続ける

**チェックポイント**:
- 全プレイヤーの `hasActed` がtrueか？
- 全プレイヤーの `bet` が等しいか？（all-in除く）
- フォールドしたプレイヤーが正しく除外されているか？

**デバッグ**:
```typescript
const activePlayers = getActivePlayers(state);
console.log('Active players:', activePlayers.length);
activePlayers.forEach(p => {
  const ps = state.playerStates.get(p.id);
  console.log(`${p.id}: bet=${ps?.bet}, hasActed=${ps?.hasActed}, chips=${p.chips}`);
});
```

#### 4. サイドポットが正しく計算されない

**原因**: `cumulativeBet` ではなく `bet` を使っている

**チェック**:
```typescript
// ポット計算は必ず cumulativeBet を使用
const pots = calculatePots(state);

// デバッグ出力
state.playerStates.forEach((ps, id) => {
  console.log(`${id}: bet=${ps.bet}, cumulative=${ps.cumulativeBet}`);
});
```

---

## 参考資料

### ドキュメント

- [engine/README.md](../server/src/engine/README.md) - API リファレンス
- [design/functional-game-engine.md](./design/functional-game-engine.md) - 設計書

### コード例

- `tests/engine/*.test.ts` - 豊富なテストケース
- `server/src/engine/index.ts` - エクスポート一覧

### 外部ライブラリ

- [fp-ts](https://gcanti.github.io/fp-ts/) - 公式ドキュメント
- [pokersolver](https://github.com/goldfire/pokersolver) - ハンド評価ライブラリ

---

## まとめ

### 達成したこと

✅ **130テスト全パス、96.09%カバレッジ**
✅ 完全な不変性とtype-safetyを実現
✅ TDD駆動で堅牢な実装
✅ 既存システムとの共存可能な設計

### 次のステップ

1. ハンド評価関数の実装
2. ショーダウン処理の実装
3. 統合テストの作成
4. 既存GameManagerとの統合

### 連絡先

質問や不明点があれば：
- GitHub Issues
- プロジェクトSlack
- コードレビュー時に直接質問

---

**Good Luck! 🚀**
