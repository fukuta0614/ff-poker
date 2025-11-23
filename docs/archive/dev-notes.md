# 開発メモ

## 開発環境設定

### Node.js / npm PATH

このプロジェクトでは nvm (Node Version Manager) を使用しています。

**使用しているNode.jsバージョン**: v23.10.0

### 依存関係の問題と解決

#### uuid パッケージ

**問題**: uuid v13 は pure ESM パッケージで、Jest（CommonJS）と互換性がない

**解決**: uuid v9 にダウングレード
```bash
npm install uuid@9
```

## 統合テスト実行結果（2025-11-21）

### テスト環境
- Socket.io v4.8.1
- socket.io-client v4.8.1（統合テスト用）
- Jest + ts-jest

### 実行方法
```bash
cd server
npm test tests/integration/
```

### 発見された問題

#### 問題1: 2人プレイヤー時のディーラー/ブラインド/ターン順序の誤り

**症状**:
ユーザー報告「一番最初でcallしてもallinしても何しても、対戦相手のアクションが出てこない」

**統合テストで判明した原因**:

2人プレイヤーの場合:
- Player1（seat 0）: ID `367f1586-5c71-4f69-856e-281cc2c1e530`
- Player2（seat 1）: ID `f18e73be-cb98-409a-919c-c214aa69d1b1`

**ゲームスタート時のログ**:
```
[DEBUG] Game started - room players: [
  { id: '367f1586-5c71-4f69-856e-281cc2c1e530', name: 'Player1' },
  { id: 'f18e73be-cb98-409a-919c-c214aa69d1b1', name: 'Player2' }
]
[DEBUG] Game started - current bettor: f18e73be-cb98-409a-919c-c214aa69d1b1
```

**ブラインド割り当て（実際）**:
```json
playerBets: {
  'f18e73be-cb98-409a-919c-c214aa69d1b1': 10,   // Player2が10 = SB
  '367f1586-5c71-4f69-856e-281cc2c1e530': 20    // Player1が20 = BB
}
```

**問題点**:
1. **ブラインドの割り当てが逆**: Player1（seat 0）がBB、Player2（seat 1）がSBになっている
2. **最初のベッターが間違い**: Player2（BB側）が最初にアクションする判定になっている
   - 正しくは、2人プレイヤーの場合はSB（ディーラー）が最初にアクションすべき

**期待される動作** (2人プレイヤー、dealerIndex=0の場合):
- Player1（seat 0, Dealer）= SB = 10チップ = 最初にアクション
- Player2（seat 1）= BB = 20チップ = 2番目にアクション

**現在の動作**:
- Player1（seat 0）= BB = 20チップ
- Player2（seat 1, ❌ 誤判定）= SB = 10チップ = 最初にアクション

**影響**:
- 2人プレイヤーのプリフロップで、BB側がアクションを待つが、次のターン通知が来ない
- 統合テストでタイムアウト
- ユーザー報告の「対戦相手のアクションが出てこない」と一致

#### 問題2: 3人プレイヤー時のターン判定

**ログ**:
```
[DEBUG] Game started - room players: [
  { id: '1ec130fb-b62b-41f5-b3f8-faa01605ecac', name: 'Player1' },
  { id: '026e3392-55c8-490a-89bc-557c1d57b73c', name: 'Player2' },
  { id: '236caefa-3146-4437-b026-1848648bc296', name: 'Player3' }
]
[DEBUG] Game started - current bettor: 1ec130fb-b62b-41f5-b3f8-faa01605ecac

playerBets: {
  '026e3392-55c8-490a-89bc-557c1d57b73c': 10,  // Player2 = SB
  '236caefa-3146-4437-b026-1848648bc296': 20   // Player3 = BB
}
```

**判定**:
- Player1 がUTG（seat 0、ディーラーの次の次）なので、最初にアクションするのは**正しい**
- ただし、テストではPlayer1がSB、Player2がBB、Player3がUTGになることを期待していた可能性

**3人の場合のディーラー配置** (dealerIndex=0):
- Player1 (seat 0, Dealer)
- Player2 (seat 1) = SB
- Player3 (seat 2) = BB
- 最初のアクション: Player1 (UTG = Dealer自身)

これは**正しい動作**です。

### 修正が必要な箇所

#### Round.ts のブラインド処理

2人プレイヤーの特殊ルール:
- **ディーラー（ボタン）= Small Blind**
- **ディーラーの次 = Big Blind**
- **プリフロップではSB（ディーラー）が最初にアクション**

現在の実装は、おそらく以下が間違っている:
1. ブラインドの割り当てロジック（`start()`メソッド）
2. 最初のベッター判定ロジック（`getCurrentBettorId()`メソッド）

### 修正内容（2025-11-22）

#### 1. Round.ts の2人プレイヤー時のブラインド割り当て修正

**修正箇所**: `getSmallBlindIndex()` と `getBigBlindIndex()`

```typescript
private getSmallBlindIndex(): number {
  // 2人プレイヤーの場合: ディーラー = Small Blind
  if (this.players.length === 2) {
    return this.dealerIndex;
  }
  // 3人以上: ディーラーの次 = Small Blind
  return (this.dealerIndex + 1) % this.players.length;
}

private getBigBlindIndex(): number {
  // 2人プレイヤーの場合: ディーラーの次（対面）= Big Blind
  if (this.players.length === 2) {
    return (this.dealerIndex + 1) % this.players.length;
  }
  // 3人以上: ディーラーの次の次 = Big Blind
  return (this.dealerIndex + 2) % this.players.length;
}
```

#### 2. Round.ts の2人プレイヤー時の初期ベッター修正

**修正箇所**: コンストラクタ

```typescript
// プリフロップの最初のベッターを初期化
// 2人プレイヤー: Small Blind (ディーラー)
// 3人以上: Big Blindの次 (UTG)
if (players.length === 2) {
  this.currentBettor = this.getSmallBlindIndex();
} else {
  this.currentBettor = this.getNextPlayerIndex(this.getBigBlindIndex());
}
```

#### 3. GameManager.ts の重複ロジック削除

**問題**: GameManagerとsocketHandlerの両方で`advanceRound()`を呼び出していたため、`hasActed`が二重にクリアされ、`isBettingComplete()`が誤判定

**修正**: GameManager.executePlayerAction() から `advanceRound()` の呼び出しを削除し、socketHandlerのみで制御

#### 4. 統合テストの修正

- **playerIdの取得**: `roomCreated`のhostIdではなく、`joinedRoom`のplayerIdを使用
- **3人プレイヤーのターン順序**: dealerIndex=0の場合、Player1(Dealer)=UTG, Player2=SB, Player3=BBが正しい

### テスト結果

統合テスト3件すべて成功:
- ✓ 2プレイヤーでプリフロップベッティングが完了し、フロップに進む
- ✓ 3プレイヤーでプリフロップ全員アクションが正しく実行される
- ✓ プレイヤーがレイズした場合、全員が再度アクションする

## 参考資料

### Texas Hold'em 2人プレイヤールール
- ディーラー（ボタン）= Small Blind
- ディーラーの対面（1人だけ）= Big Blind
- プリフロップ: SB（ディーラー）が最初にアクション、BBが最後
- フロップ以降: BBが最初にアクション

### 3人以上プレイヤールール
- ディーラー（ボタン）
- ディーラーの次 = Small Blind
- Small Blindの次 = Big Blind
- プリフロップ: Big Blindの次（UTG）が最初にアクション
- フロップ以降: Small Blindが最初にアクション

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2025-11-21 | 初版作成、統合テスト結果と問題分析を記載 |
