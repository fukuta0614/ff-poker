# Server-v2 Acknowledgment-Based State Synchronization Design

**作成日**: 2025-12-03
**更新日**: 2025-12-04
**バージョン**: 2.2.0-alpha
**ステータス**: ✅ エンジン層実装完了（フェーズ1完了）
**目的**: クライアント・サーバー間の状態同期を確実にし、クライアント側の画面遷移制御を簡素化する

> **実装状況**: エンジン層の実装は完了し、全190テストが通過しています。
> 実際のゲームフローについては [GAME_FLOW_SEQUENCE.md](./GAME_FLOW_SEQUENCE.md) を参照してください。

---

## 1. 背景と課題

### 1.1 現在の設計の問題点

現在の server-v2 実装では、以下の動作になっています:

- **エンジン**: `state -> action -> newState` の純粋関数型パターン
- **自動ステージ進行**: all-in で全プレイヤーが call した場合、即座に showdown まで遷移
- **WebSocket通知**: `room:updated` イベントで変更を通知

この設計では、以下の課題があります:

1. **クライアント側の画面遷移が追いつかない**: サーバーが複数ステージを一気に進めた場合、クライアントの画面更新が間に合わない
2. **状態の不整合**: クライアントが古い状態を参照している間にサーバーが次のアクションを処理してしまう
3. **デバッグの困難性**: どのクライアントがどの状態を見ているかが不明確

### 1.2 新しい方針

**クライアント主導の状態同期**を実現します:

- エンジンは外部から要求を受けるまでステップを進めない
- アクション処理後は必ず **ack待ち状態** になる
- 全クライアントから ack が返ってきてから次のステップへ進む

---

## 2. 設計概要

### 2.1 基本フロー

```
┌─────────────┐
│ Client A/B/C│
└──────┬──────┘
       │ (1) Action (fold/call/raise)
       ↓
┌─────────────┐
│   Server    │ (2) processAction()
│ GameService │     ↓
└──────┬──────┘     GameState (ack待ち状態)
       │
       │ (3) Broadcast: room:updated
       ├────────────┐
       │            │
       ↓            ↓
┌──────────┐  ┌──────────┐
│ Client A │  │ Client B │
│          │  │          │
│ 画面更新 │  │ 画面更新 │
└────┬─────┘  └────┬─────┘
     │             │
     │ (4) ack     │ (4) ack
     └─────┬───────┘
           ↓
     ┌─────────────┐
     │   Server    │ (5) 全ack受信確認
     │ GameService │     ↓
     └──────┬──────┘     resolveAcknowledgment()
            │            ↓
            │            次のステップへ (必要なら)
            │
            │ (6) Broadcast: room:updated (次の状態)
            ↓
```

### 2.2 状態遷移パターン

#### パターンA: 通常のアクション (プレイヤーの行動が必要)

```
stage: preflop, waitingForAck: false (Player1 の番)
  ↓ Player1: call
stage: preflop, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: preflop, waitingForAck: false (Player2 の番) ← 次のプレイヤーへ
```

#### パターンA-2: リレイズの連続

```
stage: preflop, waitingForAck: false (Player1 の番)
  ↓ Player1: raise 100
stage: preflop, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: preflop, waitingForAck: false (Player2 の番)
  ↓ Player2: raise 200
stage: preflop, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: preflop, waitingForAck: false (Player3 の番)
  ↓ Player3: call
stage: preflop, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: preflop, waitingForAck: false (Player1 の番)
  ↓ Player1: call (ベット完了)
```

**重要**: `stage` は常に論理的なゲームフェーズを表し、`waitingForAck` が true/false を行き来する

#### パターンB: ステージ進行 (全員行動済み)

```
stage: preflop, waitingForAck: false (ベット完了)
  ↓ advanceStage をトリガー (内部で flop へ進める準備)
stage: flop, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: flop, waitingForAck: false (Player1 の番) ← 新しいステージ
```

#### パターンC: all-in による自動進行

```
stage: preflop, waitingForAck: false (Player1: allin, Player2: call, Player3: call)
  ↓ 最後の call アクション
stage: preflop, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: preflop, waitingForAck: false (ベット完了、誰も行動不要)
  ↓ 自動で advanceStage をトリガー
stage: flop, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: flop, waitingForAck: false (誰も行動不要)
  ↓ 自動で advanceStage をトリガー
stage: turn, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: turn, waitingForAck: false (誰も行動不要)
  ↓ 自動で advanceStage をトリガー
stage: river, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: river, waitingForAck: false (誰も行動不要)
  ↓ 自動で advanceStage をトリガー
stage: showdown, waitingForAck: true
  ↓ 全プレイヤーから ack
stage: showdown, waitingForAck: false
```

