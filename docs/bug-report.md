# バグレポート - ゲームロジックの問題

## 報告日
2025-11-21

## 症状（ユーザー報告）
1. ゲーム開始後、check/call/raiseで想定外のボタンを押すとゲームが進行しなくなる
2. game startを押していないプレイヤーがアクションできない
3. **自分、対戦相手どちらにも選択肢が現れず、もう何も進めない状況によく陥る**
4. **そのラウンドにおいて、それぞれがいくらのチップを出しているかがわからない**
5. **初手でplayerがcallすると、ゲームが止まる**
6. **チェックできない盤面でもチェックボタンがactiveになっている（無効なアクションが実行可能）**

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

---

## 修正履歴

### 2025-11-21 修正1: ターン管理とベッティング完了判定
**修正内容**:
- Round.tsに`hasActed`, `lastAggressorId`, `minRaiseAmount`, `cumulativeBets`を追加
- `executeAction()`でターンプレイヤー検証を追加
- `isBettingComplete()`を全面的に書き直し
- 手札配布を個別送信に変更
- ショーダウン計算で累積ベット額を使用

**修正コミット**: `547c7a8`

**残存問題**:
- ベット額表示がまだ実装されていない
- ベッティング完了後にadvanceRound()が呼ばれていない

### 2025-11-21 修正2: ベット額表示機能の追加
**問題**: そのラウンドにおいて、それぞれがいくらのチップを出しているかがわからない

**修正内容**:
- GameContextに`playerBets`を追加
- Round.tsに`getAllPlayerBets()`メソッドを追加
- Socket通信で`playerBets`を送信
- UI上で各プレイヤーのベット額を表示

**修正コミット**: `4b9df8c`

**残存問題**:
- socketHandlerでadvanceRound()が呼ばれていない

### 2025-11-21 修正3: advanceRound()呼び出しの追加
**問題**: 自分、対戦相手どちらにも選択肢が現れず、もう何も進めない状況によく陥る

**根本原因**: socketHandler.tsで`isBettingComplete()`をチェックしていたが、`advanceRound()`を呼んでいなかった

**修正内容**:
- `isBettingComplete()`がtrueの場合、`advanceRound()`を呼ぶ
- ショーダウン時に`performShowdown()`を呼ぶ

**修正コミット**: `4b9df8c`

**残存問題**:
- ベッティング継続中のターン通知が抜けている

### 2025-11-21 修正4: ターン通知の条件分岐修正
**問題**: 初手でplayerがcallすると、ゲームが止まる

**根本原因**: ターン通知の送信条件が不適切で、ベッティング継続中のターン通知処理がなかった

**修正内容**:
アクション後のフローを3パターンに整理:
1. `isComplete() === true` → ショーダウン実行、ターン通知なし
2. `isBettingComplete() === true` → advanceRound()して新ストリート、最初のプレイヤーにターン通知
3. それ以外（ベッティング継続）→ 次のプレイヤーにターン通知

**修正コミット**: `471ee85`

**残存問題**:
- **無効なアクションが実行可能（チェックできない盤面でもチェックボタンがactiveになっている）**
- **有効なアクションを事前に判定する機能がない**

---

## 未解決の問題（2025-11-21 現在）

### 問題6: 無効なアクションボタンが表示される
**症状**: チェックできない盤面でもチェックボタンがactiveになっている

**根本原因**:
- クライアント側で有効なアクションを判定していない
- サーバー側から有効なアクション一覧を送信していない
- UIが全アクションボタンを常に表示している

**必要な修正**:
1. Round.tsに`getValidActions(playerId)`メソッドを追加
2. Socket通信で有効なアクション一覧を送信
3. UI側で有効なアクションのみ表示または有効化

**優先度**: High - ユーザビリティとゲーム品質に直結

### 問題7: 包括的なテストケースの不足
**症状**: その場しのぎの修正になっている

**必要な対応**:
- 全アクション（fold, check, call, raise, allin）の有効/無効パターンをテスト
- 各ステージ（preflop, flop, turn, river）での全シナリオをテスト
- 2人/3人/4人以上でのゲームフローをテスト
- エッジケース（全員フォールド、複数オールインなど）をテスト

**優先度**: Critical - 品質保証の基盤
