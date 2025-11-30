# 純粋関数型ゲームエンジン設計書

## 概要

現在のクラスベース・ミューテーション型実装から、fp-tsを用いた純粋関数型アプローチへの段階的リファクタリング計画。

## 設計方針

### 基本原則

```
currentState -> userAction -> newState
```

- **Immutability**: すべての状態は不変
- **Pure Functions**: 副作用なし、同じ入力なら同じ出力
- **Explicit Error Handling**: `Either` で成功/失敗を明示的に
- **Type Safety**: `Option` でnull安全性を保証
- **Composability**: 小さな関数を組み合わせて複雑な処理を構築

### fp-ts活用方針

| 機能 | 用途 | 例 |
|------|------|-----|
| **Either** | エラーハンドリング | `Either<GameError, GameState>` |
| **Option** | null安全性 | `Option<Player>` |
| **State Monad** | 状態遷移 | `State<GameState, ActionResult>` |
| **pipe/flow** | 関数合成 | `pipe(state, validateAction, executeAction, advanceStage)` |

---

## 型定義

### コア型定義

```typescript
// --- 基本型 ---

type PlayerId = string;
type Card = string;  // "As", "Kh" など

type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin';

type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

// --- ゲーム状態型 ---

interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly chips: number;
  readonly seat: number;
  readonly connected: boolean;
}

interface PlayerState {
  readonly bet: number;              // 現在のストリートのベット額
  readonly cumulativeBet: number;    // 累積ベット額（全ストリート）
  readonly isFolded: boolean;
  readonly hasActed: boolean;
  readonly hand: Option<readonly [Card, Card]>;  // ホールカード
}

interface Pot {
  readonly amount: number;
  readonly eligiblePlayers: ReadonlySet<PlayerId>;
}

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

// --- アクション型 ---

interface PlayerAction {
  readonly playerId: PlayerId;
  readonly type: ActionType;
  readonly amount?: number;
}

// --- エラー型 ---

type GameError =
  | { type: 'InvalidTurn'; playerId: PlayerId }
  | { type: 'PlayerNotFound'; playerId: PlayerId }
  | { type: 'PlayerAlreadyFolded'; playerId: PlayerId }
  | { type: 'InvalidAction'; action: ActionType; reason: string }
  | { type: 'InsufficientChips'; required: number; available: number }
  | { type: 'InvalidBetAmount'; amount: number; minimum: number }
  | { type: 'GameNotInProgress' }
  | { type: 'InvalidStage'; expected: Stage; actual: Stage };

// --- 結果型 ---

interface ActionResult {
  readonly success: boolean;
  readonly message: string;
  readonly nextState: GameState;
}

interface ShowdownResult {
  readonly winners: ReadonlyArray<{
    readonly playerId: PlayerId;
    readonly hand: string;
    readonly rank: string;
    readonly amount: number;
  }>;
  readonly pots: readonly Pot[];
}
```

---

## 主要関数のシグネチャ

### 1. ゲーム初期化

```typescript
/**
 * 新しいラウンドを開始
 */
const initializeRound = (
  players: ReadonlyArray<Player>,
  dealerIndex: number,
  smallBlind: number,
  bigBlind: number
): Either<GameError, GameState>

/**
 * デッキをシャッフル
 */
const shuffleDeck = (): readonly Card[]

/**
 * プレイヤーにカードを配る
 */
const dealHoleCards = (
  state: GameState
): Either<GameError, GameState>

/**
 * ブラインドを徴収
 */
const collectBlinds = (
  state: GameState,
  smallBlind: number,
  bigBlind: number
): Either<GameError, GameState>
```

### 2. アクション処理（State Monad使用）

```typescript
/**
 * プレイヤーアクションを検証
 */
const validateAction = (
  action: PlayerAction
): State<GameState, Either<GameError, void>>

/**
 * アクションを実行
 */
const executeAction = (
  action: PlayerAction
): State<GameState, Either<GameError, ActionResult>>

/**
 * ベットラウンドが完了したかチェック
 */
const isBettingComplete = (
  state: GameState
): boolean

/**
 * 次のプレイヤーに進む
 */
const advanceBettor = (
  state: GameState
): GameState

/**
 * 次のステージに進む
 */
const advanceStage = (
  state: GameState
): Either<GameError, GameState>
```

### 3. 個別アクション処理