**重要**: all-in のケースでも、各ステージごとにクライアントの画面更新を待つ

---

## 3. データ構造の変更

### 3.1 Stage 型 (変更なし)

```typescript
/**
 * ゲームステージ型 (既存のまま)
 */
type Stage =
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'ended';
```

### 3.2 GameState への追加フィールド

```typescript
/**
 * 確認応答の状態
 */
interface AcknowledgmentState {
  /**
   * ack を期待するプレイヤーID
   * ゲーム中の全アクティブプレイヤー (folded 以外)
   */
  readonly expectedAcks: ReadonlySet<PlayerId>;

  /**
   * 既に受信した ack
   */
  readonly receivedAcks: ReadonlySet<PlayerId>;

  /**
   * ack 待ち開始のタイムスタンプ (タイムアウト検出用)
   */
  readonly startedAt: number;

  /**
   * 遷移の説明 (デバッグ用)
   */
  readonly description: string;
}

/**
 * 拡張された GameState
 */
interface GameState {
  // ... 既存のフィールド ...

  /**
   * ゲームステージ (preflop/flop/turn/river/showdown/ended)
   * ack 待ち中でも、論理的なステージはそのまま
   */
  readonly stage: Stage;

  /**
   * クライアントからの確認応答を待っているか
   * true: 全クライアントの ack を待機中 (アクションを受け付けない)
   * false: 通常状態 (アクションを受け付け可能)
   */
  readonly waitingForAck: boolean;  // 🆕 新規追加

  /**
   * 確認応答の状態
   * waitingForAck が true の時のみ Some
   */
  readonly ackState: Option<AcknowledgmentState>;
}
```

### 3.3 新しいアクションタイプ

```typescript
type ActionType =
  | 'fold'
  | 'check'
  | 'call'
  | 'raise'
  | 'allin'
  | 'acknowledge'; // 🆕 新規追加

interface PlayerAction {
  readonly playerId: PlayerId;
  readonly type: ActionType;
  readonly amount?: number;

  // acknowledge アクション専用フィールド
  readonly acknowledgedAt?: number; // クライアント側のタイムスタンプ
}
```

### 3.4 新しいエラータイプ

```typescript
type GameError =
  | ... // 既存のエラー
  | { readonly type: 'WaitingForAcknowledgment' }
  | { readonly type: 'AcknowledgmentNotExpected'; readonly playerId: PlayerId }
  | { readonly type: 'AcknowledgmentAlreadyReceived'; readonly playerId: PlayerId }
  | { readonly type: 'AcknowledgmentTimeout'; readonly ackState: AcknowledgmentState };
```

---

## 4. エンジン層の変更

### 4.1 processAction の変更

```typescript
/**
 * プレイヤーアクションを処理
 *
 * 変更点:
 * 1. アクション処理後、waitingForAck を true に設定
 * 2. ステージ進行は行わず、ack待ち状態にする
 */
export const processAction = (
  action: PlayerAction,
  state: GameState
): Either<GameError, GameState> => {
  // acknowledge アクションの場合は専用処理
  if (action.type === 'acknowledge') {
    return processAcknowledgment(action.playerId, state);
  }

  // すでに ack 待ち状態の場合はエラー
  if (state.waitingForAck) {
    return E.left({
      type: 'WaitingForAcknowledgment',
    });
  }

  // 既存のアクション処理ロジック (fold/check/call/raise/allin)
  const result = processPlayerAction(action, state);

  if (E.isLeft(result)) {
    return result;
  }

  const newState = result.right;

  // アクション完了後、ack 待ち状態へ遷移
  const activePlayers = getActivePlayers(newState); // folded 以外

  return E.right({
    ...newState,
    waitingForAck: true,
    ackState: O.some({
      expectedAcks: new Set(activePlayers.map(p => p.id)),
      receivedAcks: new Set(),
      startedAt: Date.now(),
      description: `Action ${action.type} by ${action.playerId}`,
    }),
  });
};
```

### 4.2 新しい関数: processAcknowledgment

