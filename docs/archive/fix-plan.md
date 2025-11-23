# ゲームロジック修正計画

## 概要
このドキュメントは、テキサスホールデムポーカーのゲームロジックを修正するための詳細な計画です。
TDD（テスト駆動開発）アプローチで段階的に実装します。

## 修正スコープ

### 対象ファイル
1. [server/src/game/Round.ts](../server/src/game/Round.ts) - ラウンド管理（主要な修正対象）
2. [server/src/socket/socketHandler.ts](../server/src/socket/socketHandler.ts) - 手札配布の修正
3. [server/src/game/GameManager.ts](../server/src/game/GameManager.ts) - 軽微な調整

### 対象外
- PotCalculator、HandEvaluator - 動作に問題なし
- Deck - 動作に問題なし
- クライアント側UI - サーバー修正後に動作確認のみ

## Phase 1: Round クラスの状態管理改善

### 目標
- ターン管理を正確にする
- プレイヤーのアクション履歴を追跡する
- ベッティングラウンド完了判定を修正する

### 追加する状態変数

```typescript
// Round.ts に追加
private hasActed: Set<string>; // アクション済みプレイヤー
private lastAggressorId: string | null; // 最後にベット/レイズしたプレイヤー
private minRaiseAmount: number; // 最小レイズ額
```

### 実装ステップ

#### 1.1 状態変数の初期化
**テスト**: Round インスタンス作成時に状態が正しく初期化される

```typescript
constructor(...) {
  // 既存のコード
  this.hasActed = new Set();
  this.lastAggressorId = null;
  this.minRaiseAmount = this.bigBlind;
}
```

#### 1.2 ターンプレイヤー検証の追加
**テスト**:
- 現在のターンプレイヤーのみがアクション可能
- ターンでないプレイヤーは `Not your turn` エラー

```typescript
public executeAction(...): void {
  // 追加: ターンプレイヤーチェック
  if (playerId !== this.getCurrentBettorId()) {
    throw new Error('Not your turn');
  }

  // 追加: フォールド済みチェック
  if (this.folded.has(playerId)) {
    throw new Error('Player has folded');
  }

  // 既存のアクション処理
  // ...
}
```

#### 1.3 アクション履歴の記録
**テスト**: 各アクション後に `hasActed` に記録される

```typescript
public executeAction(...): void {
  // バリデーション
  // アクション実行

  // 追加: アクション履歴を記録
  this.hasActed.add(playerId);

  // ベット/レイズの場合、アグレッサーを更新
  if (action === 'raise') {
    this.lastAggressorId = playerId;
    // 最小レイズ額を更新
    const currentBet = this.getCurrentBet();
    const previousBet = currentBet - amount; // 簡略化
    this.minRaiseAmount = amount - previousBet;
  }

  // 次のプレイヤーへ
  this.advanceBettor();
}
```

## Phase 2: ベッティング完了判定の全面改修

### 目標
- プリフロップでBBが最後にアクションできるようにする
- 全員がアクション済みかつベット額が揃っているかをチェック
- オールインプレイヤーを正しく処理

### 実装ステップ

#### 2.1 アクティブプレイヤーの定義
**テスト**: フォールド済み・オールイン済みを除外したプレイヤーリスト

```typescript
private getActivePlayers(): Player[] {
  return this.players.filter(p =>
    !this.folded.has(p.id) && p.chips > 0
  );
}
```

#### 2.2 全員アクション済みチェック
**テスト**:
- プリフロップではBBを含む全員がアクション済み
- フロップ以降は全アクティブプレイヤーがアクション済み

```typescript
private hasEveryoneActed(): boolean {
  const activePlayers = this.getActivePlayers();

  // 特殊ケース: 1人だけ残っている
  if (activePlayers.length === 1) {
    return true;
  }

  // 全アクティブプレイヤーがアクション済みか
  return activePlayers.every(p => this.hasActed.has(p.id));
}
```

#### 2.3 ベット額が揃っているかチェック
**テスト**: 全員が同じベット額、またはオールイン

```typescript
private areBetsSettled(): boolean {
  const activePlayers = this.getActivePlayers();

  if (activePlayers.length === 0) {
    return true;
  }

  const currentBet = this.getCurrentBet();

  return activePlayers.every(p => {
    const playerBet = this.playerBets.get(p.id) || 0;
    // ベット額が揃っている、またはオールイン
    return playerBet === currentBet || p.chips === 0;
  });
}
```

#### 2.4 最終的な完了判定
**テスト**:
- 全員フォールド → 即座に完了
- 全員アクション済み + ベット額が揃っている → 完了
- それ以外 → 未完了

```typescript
public isBettingComplete(): boolean {
  const activePlayers = this.getActivePlayers();

  // 1人だけ残っている（全員フォールド）
  if (activePlayers.length === 1) {
    return true;
  }

  // 全員がアクション済みかつベット額が揃っている
  return this.hasEveryoneActed() && this.areBetsSettled();
}
```

## Phase 3: アクションバリデーションの強化

### 目標
- チェック/コール/レイズの実行可能性を正確に判定
- 不正なアクションを防ぐ

### 実装ステップ

#### 3.1 チェックバリデーション
**テスト**:
- ベット額が揃っている場合のみチェック可能
- ベットがある場合はエラー

```typescript
case 'check': {
  const currentBet = this.getCurrentBet();
  const playerBet = this.playerBets.get(playerId) || 0;

  if (playerBet < currentBet) {
    throw new Error('Cannot check, must call or raise');
  }
  break;
}
```

#### 3.2 レイズバリデーション
**テスト**:
- レイズ額が現在のベットより大きい
- 最小レイズ額以上を上乗せ