```typescript
/**
 * フォールド処理
 */
const executeFold = (
  playerId: PlayerId,
  state: GameState
): GameState

/**
 * チェック処理
 */
const executeCheck = (
  playerId: PlayerId,
  state: GameState
): Either<GameError, GameState>

/**
 * コール処理
 */
const executeCall = (
  playerId: PlayerId,
  state: GameState
): Either<GameError, GameState>

/**
 * レイズ処理
 */
const executeRaise = (
  playerId: PlayerId,
  amount: number,
  state: GameState
): Either<GameError, GameState>

/**
 * オールイン処理
 */
const executeAllIn = (
  playerId: PlayerId,
  state: GameState
): Either<GameError, GameState>
```

### 4. ゲーム進行

```typescript
/**
 * フロップをディール（3枚のコミュニティカード）
 */
const dealFlop = (
  state: GameState
): Either<GameError, GameState>

/**
 * ターンをディール（1枚のコミュニティカード）
 */
const dealTurn = (
  state: GameState
): Either<GameError, GameState>

/**
 * リバーをディール（1枚のコミュニティカード）
 */
const dealRiver = (
  state: GameState
): Either<GameError, GameState>

/**
 * ショーダウンを実行
 */
const performShowdown = (
  state: GameState
): Either<GameError, ShowdownResult>

/**
 * 勝者を決定
 */
const determineWinners = (
  state: GameState,
  pots: readonly Pot[]
): Either<GameError, ShowdownResult>
```

### 5. ヘルパー関数

```typescript
/**
 * 有効なアクションを取得
 */
const getValidActions = (
  playerId: PlayerId,
  state: GameState
): ReadonlyArray<ActionType>

/**
 * プレイヤーを取得（Option）
 */
const getPlayer = (
  playerId: PlayerId,
  state: GameState
): Option<Player>

/**
 * プレイヤー状態を取得（Option）
 */
const getPlayerState = (
  playerId: PlayerId,
  state: GameState
): Option<PlayerState>

/**
 * アクティブなプレイヤーを取得（フォールドしていない）
 */
const getActivePlayers = (
  state: GameState
): ReadonlyArray<Player>

/**
 * コール額を計算
 */
const calculateCallAmount = (
  playerId: PlayerId,
  state: GameState
): number

/**
 * ポット計算（サイドポット含む）
 */
const calculatePots = (
  state: GameState
): readonly Pot[]
```

---

## 実装例

### 例1: アクション処理の基本フロー

```typescript
import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';

/**
 * プレイヤーアクションを処理するメイン関数
 */
export const processAction = (
  action: PlayerAction,
  state: GameState
): Either<GameError, GameState> => {
  return pipe(
    state,
    // 1. バリデーション
    validatePlayerTurn(action.playerId),
    E.chain(validatePlayerNotFolded(action.playerId)),
    E.chain(validateActionType(action)),

    // 2. アクション実行
    E.chain(executeActionByType(action)),

    // 3. ベットラウンド完了チェック
    E.map(checkAndAdvanceStage),

    // 4. 次のプレイヤーに進む
    E.map(advanceBettor)
  );
};
```

### 例2: フォールド処理

```typescript
/**
 * フォールド処理（純粋関数）
 */
export const executeFold = (
  playerId: PlayerId,
  state: GameState
): GameState => {
  return {
    ...state,
    playerStates: new Map(state.playerStates).set(
      playerId,
      {
        ...state.playerStates.get(playerId)!,
        isFolded: true,
        hasActed: true,
      }
    ),
  };
};
```

### 例3: コール処理（Either使用）

```typescript
/**
 * コール処理
 */
export const executeCall = (
  playerId: PlayerId,
  state: GameState
): Either<GameError, GameState> => {
  return pipe(
    getPlayer(playerId, state),
    O.fold(
      () => E.left<GameError, GameState>({
        type: 'PlayerNotFound',
        playerId,
      }),
      (player) => {
        const callAmount = calculateCallAmount(playerId, state);

        if (player.chips < callAmount) {
          return E.left({
            type: 'InsufficientChips',
            required: callAmount,
            available: player.chips,
          });
        }

        const playerState = state.playerStates.get(playerId)!;
        const newBet = playerState.bet + callAmount;

        return E.right({
          ...state,
          players: new Map(state.players).set(playerId, {
            ...player,
            chips: player.chips - callAmount,
          }),
          playerStates: new Map(state.playerStates).set(playerId, {
            ...playerState,
            bet: newBet,
            cumulativeBet: playerState.cumulativeBet + callAmount,
            hasActed: true,
          }),
          totalPot: state.totalPot + callAmount,
        });
      }
    )
  );
};
```

