# 純粋関数型ポーカーゲームエンジン

テキサスホールデムポーカーの完全な純粋関数型実装。fp-tsを活用し、不変性とtype-safetyを保証します。

## 特徴

- ✅ **完全な不変性**: 全ての状態は `readonly`、副作用なし
- ✅ **Either によるエラーハンドリング**: 型安全なエラー処理
- ✅ **Option によるnull安全性**: undefined/nullを型で表現
- ✅ **100%型安全**: `any`型は一切使用していません
- ✅ **TDD駆動**: 179テスト、96%カバレッジ達成
- ✅ **純粋関数**: 全ての関数が `currentState -> action -> newState`
- ✅ **完全なゲームフロー**: プリフロップからショーダウンまで実装済み

## インストール

```bash
npm install fp-ts
```

## 基本的な使い方

### 1. ラウンドの初期化

```typescript
import * as E from 'fp-ts/Either';
import { initializeRound } from './engine';
import type { Player } from './engine';

const players: Player[] = [
  { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
  { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
  { id: 'p3', name: 'Charlie', chips: 1000, seat: 2 },
];

const result = initializeRound(players, 0, 10, 20);

if (E.isRight(result)) {
  const gameState = result.right;
  console.log('ゲーム開始！');
  console.log('ステージ:', gameState.stage); // 'preflop'
  console.log('ポット:', gameState.totalPot); // 30 (SB 10 + BB 20)
} else {
  console.error('エラー:', result.left);
}
```

### 2. プレイヤーアクションの処理

```typescript
import { processAction } from './engine';
import type { PlayerAction } from './engine';

// レイズアクション
const action: PlayerAction = {
  playerId: 'p1',
  type: 'raise',
  amount: 50,
};

const result = processAction(action, gameState);

if (E.isRight(result)) {
  const newState = result.right;
  console.log('レイズ成功！新しいベット:', newState.currentBet);
  // 次のプレイヤーのターンへ
} else {
  const error = result.left;
  console.error('アクションエラー:', error.type, error);
}
```

### 3. ステージの進行

```typescript
import { advanceStage, isBettingComplete } from './engine';

// ベットラウンドが完了したかチェック
if (isBettingComplete(gameState)) {
  // 次のステージへ
  const result = advanceStage(gameState);

  if (E.isRight(result)) {
    const newState = result.right;
    console.log('新しいステージ:', newState.stage); // 'flop', 'turn', etc.
    console.log('コミュニティカード:', newState.communityCards);
  }
}
```

### 4. ポット計算

```typescript
import { calculatePots } from './engine';

const pots = calculatePots(gameState);

pots.forEach((pot, index) => {
  console.log(`Pot ${index + 1}: ${pot.amount} チップ`);
  console.log(`Eligible: ${Array.from(pot.eligiblePlayers).join(', ')}`);
});
```

## API リファレンス

### ゲーム初期化

#### `initializeRound`
新しいラウンドを開始します。

```typescript
initializeRound(
  players: readonly Player[],
  dealerIndex: number,
  smallBlind: number,
  bigBlind: number
): Either<GameError, GameState>
```

- ✅ デッキをシャッフル
- ✅ 各プレイヤーに2枚のホールカードをディール
- ✅ ブラインドを徴収
- ✅ 最初のベッターを設定

### アクション処理

#### `processAction`
プレイヤーアクションを処理します。

```typescript
processAction(
  action: PlayerAction,
  state: GameState
): Either<GameError, GameState>
```

**サポートされるアクション:**
- `fold` - フォールド
- `check` - チェック（ベットが揃っている時）
- `call` - コール
- `raise` - レイズ（amount必須）
- `allin` - オールイン

#### `getValidActions`
プレイヤーが実行可能なアクションを取得します。

```typescript
getValidActions(
  playerId: PlayerId,
  state: GameState
): readonly ActionType[]
```

### ステージ遷移

#### `advanceStage`
次のステージに進みます。

```typescript
advanceStage(state: GameState): Either<GameError, GameState>
```

自動的に以下を処理します：
- preflop → flop（3枚ディール）
- flop → turn（1枚ディール）
- turn → river（1枚ディール）
- river → showdown

#### `dealFlop` / `dealTurn` / `dealRiver`
個別のステージディール関数も利用可能です。

### ユーティリティ