```typescript
/**
 * クライアントからの ack を処理
 *
 * 動作:
 * 1. waitingForAck が true か確認
 * 2. playerId が expectedAcks に含まれるか確認
 * 3. receivedAcks に追加
 * 4. 全員から ack が揃ったら、遷移を実行
 */
export const processAcknowledgment = (
  playerId: PlayerId,
  state: GameState
): Either<GameError, GameState> => {
  // ack 待ち状態でない場合はエラー
  if (!state.waitingForAck) {
    return E.left({
      type: 'AcknowledgmentNotExpected',
      playerId,
    });
  }

  // ackState が存在しない場合はエラー (不整合)
  if (O.isNone(state.ackState)) {
    return E.left({
      type: 'AcknowledgmentNotExpected',
      playerId,
    });
  }

  const ackState = state.ackState.value;

  // 期待されていない playerId からの ack
  if (!ackState.expectedAcks.has(playerId)) {
    return E.left({
      type: 'AcknowledgmentNotExpected',
      playerId,
    });
  }

  // 既に受信済み
  if (ackState.receivedAcks.has(playerId)) {
    return E.left({
      type: 'AcknowledgmentAlreadyReceived',
      playerId,
    });
  }

  // ack を記録
  const newReceivedAcks = new Set(ackState.receivedAcks);
  newReceivedAcks.add(playerId);

  const updatedAckState: AcknowledgmentState = {
    ...ackState,
    receivedAcks: newReceivedAcks,
  };

  // まだ全員揃っていない場合
  if (newReceivedAcks.size < ackState.expectedAcks.size) {
    return E.right({
      ...state,
      ackState: O.some(updatedAckState),
    });
  }

  // 全員から ack が揃った → 遷移を実行
  return resolveAcknowledgment(state);
};
```

### 4.3 新しい関数: resolveAcknowledgment

```typescript
/**
 * 全員からの ack を受け取った後の処理
 *
 * 動作:
 * 1. waitingForAck を false に戻す
 * 2. ackState をクリア
 * 3. 必要に応じて次のステップへ進む (ベット完了 → ステージ進行)
 */
const resolveAcknowledgment = (
  state: GameState
): Either<GameError, GameState> => {
  // ack 状態をクリア
  const clearedState: GameState = {
    ...state,
    waitingForAck: false,
    ackState: O.none,
  };

  // ベットラウンドが完了しているかチェック
  if (isBettingComplete(clearedState) && clearedState.stage !== 'showdown') {
    // ステージを進める必要がある
    return advanceStageWithAck(clearedState);
  }

  // 通常の状態に戻る (次のプレイヤーのアクションを待つ)
  return E.right(clearedState);
};
```

### 4.4 新しい関数: advanceStageWithAck

```typescript
/**
 * ステージを進め、ack 待ち状態にする
 */
const advanceStageWithAck = (
  state: GameState
): Either<GameError, GameState> => {
  // 既存の advanceStage を呼ぶ
  const result = advanceStage(state);

  if (E.isLeft(result)) {
    return result;
  }

  const newState = result.right;

  // 新しいステージでも ack 待ち状態にする
  const activePlayers = getActivePlayers(newState);

  return E.right({
    ...newState,
    waitingForAck: true,
    ackState: O.some({
      expectedAcks: new Set(activePlayers.map(p => p.id)),
      receivedAcks: new Set(),
      startedAt: Date.now(),
      description: `Stage advanced to ${newState.stage}`,
    }),
  });
};
```

### 4.5 ヘルパー関数

```typescript
/**
 * アクティブなプレイヤー (folded 以外) を取得
 */
const getActivePlayers = (state: GameState): readonly Player[] => {
  const result: Player[] = [];

  for (const [playerId, player] of state.players) {
    const playerState = state.playerStates.get(playerId);
    if (playerState && !playerState.isFolded) {
      result.push(player);
    }
  }

  return result;
};
```

**注**: all-in による自動進行は `isBettingComplete` が自動的に判定するため、特別な処理は不要です。
- all-in で全員のベットが揃った場合、`isBettingComplete` が true を返す
- `resolveAcknowledgment` が `advanceStageWithAck` を呼び出す
- 再度 ack 待ち状態になり、クライアントが画面更新後に ack を返す
- この繰り返しで、各ステージごとに確実に同期が取れる

---

## 5. サーバー層 (GameService) の変更

### 5.1 GameService の責務

- WebSocket 経由で全クライアントに `room:updated` を送信
- クライアントからの `acknowledge` アクションを受け取る
- 全 ack が揃ったら自動的に次の処理を実行

### 5.2 実装例

```typescript
class GameService {
  /**
   * プレイヤーアクションを処理
   */
  async processPlayerAction(
    roomId: string,
    action: PlayerAction
  ): Promise<Either<GameError, GameState>> {
    const room = this.gameManager.getRoom(roomId);
    if (!room) {
      return E.left({ type: 'RoomNotFound', roomId });
    }

    // エンジンにアクションを投げる
    const result = processAction(action, room.gameState);

    if (E.isLeft(result)) {
      return result;
    }

    const newState = result.right;

    // 状態を保存
    this.gameManager.updateRoomState(roomId, newState);

    // 全クライアントに通知
    this.notifier.broadcastRoomUpdated(roomId, {
      updateType: action.type === 'acknowledge' ? 'ack_received' : 'action',
      timestamp: Date.now(),
    });

    return E.right(newState);
  }
}
```