### 例4: レイズ処理（複雑なバリデーション）

```typescript
/**
 * レイズ処理
 */
export const executeRaise = (
  playerId: PlayerId,
  amount: number,
  state: GameState
): Either<GameError, GameState> => {
  return pipe(
    getPlayer(playerId, state),
    O.fold(
      () => E.left<GameError, GameState>({
        type: 'PlayerNotFound',
        playerId,
      }),
      (player) => {
        const playerState = state.playerStates.get(playerId)!;
        const totalBet = playerState.bet + amount;

        // バリデーション
        if (totalBet <= state.currentBet) {
          return E.left({
            type: 'InvalidBetAmount',
            amount: totalBet,
            minimum: state.currentBet + state.minRaiseAmount,
          });
        }

        const raiseAmount = totalBet - state.currentBet;
        if (raiseAmount < state.minRaiseAmount && player.chips > amount) {
          return E.left({
            type: 'InvalidBetAmount',
            amount: raiseAmount,
            minimum: state.minRaiseAmount,
          });
        }

        if (player.chips < amount) {
          return E.left({
            type: 'InsufficientChips',
            required: amount,
            available: player.chips,
          });
        }

        // 実行
        return E.right({
          ...state,
          players: new Map(state.players).set(playerId, {
            ...player,
            chips: player.chips - amount,
          }),
          playerStates: new Map(state.playerStates).set(playerId, {
            ...playerState,
            bet: totalBet,
            cumulativeBet: playerState.cumulativeBet + amount,
            hasActed: true,
          }),
          currentBet: totalBet,
          minRaiseAmount: raiseAmount,
          lastAggressorId: O.some(playerId),
          totalPot: state.totalPot + amount,
        });
      }
    )
  );
};
```

### 例5: State Monadを使ったアクション合成

```typescript
import * as S from 'fp-ts/State';

/**
 * State Monadを使ったアクション処理
 */
export const processActionWithState = (
  action: PlayerAction
): State<GameState, Either<GameError, ActionResult>> => {
  return pipe(
    S.get<GameState>(),
    S.chain((state) => {
      // アクションを実行
      const result = processAction(action, state);

      return pipe(
        result,
        E.fold(
          // エラー時
          (error) => S.of(E.left<GameError, ActionResult>(error)),

          // 成功時
          (newState) => pipe(
            S.put(newState),
            S.map(() => E.right<GameError, ActionResult>({
              success: true,
              message: `Action ${action.type} executed successfully`,
              nextState: newState,
            }))
          )
        )
      );
    })
  );
};

/**
 * 複数アクションを合成
 */
export const processMultipleActions = (
  actions: ReadonlyArray<PlayerAction>
): State<GameState, Either<GameError, ActionResult>> => {
  return actions.reduce(
    (acc, action) => pipe(
      acc,
      S.chain((prevResult) =>
        pipe(
          prevResult,
          E.fold(
            // 前のアクションでエラーなら停止
            (error) => S.of(E.left(error)),
            // 前のアクションが成功なら次へ
            () => processActionWithState(action)
          )
        )
      )
    ),
    S.of(E.right<GameError, ActionResult>({
      success: true,
      message: 'Initial state',
      nextState: {} as GameState, // ダミー
    }))
  );
};
```

### 例6: ステージ遷移

```typescript
/**
 * ベットラウンド完了チェック & ステージ進行
 */
export const checkAndAdvanceStage = (
  state: GameState
): GameState => {
  if (!isBettingComplete(state)) {
    return state;
  }

  return pipe(
    advanceStage(state),
    E.getOrElse(() => state)
  );
};

/**
 * 次のステージに進む
 */
export const advanceStage = (
  state: GameState
): Either<GameError, GameState> => {
  switch (state.stage) {
    case 'preflop':
      return dealFlop(state);

    case 'flop':
      return dealTurn(state);

    case 'turn':
      return dealRiver(state);

    case 'river':
      return pipe(
        performShowdown(state),
        E.map((showdownResult) => ({
          ...state,
          stage: 'showdown' as Stage,
        }))
      );

    case 'showdown':
      return E.right({
        ...state,
        stage: 'ended' as Stage,
      });

    default:
      return E.left({
        type: 'InvalidStage',
        expected: 'preflop',
        actual: state.stage,
      });
  }
};

/**
 * フロップをディール
 */
export const dealFlop = (
  state: GameState
): Either<GameError, GameState> => {
  if (state.deck.length < 4) {  // バーンカード + 3枚
    return E.left({
      type: 'InvalidAction',
      action: 'bet',
      reason: 'Insufficient cards in deck',
    });
  }

  return E.right({
    ...state,
    stage: 'flop' as Stage,
    deck: state.deck.slice(4),  // バーンカード1枚 + フロップ3枚
    communityCards: [
      ...state.communityCards,
      ...state.deck.slice(1, 4),
    ],
    currentBet: 0,
    currentBettorIndex: (state.dealerIndex + 1) % state.players.size,
    playerStates: resetBetsForNewStreet(state.playerStates),
  });
};
```