#### `isBettingComplete`
ベットラウンドが完了したかチェックします。

```typescript
isBettingComplete(state: GameState): boolean
```

#### `calculatePots`
メインポットとサイドポットを計算します。

```typescript
calculatePots(state: GameState): readonly Pot[]
```

複数のall-inシナリオに対応し、正確なポット分配を計算します。

### ハンド評価

#### `evaluateHand`
プレイヤーのハンドを評価します。

```typescript
evaluateHand(
  holeCards: readonly [Card, Card],
  communityCards: readonly Card[]
): Either<GameError, HandEvaluation>
```

pokersolverライブラリを使用して、7枚のカードから最良の5枚を自動的に選択します。

#### `compareHands`
2つのハンドを比較します。

```typescript
compareHands(
  hand1: HandEvaluation,
  hand2: HandEvaluation
): number // 1: hand1が勝ち, -1: hand2が勝ち, 0: 引き分け
```

### ショーダウン処理

#### `performShowdown`
ショーダウン全体を実行します。

```typescript
performShowdown(state: GameState): Either<GameError, ShowdownResult>
```

自動的に以下を処理します：
- 各ポットの勝者を決定
- チップの分配
- サイドポットの処理
- 引き分け時の分配

#### `determineWinners`
各ポットの勝者を決定します。

```typescript
determineWinners(
  state: GameState,
  pots: readonly Pot[]
): Either<GameError, readonly WinnerInfo[]>
```

#### `distributeWinnings`
勝者にチップを分配します。

```typescript
distributeWinnings(
  state: GameState,
  winners: readonly WinnerInfo[]
): GameState
```

## 型定義

### GameState
ゲームの完全な状態を表します。

```typescript
interface GameState {
  readonly players: ReadonlyMap<PlayerId, Player>;
  readonly playerStates: ReadonlyMap<PlayerId, PlayerState>;
  readonly stage: Stage;
  readonly dealerIndex: number;
  readonly currentBettorIndex: number;
  readonly deck: readonly Card[];
  readonly communityCards: readonly Card[];
  readonly currentBet: number;
  readonly minRaiseAmount: number;
  readonly lastAggressorId: Option<PlayerId>;
  readonly pots: readonly Pot[];
  readonly totalPot: number;
}
```

### GameError
発生する可能性のあるエラーの型安全なユニオン型。

```typescript
type GameError =
  | { type: 'InvalidTurn'; playerId: PlayerId; expectedPlayerId: PlayerId }
  | { type: 'PlayerNotFound'; playerId: PlayerId }
  | { type: 'PlayerAlreadyFolded'; playerId: PlayerId }
  | { type: 'InvalidAction'; action: ActionType; reason: string }
  | { type: 'InsufficientChips'; required: number; available: number }
  | { type: 'InvalidBetAmount'; amount: number; minimum: number }
  | { type: 'GameNotInProgress'; currentStage: Stage }
  | { type: 'InvalidStage'; expected: Stage; actual: Stage }
  | { type: 'InsufficientCards'; required: number; available: number }
  | { type: 'NoActivePlayers' }
  | { type: 'BettingNotComplete' };
```

## 設計パターン

### Either パターン

成功/失敗を型で表現します。

```typescript
import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';

const result = pipe(
  processAction(action1, state),
  E.chain((state2) => processAction(action2, state2)),
  E.chain((state3) => processAction(action3, state3))
);
```

### Option パターン

存在しない可能性のある値を型で表現します。

```typescript
import * as O from 'fp-ts/Option';

const player = getPlayer('p1', state);

pipe(
  player,
  O.fold(
    () => console.log('プレイヤーが見つかりません'),
    (p) => console.log(`プレイヤー発見: ${p.name}`)
  )
);
```

## 完全な例