```typescript
case 'raise': {
  if (!amount) throw new Error('Raise amount required');

  const currentBet = this.getCurrentBet();
  const playerBet = this.playerBets.get(playerId) || 0;
  const totalBet = playerBet + amount;

  // 現在のベット以下はダメ
  if (totalBet <= currentBet) {
    throw new Error('Raise amount too small');
  }

  // 最小レイズ額チェック
  const raiseAmount = totalBet - currentBet;
  if (raiseAmount < this.minRaiseAmount) {
    throw new Error(`Minimum raise is ${this.minRaiseAmount}`);
  }

  // 実際のベット処理
  const actualAmount = Math.min(amount, player.chips);
  player.chips -= actualAmount;
  this.playerBets.set(playerId, playerBet + actualAmount);
  this.pot += actualAmount;

  // 最小レイズ額を更新
  this.minRaiseAmount = raiseAmount;
  this.lastAggressorId = playerId;
  break;
}
```

## Phase 4: ストリート進行時のリセット処理

### 目標
- 新しいストリートで状態を正しくリセット
- ターンを正しいプレイヤーに設定

### 実装ステップ

#### 4.1 advanceRound の改修
**テスト**:
- ベット情報がリセットされる
- アクション履歴がリセットされる
- ターンがSBから開始される

```typescript
public advanceRound(): void {
  // ベット情報をリセット
  this.playerBets.clear();

  // アクション履歴をリセット
  this.hasActed.clear();

  // アグレッサーをリセット
  this.lastAggressorId = null;

  // 最小レイズ額をBBにリセット
  this.minRaiseAmount = this.bigBlind;

  switch (this.stage) {
    case 'preflop':
      this.dealCommunityCards(3);
      this.stage = 'flop';
      break;
    // 他のケース...
  }

  // 次のベッターをディーラーの次に設定（SB位置）
  this.currentBettor = this.getNextPlayerIndex(this.dealerIndex);
}
```

## Phase 5: 手札配布の修正

### 目標
- 各プレイヤーに自分の手札のみを送信
- gameStarted イベントの重複送信を防ぐ

### 実装ステップ

#### 5.1 socketHandler.ts の修正
**テスト**: E2Eテストで確認

```typescript
socket.on('startGame', (data: StartGameData) => {
  try {
    gameManager.startGame(data.roomId);

    const room = gameManager.getRoom(data.roomId);
    const round = gameManager.getActiveRound(data.roomId);

    if (!room || !round) {
      socket.emit('error', { message: 'Failed to start game', code: 'START_GAME_ERROR' });
      return;
    }

    // ゲーム開始を1回だけルーム全体に送信
    io.to(data.roomId).emit('gameStarted', {
      roomId: data.roomId,
      dealerIndex: room.dealerIndex,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        seat: p.seat,
      })),
    });

    // 各プレイヤーに個別に手札を送信
    for (const player of room.players) {
      const hand = round.getPlayerHand(player.id);
      if (hand) {
        // socket IDを見つけて個別送信
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

    // 最初のプレイヤーにターン通知
    io.to(data.roomId).emit('turnNotification', {
      playerId: round.getCurrentBettorId(),
      currentBet: round.getPlayerBet(round.getCurrentBettorId()),
    });

    console.log(`Game started in room: ${data.roomId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start game';
    socket.emit('error', { message, code: 'START_GAME_ERROR' });
  }
});
```

## Phase 6: クライアント側の調整

### 目標
- サーバーからのイベントを正しく処理
- アクションボタンの有効/無効を適切に制御

### 実装ステップ

#### 6.1 Room.tsx の確認
**現在の実装**: 基本的に問題なし

確認ポイント:
- `isMyTurn` の判定が正しく機能するか
- エラーメッセージの表示
- ターン通知の処理

#### 6.2 エラーハンドリングの追加

```typescript
// Room.tsx
useEffect(() => {
  if (!socket) return;

  // エラーイベントの処理
  socket.on('error', (data: { message: string; code: string }) => {
    console.error('Game error:', data);
    alert(data.message); // 本番ではトースト通知など
  });

  return () => {
    socket.off('error');
  };
}, [socket]);
```

## 実装順序

### Day 1: Phase 1-2 (コアロジック)
1. Round.ts に状態変数を追加
2. executeAction にターン検証を追加
3. isBettingComplete を全面改修
4. テストを実行して検証

### Day 2: Phase 3-4 (バリデーションとリセット)
1. アクションバリデーションを強化
2. advanceRound のリセット処理を改修
3. テストを実行して検証

### Day 3: Phase 5-6 (統合・E2E)
1. socketHandler.ts の手札配布を修正
2. クライアント側のエラーハンドリング追加
3. E2Eテストで実際のゲームフローを確認
4. バグ修正とリファクタリング

## テスト戦略

### ユニットテスト
- [x] Round.test.ts を作成済み
- 各Phaseの実装後にテストを実行
- カバレッジ 80% 以上を目標

### 統合テスト
- GameManager + Round の連携テスト
- 複数ラウンドの連続実行

### E2Eテスト
- 2人プレイでのフルゲーム
- 3人以上でのベッティングシナリオ
- オールインとサイドポット

## リスクと対策

### リスク1: 既存機能の破壊
**対策**: 各Phase後に既存のテストを実行

### リスク2: エッジケースの見落とし
**対策**: テストケースを網羅的に作成

### リスク3: クライアント側の互換性
**対策**: サーバー側の修正後、クライアント側で動作確認

## 完了基準

- [ ] すべてのユニットテストが通過
- [ ] 2人プレイでプリフロップ→ショーダウンまで完走
- [ ] 3人プレイでベット・レイズ・コールが正常動作
- [ ] BBが最後にアクションできることを確認
- [ ] 不正なアクションが適切にエラーになる
- [ ] 手札が他のプレイヤーに漏れないことを確認