---

## 段階的移行パス

### フェーズ1: 基盤整備（1-2日）

**目標**: fp-ts導入 + 型定義

1. **依存関係追加**
   ```bash
   npm install fp-ts
   ```

2. **型定義ファイル作成**
   - `server/src/game-functional/types.ts`
   - GameState, PlayerAction, GameError など

3. **ユーティリティ関数作成**
   - `server/src/game-functional/utils.ts`
   - getPlayer, getPlayerState, calculateCallAmount など

4. **テストセットアップ**
   - `server/tests/functional/`
   - 純粋関数のユニットテスト

### フェーズ2: コア関数実装（3-4日）

**目標**: アクション処理関数の実装

1. **基本アクション関数**
   - `executeFold`
   - `executeCheck`
   - `executeCall`

2. **複雑なアクション関数**
   - `executeRaise`
   - `executeAllIn`

3. **テスト作成**
   - 各関数のユニットテスト
   - エッジケース（オールイン、サイドポットなど）

### フェーズ3: ゲーム進行関数（2-3日）

**目標**: ステージ遷移とショーダウン

1. **ステージ遷移**
   - `advanceStage`
   - `dealFlop`, `dealTurn`, `dealRiver`

2. **ショーダウン**
   - `performShowdown`
   - `calculatePots`
   - `determineWinners`

3. **統合テスト**
   - 完全なハンドフロー

### フェーズ4: 既存コードとの統合（2-3日）

**目標**: 既存のRoundクラスから関数型関数を呼び出す

1. **アダプターパターン**
   ```typescript
   // Round.ts
   executeAction(playerId: string, action: ActionType, amount?: number): void {
     const functionalAction: PlayerAction = {
       playerId,
       type: action,
       amount,
     };

     const result = processAction(functionalAction, this.toGameState());

     pipe(
       result,
       E.fold(
         (error) => {
           throw new Error(`Action failed: ${error.type}`);
         },
         (newState) => {
           this.applyGameState(newState);
         }
       )
     );
   }

   private toGameState(): GameState {
     // 現在のクラスインスタンスをGameStateに変換
   }

   private applyGameState(state: GameState): void {
     // GameStateをクラスインスタンスに反映
   }
   ```

2. **段階的置き換え**
   - 1つずつアクション処理を関数型に移行
   - テストを実行して動作確認

3. **統合テスト**
   - 既存の統合テストが通ることを確認

### フェーズ5: 完全移行（オプション）

**目標**: Roundクラスを完全に削除

1. **GameManagerリファクタリング**
   - GameManagerも関数型に
   - Roomの状態管理をイミュータブルに

2. **Socket.io統合**
   - ハンドラーを純粋関数に

3. **パフォーマンス最適化**
   - 不要なコピーの削減
   - Structural sharing検討

---

## テスト戦略

### 純粋関数のテスト

