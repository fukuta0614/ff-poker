# ゲームフローシーケンス

Acknowledgment-based State Synchronization を使用したゲームの流れを説明します。

> **関連ドキュメント**: このシステムの設計意図や詳細な実装仕様については [ACKNOWLEDGMENT_SYNC_DESIGN.md](./ACKNOWLEDGMENT_SYNC_DESIGN.md) を参照してください。

## 1. 基本概念

### 1.1 Acknowledgment の種類

```typescript
type AcknowledgmentType = 'action' | 'stage_transition';
```

- **action**: プレイヤーのアクション（bet, call, fold, raise, allin, check）後の確認
- **stage_transition**: ステージ遷移（preflop → flop → turn → river → showdown）の確認

### 1.2 状態遷移の基本パターン

```
Normal State → Action/Stage Change → Waiting for Ack → All Acked → Normal State
```

## 2. プレイヤーアクションのシーケンス

### 2.1 シングルアクション（例: Player1 が Call）

```
Client1          GameService         Engine              Client2, Client3
  |                   |                 |                      |
  |-- call -------->  |                 |                      |
  |                   |-- processAction |                      |
  |                   |                 |                      |
  |                   |                 | [Update state]       |
  |                   |                 | waitingForAck = true |
  |                   |                 | type = 'action'      |
  |                   |                 | pendingAcks = Set()  |
  |                   |                 |                      |
  |                   |<-- GameState ---|                      |
  |                   |                 |                      |
  |<-- broadcast --------------------- state update ---------->|
  |                   |                 |                      |
  |-- ack ----------> |                 |                      |
  |                   |-- processAction |                      |
  |                   |   (acknowledge) |                      |
  |                   |                 | [Remove from pending]|
  |                   |<-- GameState ---|                      |
  |                   |                 |                      |
  |                   |                 |                 <----|-- ack
  |                   |<--------------- (acknowledge) ---------|
  |                   |                 | [Remove from pending]|
  |                   |                 |                      |
  |                   |                 |                 <----|-- ack
  |                   |<--------------- (acknowledge) ---------|
  |                   |                 | [All acked!]         |
  |                   |                 | waitingForAck = false|
  |                   |                 | pendingAcks = null   |
  |                   |<-- GameState ---|                      |
  |                   |                 |                      |
  |<-- broadcast --------------------- ready for next --------->|
```

### 2.2 複数アクション（Betting Round）

```
[Preflop開始: SB=P1(10), BB=P2(20), UTG=P3]

P3 -- call(20) --> Engine
                   → waitingForAck=true (type='action')
                   → broadcast to all
P1,P2,P3 -- ack -> Engine
                   → waitingForAck=false
                   → next turn: P1 (SB)

P1 -- call(10) --> Engine
                   → waitingForAck=true (type='action')
                   → broadcast to all
P1,P2,P3 -- ack -> Engine
                   → waitingForAck=false
                   → next turn: P2 (BB)

P2 -- check ----> Engine
                   → waitingForAck=true (type='action')
                   → broadcast to all
P1,P2,P3 -- ack -> Engine
                   → waitingForAck=false
                   → isBettingComplete() = true
```

## 3. ステージ遷移のシーケンス

### 3.1 Preflop → Flop

```
Client1          GameService              Engine              Client2, Client3
  |                   |                      |                      |
  |                   | [Betting complete]   |                      |
  |                   |                      |                      |
  |                   |-- advanceStageWithAck()                     |
  |                   |                      |                      |
  |                   |                      | [Advance to flop]    |
  |                   |                      | - Deal 3 cards       |
  |                   |                      | - Reset bets         |
  |                   |                      | - Set first bettor   |
  |                   |                      | waitingForAck = true |
  |                   |                      | type = 'stage_transition'
  |                   |<-- GameState --------|                      |
  |                   |                      |                      |
  |<-- broadcast ------------------- flop dealt -------------------->|
  |                   |                      |                      |
  |-- ack ----------> |                      |                      |
  |                   |-- processAction      |                      |
  |                   |   (acknowledge)      |                      |
  |                   |                      | [Remove from pending]|
  |                   |                      |                      |
  |                   |                 <----|----------------------|-- ack
  |                   |<--------------- (acknowledge) --------------|
  |                   |                      | [Remove from pending]|
  |                   |                      |                      |
  |                   |                 <----|----------------------|-- ack
  |                   |<--------------- (acknowledge) --------------|
  |                   |                      | [All acked!]         |
  |                   |                      | waitingForAck = false|
  |                   |<-- GameState --------|                      |
  |                   |                      |                      |
  |<-- broadcast ------------------- ready for betting ------------->|
```

