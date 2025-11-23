# テスト設計書

## テストレベル

### 1. ユニットテスト (Unit Test)

**目的**: 個々のクラス・関数が単体で正しく動作するか検証

**対象**:
- `Round.ts` - ゲームラウンドのロジック
- `Deck.ts` - デッキのシャッフル・カード配布
- `HandEvaluator.ts` - 手札評価ロジック
- `PotCalculator.ts` - ポット計算ロジック

**実装状況**:
- ✅ `Round.test.ts` (26テスト) - プリフロップからショーダウンまでの各アクション
- ✅ `Deck.test.ts` - デッキの生成とシャッフル
- ✅ `HandEvaluator.test.ts` - 役判定とハンドランキング
- ✅ `PotCalculator.test.ts` - サイドポット計算

**カバレッジ目標**: 80%以上

**実行コマンド**:
```bash
cd server
npm test
```

---

### 2. 統合テスト (Integration Test)

**目的**: 複数のコンポーネントが連携して正しく動作するか検証

**対象**:
- Socket.io通信 + GameManager + Round の統合
- プレイヤーアクション → サーバー処理 → 他プレイヤーへの通知
- 複数プレイヤーのベッティングラウンド完了 → 次ストリート移行

**実装状況**:
- ✅ `tests/integration/game-flow.test.ts` (3テスト)

**テストケース**:

#### テスト1: 2プレイヤーでプリフロップベッティングが完了し、フロップに進む
**目的**: 基本的なゲームフローが動作することを確認

**シナリオ**:
1. プレイヤー1がルーム作成
2. プレイヤー1、プレイヤー2がルームに参加
3. ゲーム開始
4. プレイヤー1（SB）がcall
5. プレイヤー2（BB）がcheck
6. フロップに進む

**検証項目**:
- プレイヤー1にターン通知が届く
- プレイヤー2にターン通知が届く
- `newStreet` イベントが発火し、state が 'flop' になる
- コミュニティカードが3枚配られる

#### テスト2: 3プレイヤーでプリフロップ全員アクションが正しく実行される
**目的**: 3人以上のターン順序が正しいことを確認

**シナリオ**:
1. 3人がルームに参加
2. ゲーム開始
3. プレイヤー3（UTG）がcall
4. プレイヤー1（SB）がcall
5. プレイヤー2（BB）がcheck
6. フロップに進む

**検証項目**:
- ターン順序が UTG → SB → BB であること
- 全員アクション後にフロップに進むこと

#### テスト3: プレイヤーがレイズした場合、全員が再度アクションする
**目的**: レイズ後の再アクションが正しく動作することを確認

**シナリオ**:
1. 2人がルームに参加
2. ゲーム開始
3. プレイヤー1（SB）がcall
4. プレイヤー2（BB）がraise
5. プレイヤー1がcall（レイズに対応）
6. フロップに進む

**検証項目**:
- プレイヤー2がレイズ後、プレイヤー1にターンが回ること
- プレイヤー1がコール後、プレイヤー2にはターンが回らないこと
- アクション順序が SB call → BB raise → SB call であること

**カバレッジ目標**: 主要なゲームフローをカバー

**実行コマンド**:
```bash
cd server
npm test tests/integration/
```

**必要な準備**:
- `socket.io-client` パッケージのインストール
  ```bash
  npm install --save-dev socket.io-client
  ```

---

### 3. E2Eテスト (End-to-End Test)

**目的**: ユーザー視点で実際のシナリオが正しく動作するか検証

**対象**:
- フロントエンド + バックエンド の完全な統合
- 実際のブラウザでのユーザー操作
- 複数ブラウザでの同時プレイ

**実装予定**: マイルストーンB

**テストフレームワーク**: Playwright

**想定テストケース**:
1. 2プレイヤーでゲーム開始からショーダウンまでの完全なゲーム
2. プレイヤー切断と再接続
3. 無効なアクションの試行とエラーメッセージ表示
4. レスポンシブデザインの確認（モバイル/デスクトップ）

---

## テスト実行環境

### ユニットテスト・統合テスト
- **フレームワーク**: Jest
- **環境**: Node.js 20.x
- **並列実行**: 可能
- **タイムアウト**: 統合テストは15-20秒

### E2Eテスト (マイルストーンB)
- **フレームワーク**: Playwright
- **ブラウザ**: Chrome, Firefox, Safari
- **並列実行**: 可能

---

## 継続的インテグレーション (CI)

**GitHub Actions設定** (今後実装予定):
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
        working-directory: ./server
      - name: Run unit tests
        run: npm test
        working-directory: ./server
      - name: Run integration tests
        run: npm test tests/integration/
        working-directory: ./server
```

---

## デバッグ方法

### 統合テストのデバッグ

**ログ出力**:
- `socketHandler.ts` に `[DEBUG]`, `[INFO]`, `[ERROR]` プレフィックス付きログを追加済み
- テスト実行時に詳細なフローが確認できる

**重要なログポイント**:
1. アクション受信時: `[DEBUG] action received`
2. アクション実行前の状態: `[DEBUG] Before action - currentBettorId, isBettingComplete, isComplete`
3. アクション実行後の状態: `[DEBUG] After action - ...`
4. ターン通知送信: `[DEBUG] Emitting turnNotification to: ${playerId}`
5. ストリート移行: `[DEBUG] New street: ${state}`

**デバッグ手順**:
1. 統合テストを実行
2. コンソール出力から `[DEBUG]` ログを確認
3. 期待される動作と実際の動作を比較
4. 問題箇所を特定し、修正

**問題の切り分け**:
- ユニットテストが通る → Round クラス単体は正常
- 統合テストが失敗 → Socket.io通信またはイベントハンドリングに問題

---

## テストデータ

### 標準プレイヤーデータ
```typescript
const testPlayers: Player[] = [
  { id: 'p1', name: 'Alice', chips: 1000, seat: 0, connected: true, lastSeen: Date.now() },
  { id: 'p2', name: 'Bob', chips: 1000, seat: 1, connected: true, lastSeen: Date.now() },
  { id: 'p3', name: 'Charlie', chips: 1000, seat: 2, connected: true, lastSeen: Date.now() },
];
```

### ブラインド設定
- Small Blind: 10
- Big Blind: 20

---

## 既知の問題と今後のテスト追加

### 現在報告されている問題
> ユーザー報告: 「一番最初でcallしてもallinしても何しても、対戦相手のアクションが出てこない」

**調査方針**:
1. 統合テストを実行してログを確認
2. `turnNotification` イベントが正しく発火しているか検証
3. クライアント側でイベントを受信できているか確認
4. 問題箇所を特定して修正

### 追加予定のテストケース
1. オールインシナリオのテスト
2. 複数プレイヤーフォールドのテスト
3. サイドポット発生時のテスト
4. プレイヤー切断時の処理テスト
5. 同時アクション試行時のエラーハンドリングテスト

---

## テスト品質の指標

### カバレッジ目標
- **サーバーサイド**: 80%以上
- **クライアントサイド**: 70%以上 (マイルストーンB)

### テスト実行時間
- **ユニットテスト**: 10秒以内
- **統合テスト**: 1分以内
- **E2Eテスト**: 5分以内 (マイルストーンB)

### 成功基準
- 全テストがグリーン
- カバレッジ目標達成
- 重大なバグが本番環境で発生しない