```typescript
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import {
  initializeRound,
  processAction,
  advanceStage,
  isBettingComplete,
  calculatePots,
  type Player,
  type PlayerAction,
} from './engine';

// 1. プレイヤー準備
const players: Player[] = [
  { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
  { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
  { id: 'p3', name: 'Charlie', chips: 1000, seat: 2 },
];

// 2. ラウンド開始
const initResult = initializeRound(players, 0, 10, 20);

if (E.isLeft(initResult)) {
  console.error('初期化エラー:', initResult.left);
  process.exit(1);
}

let state = initResult.right;

// 3. プリフロップアクション
const actions: PlayerAction[] = [
  { playerId: 'p3', type: 'call' },    // UTG calls BB
  { playerId: 'p1', type: 'fold' },    // Dealer folds
  { playerId: 'p2', type: 'check' },   // SB checks
  { playerId: 'p3', type: 'check' },   // BB checks
];

for (const action of actions) {
  const result = processAction(action, state);

  if (E.isLeft(result)) {
    console.error('アクションエラー:', result.left);
    break;
  }

  state = result.right;
}

// 4. フロップへ
if (isBettingComplete(state)) {
  const stageResult = advanceStage(state);

  if (E.isRight(stageResult)) {
    state = stageResult.right;
    console.log('フロップ:', state.communityCards.slice(0, 3));
  }
}

// 5. ポット計算
const pots = calculatePots(state);
console.log('ポット情報:', pots);
```

### 完全なゲームフロー（プリフロップ → ショーダウン）

```typescript
import * as E from 'fp-ts/Either';
import {
  initializeRound,
  processAction,
  advanceStage,
  isBettingComplete,
  performShowdown,
  getCurrentBettor,
  type Player,
} from './engine';

const players: Player[] = [
  { id: 'p1', name: 'Alice', chips: 1000, seat: 0 },
  { id: 'p2', name: 'Bob', chips: 1000, seat: 1 },
  { id: 'p3', name: 'Charlie', chips: 1000, seat: 2 },
];

// 1. ラウンド初期化
const initResult = initializeRound(players, 0, 10, 20);
if (E.isLeft(initResult)) throw new Error('Init failed');

let state = initResult.right;

// 2. プリフロップ - 全員コール
while (!isBettingComplete(state)) {
  const bettor = getCurrentBettor(state);
  if (O.isSome(bettor)) {
    const result = processAction(
      { playerId: bettor.value.id, type: 'call' },
      state
    );
    if (E.isRight(result)) state = result.right;
  }
}

// 3. フロップ
let stageResult = advanceStage(state);
if (E.isRight(stageResult)) state = stageResult.right;

// 全員チェック
while (!isBettingComplete(state)) {
  const bettor = getCurrentBettor(state);
  if (O.isSome(bettor)) {
    const result = processAction(
      { playerId: bettor.value.id, type: 'check' },
      state
    );
    if (E.isRight(result)) state = result.right;
  }
}

// 4. ターン、リバーも同様に進行...

// 5. ショーダウン
stageResult = advanceStage(state); // river → showdown
if (E.isRight(stageResult)) state = stageResult.right;

const showdownResult = performShowdown(state);
if (E.isRight(showdownResult)) {
  const { winners, finalState } = showdownResult.right;

  winners.forEach((winner) => {
    console.log(`Winner: ${winner.playerId}`);
    console.log(`Hand: ${winner.evaluation.rank}`);
    console.log(`Won: ${winner.amount} chips`);
  });

  console.log(`Game ended. Stage: ${finalState.stage}`);
}
```

## テスト

```bash
# 全テスト実行
npm test -- tests/engine

# カバレッジ付き
npm test -- tests/engine --coverage

# 特定のテストファイル
npm test -- tests/engine/actions.test.ts
```

## アーキテクチャ

```
engine/
├── types.ts          # 型定義
├── constants.ts      # 定数定義
├── deck.ts           # デッキ関連関数 (21テスト, 100%カバレッジ)
├── utils.ts          # ユーティリティ関数 (31テスト, 100%カバレッジ)
├── actions.ts        # アクション処理関数 (36テスト, 94.02%カバレッジ)
├── pot.ts            # ポット計算関数 (9テスト, 97.5%カバレッジ)
├── game-init.ts      # ゲーム初期化関数 (15テスト, 96%カバレッジ)
├── stage.ts          # ステージ遷移関数 (18テスト, 93.75%カバレッジ)
├── hand-evaluator.ts # ハンド評価関数 (17テスト, 94.59%カバレッジ)
├── showdown.ts       # ショーダウン処理 (24テスト, 94.33%カバレッジ)
├── game-flow-integration.test.ts # 統合テスト (8テスト)
├── index.ts          # エクスポート（カバレッジ対象外）
└── README.md         # このファイル
```

**合計: 179テスト, 96%カバレッジ（statements: 95.98%, functions: 100%）**

## ライセンス

MIT