## 4. 完全なゲームフローの例

### 4.1 2プレイヤー、ショーダウンまで進む場合

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ゲーム初期化                                               │
└─────────────────────────────────────────────────────────────┘
initializeRound()
  → stage = 'preflop'
  → Deal hole cards (2枚 × 2人)
  → Post blinds (SB=10, BB=20)
  → totalPot = 30

┌─────────────────────────────────────────────────────────────┐
│ 2. Preflop Betting Round                                    │
└─────────────────────────────────────────────────────────────┘
Turn: SB
  SB -- call(10) --> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

Turn: BB
  BB -- check -----> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

  isBettingComplete() = true
  totalPot = 40

┌─────────────────────────────────────────────────────────────┐
│ 3. Flop Transition                                          │
└─────────────────────────────────────────────────────────────┘
GameService -- advanceStageWithAck()
  → stage = 'flop'
  → Deal 3 community cards
  → waitingForAck=true (type='stage_transition')

All -- ack ------> waitingForAck=false

┌─────────────────────────────────────────────────────────────┐
│ 4. Flop Betting Round                                       │
└─────────────────────────────────────────────────────────────┘
Turn: SB
  SB -- check -----> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

Turn: BB
  BB -- check -----> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

  isBettingComplete() = true

┌─────────────────────────────────────────────────────────────┐
│ 5. Turn Transition                                          │
└─────────────────────────────────────────────────────────────┘
GameService -- advanceStageWithAck()
  → stage = 'turn'
  → Deal 1 community card (total 4)
  → waitingForAck=true (type='stage_transition')

All -- ack ------> waitingForAck=false

┌─────────────────────────────────────────────────────────────┐
│ 6. Turn Betting Round                                       │
└─────────────────────────────────────────────────────────────┘
Turn: SB
  SB -- check -----> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

Turn: BB
  BB -- check -----> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

  isBettingComplete() = true

┌─────────────────────────────────────────────────────────────┐
│ 7. River Transition                                         │
└─────────────────────────────────────────────────────────────┘
GameService -- advanceStageWithAck()
  → stage = 'river'
  → Deal 1 community card (total 5)
  → waitingForAck=true (type='stage_transition')

All -- ack ------> waitingForAck=false

┌─────────────────────────────────────────────────────────────┐
│ 8. River Betting Round                                      │
└─────────────────────────────────────────────────────────────┘
Turn: SB
  SB -- check -----> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

Turn: BB
  BB -- check -----> waitingForAck=true (type='action')
  All -- ack ------> waitingForAck=false

  isBettingComplete() = true

┌─────────────────────────────────────────────────────────────┐
│ 9. Showdown Transition                                      │
└─────────────────────────────────────────────────────────────┘
GameService -- advanceStageWithAck()
  → stage = 'showdown'
  → waitingForAck=true (type='stage_transition')

All -- ack ------> waitingForAck=false

┌─────────────────────────────────────────────────────────────┐
│ 10. Showdown Execution                                      │
└─────────────────────────────────────────────────────────────┘
GameService -- performShowdown()
  → Evaluate hands
  → Determine winner(s)
  → Distribute pot
  → stage = 'ended'

Game Over!
```

## 5. 特殊ケース

### 5.1 プレイヤーがフォールドした場合

```
P1 -- raise(60) -> waitingForAck=true (type='action')
All -- ack ------> waitingForAck=false

P2 -- fold ------> waitingForAck=true (type='action')
All -- ack ------> waitingForAck=false

isBettingComplete() = true (1人のみアクティブ)
→ 即座にゲーム終了（ショーダウン不要）
```

### 5.2 オールイン発生時

```
P1 -- allin(500) -> waitingForAck=true (type='action')
All -- ack -------> waitingForAck=false

P2 -- call(500) --> waitingForAck=true (type='action')
All -- ack -------> waitingForAck=false

P3 -- fold -------> waitingForAck=true (type='action')
All -- ack -------> waitingForAck=false

isBettingComplete() = true

以降、全ステージでベッティングアクションなし:
  advanceStageWithAck() → ack → advanceStageWithAck() → ack ...
  → showdown