```typescript
import * as E from 'fp-ts/Either';
import { executeFold, executeCall } from '../game-functional/actions';

describe('executeFold', () => {
  it('should mark player as folded', () => {
    const state: GameState = createTestGameState();
    const result = executeFold('player1', state);

    expect(result.playerStates.get('player1')?.isFolded).toBe(true);
  });

  it('should not mutate original state', () => {
    const state: GameState = createTestGameState();
    const originalPlayerState = state.playerStates.get('player1');

    executeFold('player1', state);

    expect(state.playerStates.get('player1')).toBe(originalPlayerState);
  });
});

describe('executeCall', () => {
  it('should return Left if player not found', () => {
    const state: GameState = createTestGameState();
    const result = executeCall('nonexistent', state);

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.type).toBe('PlayerNotFound');
    }
  });

  it('should return Left if insufficient chips', () => {
    const state: GameState = createTestGameState({
      players: new Map([['player1', { id: 'player1', chips: 10, ... }]]),
      currentBet: 100,
    });

    const result = executeCall('player1', state);

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left.type).toBe('InsufficientChips');
    }
  });

  it('should update chips and bets correctly', () => {
    const state: GameState = createTestGameState({
      players: new Map([['player1', { id: 'player1', chips: 100, ... }]]),
      playerStates: new Map([['player1', { bet: 10, ... }]]),
      currentBet: 50,
    });

    const result = executeCall('player1', state);

    expect(E.isRight(result)).toBe(true);
    if (E.isRight(result)) {
      const newState = result.right;
      expect(newState.players.get('player1')?.chips).toBe(60);
      expect(newState.playerStates.get('player1')?.bet).toBe(50);
    }
  });
});
```

### Property-Based Testing（推奨）

```typescript
import * as fc from 'fast-check';

describe('executeRaise - property-based tests', () => {
  it('should never allow negative chips', () => {
    fc.assert(
      fc.property(
        fc.record({
          chips: fc.integer({ min: 0, max: 10000 }),
          raiseAmount: fc.integer({ min: 0, max: 10000 }),
        }),
        ({ chips, raiseAmount }) => {
          const state = createTestGameState({
            players: new Map([['p1', { id: 'p1', chips, ... }]]),
          });

          const result = executeRaise('p1', raiseAmount, state);

          if (E.isRight(result)) {
            const player = result.right.players.get('p1');
            expect(player?.chips).toBeGreaterThanOrEqual(0);
          }
        }
      )
    );
  });
});
```

---

## パフォーマンス考慮事項

### Immutability のコスト

**問題**: Map/Set のコピーはコストが高い

```typescript
// コストが高い
playerStates: new Map(state.playerStates).set(playerId, newPlayerState)
```

**解決策**:

1. **Structural Sharing**（将来の最適化）
   - Immutable.js または immer 導入検討
   - 変更された部分だけコピー

2. **batch updates**
   ```typescript
   const updateMultiplePlayers = (
     state: GameState,
     updates: Array<[PlayerId, Partial<PlayerState>]>
   ): GameState => {
     const newPlayerStates = new Map(state.playerStates);

     updates.forEach(([id, update]) => {
       const current = newPlayerStates.get(id);
       if (current) {
         newPlayerStates.set(id, { ...current, ...update });
       }
     });

     return { ...state, playerStates: newPlayerStates };
   };
   ```

3. **遅延評価**（State Monad の利点）
   - 複数の状態変更を合成してから一度に適用

---

## メリット・デメリット

### メリット

✅ **テスタビリティ向上**
  - 純粋関数は簡単にテスト可能
  - モックやスタブ不要

✅ **デバッグしやすさ**
  - 状態遷移が明示的
  - タイムトラベルデバッグ可能

✅ **並行処理の安全性**
  - 状態の共有による競合なし

✅ **型安全性**
  - Either でエラーケースが型に現れる
  - Option で null が型に現れる

✅ **リファクタリングの容易さ**
  - 関数の入出力が明確
  - 副作用がないため影響範囲が限定的

### デメリット

⚠️ **学習曲線**
  - fp-ts の概念に慣れるまで時間がかかる

⚠️ **パフォーマンス**
  - イミュータブルデータのコピーコスト
  - （ただし、ゲームエンジンのスケールでは問題にならない）

⚠️ **コード量の増加**
  - Either/Option の処理で冗長になる可能性
  - （pipe で軽減可能）

⚠️ **既存コードとの統合**
  - アダプターレイヤーが必要
  - （段階的移行で解決）

---

## まとめ

### 推奨アプローチ

1. **フェーズ1-3**: 純粋関数型のコアエンジンを別ディレクトリに実装
2. **フェーズ4**: アダプターパターンで既存コードから呼び出し
3. **段階的にテスト**: 各フェーズでテストを書いて動作確認
4. **オプション**: 将来的に完全移行を検討

### 次のステップ

1. このドキュメントをレビュー
2. フェーズ1（基盤整備）の実装開始
3. TDDサイクルで各関数を実装
4. 既存のテストと比較して動作確認

---

**作成日**: 2025-11-29
**対象バージョン**: FF Poker v1.0
**著者**: Claude Code