**注**: 自動進行は `resolveAcknowledgment` 内で処理されるため、GameService では特別な処理は不要です。
- クライアントから ack が届く
- `processAction({ type: 'acknowledge' })` を呼び出す
- `resolveAcknowledgment` が `isBettingComplete` をチェック
- 必要なら自動的に `advanceStageWithAck` を呼び出す
- 再度 `waitingForAck: true` になり、クライアントに通知される

---

## 6. クライアント側の実装

### 6.1 基本フロー

```typescript
// room:updated イベントを受信
socket.on('room:updated', async (data) => {
  // 1. 最新の状態を取得
  const state = await fetchRoomState(roomId, playerId);

  // 2. 画面を更新
  updateUI(state);

  // 3. ack を送信
  await sendAction({
    playerId,
    type: 'acknowledge',
    acknowledgedAt: Date.now(),
  });
});
```

### 6.2 行動が期待されているプレイヤー

```typescript
// 自分の番の場合
if (state.currentBettorId === myPlayerId) {
  // ユーザー操作を待つ
  // ユーザーがアクションを選択したら送信
  await sendAction({
    playerId: myPlayerId,
    type: 'raise',
    amount: 100,
  });

  // この場合、ack は送信しない
  // (アクション自体が ack の代わり)
}
```

### 6.3 実装の工夫

**オプション1**: 自分の番の場合も ack を送る

- アクションと ack を分離
- サーバー側で自分のアクションは ack として扱う

**オプション2**: 自分の番の場合は ack 不要

- アクション自体が ack の代わり
- サーバー側で expectedAcks から除外

---

## 7. タイムアウト処理

### 7.1 ack タイムアウト

クライアントが一定時間 ack を返さない場合の対応:

```typescript
/**
 * タイムアウトをチェック
 *
 * - 30秒以内に ack が返らない場合、そのプレイヤーをスキップ
 * - または、ゲームを一時停止してプレイヤーの再接続を待つ
 */
const checkAcknowledgmentTimeout = (
  state: GameState,
  timeoutMs: number = 30000
): Either<GameError, GameState> => {
  if (!state.waitingForAck || O.isNone(state.ackState)) {
    return E.right(state);
  }

  const ackState = state.ackState.value;
  const elapsed = Date.now() - ackState.startedAt;

  if (elapsed > timeoutMs) {
    // タイムアウト発生
    // オプション1: タイムアウトしたプレイヤーを fold 扱い
    // オプション2: エラーを返して手動対応
    return E.left({
      type: 'AcknowledgmentTimeout',
      ackState,
    });
  }

  return E.right(state);
};
```

### 7.2 定期チェック

```typescript
// GameService でタイマーを設定
setInterval(() => {
  for (const [roomId, room] of this.gameManager.getAllRooms()) {
    const result = checkAcknowledgmentTimeout(room.gameState);

    if (E.isLeft(result)) {
      // タイムアウト処理
      this.handleAckTimeout(roomId, result.left);
    }
  }
}, 5000); // 5秒ごとにチェック
```

---

## 8. テスト戦略

### 8.1 ユニットテスト

```typescript
describe('processAcknowledgment', () => {
  it('should accept ack from expected player', () => {
    const state = createStateWaitingForAck(['p1', 'p2']);

    const result = processAcknowledgment('p1', state);

    expect(E.isRight(result)).toBe(true);
    const newState = result.right;
    expect(newState.waitingForAck).toBe(true);
    expect(newState.ackState.value.receivedAcks.has('p1')).toBe(true);
  });

  it('should resolve acknowledgment when all acks received', () => {
    const state = createStateWaitingForAck(['p1', 'p2']);

    // p1 の ack
    const result1 = processAcknowledgment('p1', state);
    expect(E.isRight(result1)).toBe(true);

    // p2 の ack → ack 解決
    const result2 = processAcknowledgment('p2', result1.right);
    expect(E.isRight(result2)).toBe(true);
    expect(result2.right.waitingForAck).toBe(false);
    expect(O.isNone(result2.right.ackState)).toBe(true);
  });

  it('should reject ack from unexpected player', () => {
    const state = createStateWaitingForAck(['p1', 'p2']);

    const result = processAcknowledgment('p3', state);

    expect(E.isLeft(result)).toBe(true);
    expect(result.left.type).toBe('AcknowledgmentNotExpected');
  });
});
```

