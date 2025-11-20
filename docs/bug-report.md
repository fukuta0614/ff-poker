# バグレポート - ゲームロジックの問題

## 報告日
2025-11-21

## 症状
- ゲーム開始後、check/call/raiseで想定外のボタンを押すとゲームが進行しなくなる
- game startを押していないプレイヤーがアクションできない

## 根本原因の分析

### 問題1: 手札配布の実装ミス
**場所**: [server/src/socket/socketHandler.ts:94-114](../server/src/socket/socketHandler.ts#L94-L114)

**現在のコード**:
```typescript
for (const player of room.players) {
  const hand = round.getPlayerHand(player.id);
  io.to(data.roomId).emit('gameStarted', { ... });

  if (hand) {
    io.to(data.roomId).emit('dealHand', {
      playerId: player.id,
      hand: hand,
    });
  }
}
```

**問題点**:
- `io.to(roomId).emit()` は **ルーム全体** にブロードキャストする
- 全プレイヤーが全員の手札情報を受け取ってしまう
- `gameStarted` イベントもプレイヤー数分送信される(重複)

**期待動作**:
- `gameStarted` は1回だけルーム全体に送信
- 各プレイヤーの手札は **そのプレイヤーにのみ** 送信

**修正方法**:
```typescript
// ゲーム開始は1回だけ全体に送信
io.to(data.roomId).emit('gameStarted', { ... });

// 各プレイヤーに個別に手札を送信
for (const player of room.players) {
  const hand = round.getPlayerHand(player.id);
  if (hand) {
    // socket IDを使って個別送信
    const playerSocket = Array.from(io.sockets.sockets.values())
      .find(s => (s as any).playerId === player.id);

    if (playerSocket) {
      playerSocket.emit('dealHand', {
        playerId: player.id,
        hand: hand,
      });
    }
  }
}
```

### 問題2: ターン管理とアクション検証の不備
**場所**: [server/src/game/Round.ts:103-158](../server/src/game/Round.ts#L103-L158)

**問題点**:
1. `executeAction()` で現在のターンプレイヤーかどうかをチェックしていない
2. 誰でもアクションできてしまう
3. チェック可能条件の検証が不十分

**現在のコード**:
```typescript
public executeAction(
  playerId: string,
  action: 'fold' | 'call' | 'raise' | 'check' | 'allin',
  amount?: number
): void {
  const player = this.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found');

  const currentBet = this.getCurrentBet();
  const playerBet = this.playerBets.get(playerId) || 0;

  switch (action) {
    case 'check':
      if (playerBet < currentBet) {
        throw new Error('Cannot check, must call or raise');
      }
      break;
    // ...
  }
}
```

**修正が必要な点**:
1. ターンプレイヤーチェック追加
2. フォールド済みプレイヤーのチェック
3. オールイン済みプレイヤーのチェック

### 問題3: ベッティングラウンド完了判定のバグ
**場所**: [server/src/game/Round.ts:274-289](../server/src/game/Round.ts#L274-L289)

**現在のコード**:
```typescript
public isBettingComplete(): boolean {
  const activePlayers = this.players.filter((p) => !this.folded.has(p.id));

  if (activePlayers.length === 1) {
    return true;
  }

  const currentBet = this.getCurrentBet();
  const allCalled = activePlayers.every((p) => {
    const playerBet = this.playerBets.get(p.id) || 0;
    return playerBet === currentBet || p.chips === 0;
  });

  return allCalled;
}
```

**問題点**:
1. **プリフロップでBBがアクションする前に完了と判定される**
   - 例: UTGがコール、BBのベット額 == currentBet なので `allCalled` が true
   - しかしBBはまだアクションしていない

2. **「全員がアクション済み」のチェックがない**
   - ベット額が揃っているだけではダメ
   - 各プレイヤーが最低1回はアクションする必要がある

3. **レイズ後のラウンド処理が不正確**
   - 最後にレイズしたプレイヤーまで巡ったかを追跡していない

**正しい実装に必要な情報**:
- 各プレイヤーがアクション済みかどうかのフラグ
- プリフロップでのBBの特殊処理
- 最後にベット/レイズしたプレイヤーの追跡

### 問題4: currentBettorの更新タイミング
**場所**: [server/src/game/Round.ts:312-314](../server/src/game/Round.ts#L312-L314)

**問題点**:
- `advanceBettor()` が `executeAction()` の最後に呼ばれる
- しかし、ベッティングラウンドが完了してストリートが変わる場合、currentBettorは無効になる
- 次のストリートで正しいプレイヤーから始まらない

### 問題5: プリフロップの初期currentBettor設定
**場所**: [server/src/game/Round.ts:49](../server/src/game/Round.ts#L49)

**現在のコード**:
```typescript
this.currentBettor = this.getNextPlayerIndex(this.getBigBlindIndex());
```

**問題点**:
- これは正しい(UTGから開始)
- しかし、BBが最後にアクションする権利を保持する仕組みがない

## 再現手順

### ケース1: チェックできない状況でチェックを押す
1. プレイヤーAとBでゲーム開始
2. UTGがチェックを押す
3. エラーが発生して進行不能

### ケース2: ゲーム開始していないプレイヤー
1. ホストがゲーム開始
2. ゲストプレイヤーの画面で「Your Turn」が表示されない
3. アクションボタンが無効のまま

### ケース3: BBが最後にアクションできない
1. プレイヤーが3人以上
2. UTGとその後のプレイヤーが全員コール
3. BBがチェックする前にフロップに進んでしまう

## 影響範囲
- ゲームの基本フロー全体
- 全ベッティングラウンド
- マルチプレイヤー体験

## 優先度
**Critical** - ゲームがプレイ不可能

## 修正方針

### Phase 1: ターン管理の修正
1. `Round` クラスに `hasActed: Set<string>` を追加
2. `executeAction()` でターンプレイヤー検証を追加
3. アクション後に `hasActed` に記録

### Phase 2: ベッティング完了判定の修正
1. `isBettingComplete()` を全面的に書き直し
2. プリフロップでのBB特殊処理を実装
3. 「全員アクション済み」+ 「ベット額が揃っている」を両方チェック

### Phase 3: 手札配布の修正
1. Socket.io の個別送信機能を使用
2. プレイヤーIDとsocket IDのマッピングを管理
3. 各プレイヤーに自分の手札のみ送信

### Phase 4: エッジケースの処理
1. オールインプレイヤーの扱い
2. 全員フォールドの判定
3. サイドポットの正確な計算

## テスト計画

### ユニットテスト
- `Round.executeAction()` のターン検証
- `Round.isBettingComplete()` の各シナリオ
- `Round.advanceBettor()` のスキップロジック

### 統合テスト
- プリフロップからショーダウンまでの完全フロー
- 複数プレイヤーでのベッティングシナリオ
- オールインとサイドポット

### E2Eテスト
- 実際のSocket.io通信での手札配布
- マルチプレイヤーでのターン制御
- UI上でのアクションボタンの有効/無効