```

### 5.3 複数プレイヤーのオールイン（サイドポット）

```
P1 (500chips) -- raise(100)
All -- ack

P2 (200chips) -- allin(200)
All -- ack

P3 (100chips) -- allin(100)
All -- ack

P1 -- call(100) → P1のbet合計が200になる
All -- ack

isBettingComplete() = true

Pots:
  Main Pot: 100 × 3 = 300 (eligible: P1, P2, P3)
  Side Pot 1: 100 × 2 = 200 (eligible: P1, P2)

→ 全ステージスキップしてshowdownへ
```

## 6. 状態チェック

### 6.1 Betting Complete の判定

```typescript
isBettingComplete(state: GameState): boolean {
  const activePlayers = getActivePlayers(state);

  // 1人以下 → 完了
  if (activePlayers.length <= 1) return true;

  // 全員がオールイン → 完了
  const allAllIn = activePlayers.every(p =>
    state.playerStates.get(p.id)?.isAllIn
  );
  if (allAllIn) return true;

  // アクション可能なプレイヤーが全員同額ベットしているか
  const playersNotAllIn = activePlayers.filter(p =>
    !state.playerStates.get(p.id)?.isAllIn
  );

  if (playersNotAllIn.length === 0) return true;

  const allBetsEqual = playersNotAllIn.every(p =>
    state.playerStates.get(p.id)?.bet === state.currentBet
  );

  const allActed = playersNotAllIn.every(p =>
    state.playerStates.get(p.id)?.hasActed
  );

  return allBetsEqual && allActed;
}
```

### 6.2 Waiting for Ack のチェック

```typescript
if (state.waitingForAck) {
  // まだ Ack 待ち状態
  // アクションは受け付けない（acknowledgeのみ受付）

  if (state.acknowledgment?.pendingAcks.size === 0) {
    // 全員が Ack 完了
    // → resolveAcknowledgment() で状態をクリア
  }
}
```

## 7. GameService の責務

GameService は以下の判断・実行を行います：

1. **ベッティングラウンド完了の検知**
   ```typescript
   if (isBettingComplete(state) && !state.waitingForAck) {
     // ステージを進める
   }
   ```

2. **ステージ遷移の実行**
   ```typescript
   const newState = advanceStageWithAck(state);
   // → waitingForAck=true (type='stage_transition')
   broadcast(newState);
   ```

3. **Ack待ち中の処理**
   ```typescript
   if (action.type === 'acknowledge') {
     const newState = processAction(action, state);
     if (!newState.waitingForAck) {
       // Ack完了 → 次のステップへ
     }
   }
   ```

4. **ゲーム終了の判定**
   ```typescript
   if (state.stage === 'showdown' && !state.waitingForAck) {
     const result = performShowdown(state);
     // ポット配分、勝者発表
   }
   ```

## 8. クライアントの責務

1. **アクション送信**
   ```typescript
   sendAction({ type: 'call', playerId: myId });
   ```

2. **状態更新受信 & Ack送信**
   ```typescript
   socket.on('gameStateUpdate', (newState) => {
     updateUI(newState);

     if (newState.waitingForAck) {
       // 自分が Ack 対象に含まれている場合
       sendAction({ type: 'acknowledge', playerId: myId });
     }
   });
   ```

3. **UI更新**
   ```typescript
   function updateUI(state: GameState) {
     if (state.waitingForAck) {
       showWaitingIndicator(state.acknowledgment?.type);
     } else {
       hideWaitingIndicator();
     }
   }
   ```

## 9. まとめ

### 9.1 重要ポイント

- **全アクション後に Ack が必要**（type='action'）
- **全ステージ遷移後に Ack が必要**（type='stage_transition'）
- **Ack 完了まで次の処理に進まない**
- **ステージ遷移は手動トリガー**（`advanceStageWithAck()`を明示的に呼ぶ）

### 9.2 利点

1. **同期の保証**: 全クライアントが同じ状態を見てから次に進む
2. **デバッグ容易性**: どこで待機しているか明確
3. **アニメーション対応**: クライアント側でアニメーション完了後に Ack 送信可能
4. **ネットワーク遅延対応**: 遅いクライアントも確実に状態を受信

### 9.3 注意点

- GameService は Ack タイムアウト処理が必要（TODO）
- クライアントが切断した場合の Ack スキップ処理が必要（TODO）