### 8.2 統合テスト

```typescript
describe('Full game flow with acknowledgments', () => {
  it('should progress through stages with acks', async () => {
    // ゲーム開始
    let state = initializeRound(players, 0, 10, 20, rngState).right;

    // preflop: p1 call
    state = processAction({ playerId: 'p1', type: 'call' }, state).right;
    expect(state.waitingForAck).toBe(true);
    expect(state.stage).toBe('preflop');

    // 全プレイヤーから ack
    state = processAcknowledgment('p1', state).right;
    state = processAcknowledgment('p2', state).right;
    state = processAcknowledgment('p3', state).right;

    expect(state.waitingForAck).toBe(false);
    expect(state.stage).toBe('preflop'); // まだ preflop

    // ... 続けて flop まで進む
  });

  it('should handle reraise sequence with acks', async () => {
    let state = initializeRound(players, 0, 10, 20, rngState).right;

    // p1: raise
    state = processAction({ playerId: 'p1', type: 'raise', amount: 100 }, state).right;
    expect(state.waitingForAck).toBe(true);
    expect(state.stage).toBe('preflop');

    // 全員 ack
    state = processAcknowledgment('p1', state).right;
    state = processAcknowledgment('p2', state).right;
    state = processAcknowledgment('p3', state).right;
    expect(state.waitingForAck).toBe(false);

    // p2: reraise
    state = processAction({ playerId: 'p2', type: 'raise', amount: 200 }, state).right;
    expect(state.waitingForAck).toBe(true);
    expect(state.stage).toBe('preflop');

    // 全員 ack
    state = processAcknowledgment('p1', state).right;
    state = processAcknowledgment('p2', state).right;
    state = processAcknowledgment('p3', state).right;
    expect(state.waitingForAck).toBe(false);
    expect(state.stage).toBe('preflop'); // まだ preflop
  });
});
```

---

## 9. 移行計画

### 9.1 フェーズ1: エンジン層の実装 ✅ 完了

- [x] `AcknowledgmentState` 型を追加
- [x] `GameState` に `waitingForAck` と `acknowledgment` フィールドを追加
- [x] `ActionType` に `'acknowledge'` を追加
- [x] `processAcknowledgment` 関数を実装
- [x] `resolveAcknowledgment` 関数を実装
- [x] `advanceStageWithAck` 関数を実装
- [x] `processAction` を修正して ack 待ち状態にする
- [x] ユニットテストを追加（9テスト）
- [x] 統合テストを更新（8テスト、全190テスト通過）

### 9.2 フェーズ2: サーバー層の実装

- [ ] `GameService` に ack 処理を追加
- [ ] タイムアウト処理を実装
- [ ] WebSocket イベントを更新
- [ ] 統合テストを追加

### 9.3 フェーズ3: クライアント実装

- [ ] `acknowledge` アクションの送信ロジック
- [ ] UI 更新と ack のタイミング調整
- [ ] E2E テストを追加

### 9.4 フェーズ4: 本番デプロイ

- [ ] パフォーマンステスト
- [ ] 負荷テスト
- [ ] 段階的ロールアウト

---

## 10. まとめ

### 10.1 メリット

- ✅ **確実な状態同期**: 全クライアントが画面更新を完了してから次のステップへ
- ✅ **クライアント側の簡素化**: 複雑な状態管理が不要、画面更新 → ack のシンプルなフロー
- ✅ **デバッグの容易性**: どのクライアントが ack を返していないかが明確
- ✅ **段階的な進行**: all-in でも各ステージごとに画面更新を待つ

### 10.2 デメリットと対策

- ⚠️ **レイテンシの増加**: 全クライアントの ack を待つため、遅延が増える
  - 対策: タイムアウト処理、切断プレイヤーの自動 fold
- ⚠️ **実装の複雑さ**: エンジンに状態管理が追加される
  - 対策: 純粋関数型パターンを維持、テストを充実

### 10.3 今後の拡張

- **部分的な ack**: 特定のプレイヤーからの ack のみで進行可能にする
- **再接続処理**: 切断したプレイヤーの再接続時に現在の pendingTransition を伝える
- **リプレイ機能**: ack のタイミングを記録してゲームを再生

---

**関連ドキュメント**:
- [README.md](./README.md) - Server-v2 概要
- [CLIENT_IMPLEMENTATION_PLAN.md](./CLIENT_IMPLEMENTATION_PLAN.md) - クライアント実装計画
- [src/engine/README.md](./src/engine/README.md) - エンジン仕様書

**変更履歴**:
- 2025-12-03: 初版作成
