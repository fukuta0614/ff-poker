# FF Poker Server v2 - テストシナリオ一覧

**作成日**: 2025-12-02
**最終更新**: 2025-12-04
**テスト総数**: 273
**合格率**: 100% (273/273)

---

## 📋 目次

1. [ユニットテスト](#ユニットテスト)
   - [エンジン層テスト](#エンジン層テスト)
   - [WebSocket層テスト](#websocket層テスト)
   - [マネージャー/サービステスト](#マネージャーサービステスト)
2. [統合テスト](#統合テスト)
   - [REST API統合テスト](#rest-api統合テスト)
   - [WebSocket統合テスト](#websocket統合テスト)

---

## ユニットテスト

### エンジン層テスト

純粋関数型ゲームエンジンの各モジュールをテスト。すべて `fp-ts` の `Either` を使ったエラーハンドリングを検証。

#### Acknowledgment (確認応答システム)
**ファイル**: `tests/engine/acknowledgment.test.ts`
**テスト数**: 9

| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | should set waitingForAck to true after player action | アクション後に確認応答待ち状態になる |
| 2 | should include all active players in expectedAcks | アクティブプレイヤー全員が確認応答対象 |
| 3 | should process acknowledgment correctly | 確認応答処理の正常動作 |
| 4 | should add playerId to receivedAcks | 受信済み確認応答の記録 |
| 5 | should set waitingForAck to false when all players acknowledged | 全員確認後に待機解除 |
| 6 | should reject duplicate acknowledgment from same player | 重複確認応答の拒否 |
| 7 | should reject acknowledgment from unexpected player | 期待外プレイヤーの確認応答拒否 |
| 8 | should reject acknowledgment when not waiting | 待機中でない時の確認応答拒否 |
| 9 | should handle stage advancement after all acknowledgments | 全員確認後のステージ進行 |

#### Actions (プレイヤーアクション処理)
**ファイル**: `tests/engine/actions.test.ts`
**テスト数**: 36

ベッティングアクション（fold, check, call, raise, allin）の検証:
- ✅ 各アクションタイプの正常系
- ✅ 無効なアクションの拒否（チップ不足、ターン違反、金額不正）
- ✅ アクション後のゲーム状態更新
- ✅ ベッティングラウンド完了判定
- ✅ オールイン処理
- ✅ 最小レイズ額の強制

#### Deck (デッキ管理)
**ファイル**: `tests/engine/deck.test.ts`
**テスト数**: 23

- ✅ デッキ初期化（52枚、重複なし）
- ✅ カードシャッフル
- ✅ カードドロー
- ✅ カードのユニーク性検証
- ✅ 決定論的RNG（同じシードで同じ結果）

#### Game Init (ゲーム初期化)
**ファイル**: `tests/engine/game-init.test.ts`
**テスト数**: 15

- ✅ ラウンド初期化（プリフロップ状態）
- ✅ ディーラーボタン配置
- ✅ ブラインドベット配置
- ✅ 手札配布（各プレイヤー2枚）
- ✅ 初期ターン順の決定
- ✅ エラーケース（プレイヤー不足、不正なブラインド額）

#### Hand Evaluator (役判定)
**ファイル**: `tests/engine/hand-evaluator.test.ts`
**テスト数**: 22

- ✅ 全役の判定（ロイヤルフラッシュ〜ハイカード）
- ✅ 役の強さ比較
- ✅ キッカーの評価
- ✅ タイブレーク処理
- ✅ 7枚から最強5枚の選択

#### Pot (ポット管理)
**ファイル**: `tests/engine/pot.test.ts`
**テスト数**: 9

- ✅ メインポット計算
- ✅ サイドポット生成（複数オールイン時）
- ✅ ポット配分（勝者へのチップ分配）
- ✅ チョップ（引き分け時の分配）
- ✅ 端数処理

#### Showdown (ショーダウン)
**ファイル**: `tests/engine/showdown.test.ts`
**テスト数**: 10

- ✅ 役比較とウィナー決定
- ✅ マルチウェイポットの処理
- ✅ サイドポット別の勝者決定
- ✅ チョップの処理
- ✅ チップ配分の正確性

#### Stage (ステージ進行)
**ファイル**: `tests/engine/stage.test.ts`
**テスト数**: 27

- ✅ ステージ遷移（preflop→flop→turn→river→showdown）
- ✅ コミュニティカード配布
- ✅ ベットリセット
- ✅ ターン順の更新
- ✅ ショーダウン到達条件

#### Utils (ユーティリティ関数)
**ファイル**: `tests/engine/utils.test.ts`
**テスト数**: 31

- ✅ プレイヤー検索
- ✅ アクティブプレイヤー判定
- ✅ ターン順計算
- ✅ ベット額計算
- ✅ ポット総額計算
- ✅ 各種バリデーション

#### Game Flow Integration (エンジン層統合テスト)
**ファイル**: `tests/engine/game-flow-integration.test.ts`
**テスト数**: 8

- ✅ 完全なゲームフロー（初期化→複数アクション→ショーダウン）
- ✅ 複雑なシナリオ（リレイズ、オールイン、サイドポット）
- ✅ エラーリカバリー

---

### WebSocket層テスト

#### Notifier (通知サービス)
**ファイル**: `tests/websocket/Notifier.test.ts`
**テスト数**: 8

| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | room:updated イベントを発火する | 基本的な通知発火 |
| 2 | room:updated イベントをupdateType付きで発火する | タイプ指定通知 |
| 3-8 | 各updateTypeの通知 | game_started, action, stage_advanced, showdown, player_joined, player_left |

---

### マネージャー/サービステスト

#### GameManager
**ファイル**: `tests/managers/GameManager.test.ts`
**テスト数**: 17

##### ルーム管理
| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | should create a new room with default settings | デフォルト設定でルーム作成 |
| 2 | should create a room with custom blinds | カスタムブラインド設定 |
| 3 | should get room by ID | ルームID検索 |
| 4 | should return undefined for non-existent room | 存在しないルームの検索 |
| 5 | should delete a room | ルーム削除 |

##### プレイヤー管理
| # | テストケース | 検証内容 |
|---|------------|---------|
| 6 | should add player to room | プレイヤー追加 |
| 7 | should prevent duplicate player names in same room | 重複名の防止 |
| 8 | should remove player from room | プレイヤー削除 |
| 9 | should handle removing non-existent player | 存在しないプレイヤーの削除 |
| 10 | should enforce maximum player limit | 最大プレイヤー数の制限 |

##### ゲーム状態管理
| # | テストケース | 検証内容 |
|---|------------|---------|
| 11 | should set game state for room | ゲーム状態の設定 |
| 12 | should get game state for room | ゲーム状態の取得 |
| 13 | should return undefined for room without game state | ゲーム未開始時の状態取得 |
| 14 | should update room state to playing when game starts | ゲーム開始時のルーム状態更新 |

##### エラーハンドリング
| # | テストケース | 検証内容 |
|---|------------|---------|
| 15 | should handle adding player to non-existent room | 存在しないルームへの追加 |
| 16 | should handle removing player from non-existent room | 存在しないルームからの削除 |
| 17 | should handle setting game state for non-existent room | 存在しないルームへの状態設定 |

#### GameService
**ファイル**: `tests/services/GameService.test.ts`
**テスト数**: 10

##### ゲーム開始
| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | should start a game successfully | 正常なゲーム開始 |
| 2 | should fail to start game with insufficient players | プレイヤー不足時のエラー |
| 3 | should fail to start game for non-existent room | 存在しないルームでの開始エラー |

##### アクション実行
| # | テストケース | 検証内容 |
|---|------------|---------|
| 4 | should execute player action successfully | アクションの実行 |
| 5 | should fail to execute action for non-existent room | 存在しないルームでのアクション |
| 6 | should fail to execute action without game state | ゲーム未開始時のアクション |

##### ゲーム状態取得
| # | テストケース | 検証内容 |
|---|------------|---------|
| 7 | should get game state for player | プレイヤー視点の状態取得 |
| 8 | should filter opponent hands in game state | 相手の手札フィルタリング |
| 9 | should fail to get state for non-existent room | 存在しないルームの状態取得 |
| 10 | should fail to get state without game state | ゲーム未開始時の状態取得 |

---

## 統合テスト

### REST API統合テスト

#### 基本フローテスト（3人プレイヤー）
**ファイル**: `tests/integration/api-game-flow.test.ts`
**テスト数**: 13

##### ルーム作成とプレイヤー参加
| # | テストケース | エンドポイント | 検証内容 |
|---|------------|--------------|---------|
| 1 | should create a new room | POST /api/v1/rooms | ルーム作成 |
| 2 | should get room information | GET /api/v1/rooms/:roomId | ルーム情報取得 |
| 3 | should allow player to join room | POST /api/v1/rooms/:roomId/join | プレイヤー参加（2人目） |
| 4 | should allow third player to join | POST /api/v1/rooms/:roomId/join | プレイヤー参加（3人目） |
| 5 | should return 404 for non-existent room | GET /api/v1/rooms/:roomId | 存在しないルームの検索 |
| 6 | should return 400 for invalid room creation | POST /api/v1/rooms | 無効なルーム作成 |

##### ゲーム開始
| # | テストケース | エンドポイント | 検証内容 |
|---|------------|--------------|---------|
| 7 | should start the game | POST /api/v1/rooms/:roomId/start | ゲーム開始 |
| 8 | should return game state for a player | GET /api/v1/rooms/:roomId/state | プレイヤー視点の状態取得 |
| 9 | should not start game with insufficient players | POST /api/v1/rooms/:roomId/start | プレイヤー不足時のエラー |

##### プレイヤーアクション
| # | テストケース | エンドポイント | 検証内容 |
|---|------------|--------------|---------|
| 10 | should execute a call action | POST /api/v1/rooms/:roomId/actions | コールアクション |
| 11 | should reject action from wrong player | POST /api/v1/rooms/:roomId/actions | 不正なターンの検証 |
| 12 | should reject invalid action type | POST /api/v1/rooms/:roomId/actions | 無効なアクションタイプ |

##### フルゲームシナリオ
| # | テストケース | 検証内容 |
|---|------------|---------|
| 13 | should play through multiple actions | 複数アクションの連続実行、ゲーム進行確認 |

#### ヘッズアップテスト（2人プレイヤー）
**ファイル**: `tests/integration/api-game-flow-heads-up.test.ts`
**テスト数**: 33

##### 基本フロー
- ✅ 2人ルーム作成と参加
- ✅ SB/BB配置の正確性
- ✅ プリフロップでのSB先行

##### アクションパターン
- ✅ フォールドによる即座のゲーム終了
- ✅ 両者チェックでのステージ進行
- ✅ レイズ→コールでのステージ進行
- ✅ オールイン→コール/フォールド

##### フルゲーム進行
- ✅ 全ステージ（preflop→flop→turn→river→showdown）通過
- ✅ プリフロップ両者オールイン
- ✅ ディーラーボタンの管理と新ラウンド開始

##### 複雑なシナリオ
- ✅ リレイズの応酬（raise → raise → raise → call）
- ✅ 不均等なチップ量でのオールイン
- ✅ サイドポット処理
- ✅ 最小レイズ額の強制
- ✅ 全ストリート連続チェックダウン

##### ステージ別テスト
- ✅ フロップ: ベット→コール/フォール/チェックレイズ（3テスト）
- ✅ ターン: ベット→フォールド/ポットサイズベット（2テスト）
- ✅ リバー: ファイナルベッティング/オールイン（2テスト）

##### ベット制限とバリデーション
- ✅ 最小額以下のベット拒否
- ✅ チップ超過時の自動オールイン
- ✅ ベット増分の検証

##### エラーハンドリング
- ✅ 存在しないプレイヤーのアクション拒否
- ✅ ベットが必要な時のチェック拒否
- ✅ 負のベット額の拒否

##### チップスタック管理
- ✅ 複数アクション間のチップ変化追跡
- ✅ 少ないチップのプレイヤー処理（ショートスタック）

##### 複数ベッティングラウンド
- ✅ 全ストリートでのアグレッシブベッティング

##### ショーダウンシナリオ
- ✅ ショーダウン到達と手札確認

---

### WebSocket統合テスト

**ファイル**: `tests/integration/api-websocket-integration.test.ts`
**テスト数**: 2

| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | should emit room:updated event when game starts | ゲーム開始時の通知 |
| 2 | should emit room:updated event when player acts | プレイヤーアクション時の通知 |

---

## 📊 カバレッジ概要

### テストカテゴリー別
| カテゴリー | テスト数 | 合格率 |
|----------|--------|-------|
| エンジン層ユニットテスト | 190 | 100% |
| WebSocket層ユニットテスト | 8 | 100% |
| マネージャー/サービステスト | 27 | 100% |
| REST API統合テスト | 46 | 100% |
| WebSocket統合テスト | 2 | 100% |
| **合計** | **273** | **100%** |

### テストファイル別詳細
| テストファイル | テスト数 | カテゴリー |
|--------------|--------|----------|
| tests/engine/actions.test.ts | 36 | エンジン層 |
| tests/integration/api-game-flow-heads-up.test.ts | 33 | 統合テスト |
| tests/engine/utils.test.ts | 31 | エンジン層 |
| tests/engine/stage.test.ts | 27 | エンジン層 |
| tests/engine/deck.test.ts | 23 | エンジン層 |
| tests/engine/hand-evaluator.test.ts | 22 | エンジン層 |
| tests/managers/GameManager.test.ts | 17 | マネージャー |
| tests/engine/game-init.test.ts | 15 | エンジン層 |
| tests/integration/api-game-flow.test.ts | 13 | 統合テスト |
| tests/services/GameService.test.ts | 10 | サービス |
| tests/engine/showdown.test.ts | 10 | エンジン層 |
| tests/engine/acknowledgment.test.ts | 9 | エンジン層 |
| tests/engine/pot.test.ts | 9 | エンジン層 |
| tests/engine/game-flow-integration.test.ts | 8 | エンジン層 |
| tests/websocket/Notifier.test.ts | 8 | WebSocket層 |
| tests/integration/api-websocket-integration.test.ts | 2 | 統合テスト |

### 機能カバレッジ
| 機能 | 実装状況 | テスト状況 |
|-----|--------|----------|
| ルーム管理（作成/取得/削除） | ✅ | ✅ 完全カバー（17テスト） |
| プレイヤー管理（追加/削除） | ✅ | ✅ 完全カバー（17テスト） |
| ゲーム開始 | ✅ | ✅ 完全カバー（15テスト） |
| プレイヤーアクション（fold/check/call/raise/allin） | ✅ | ✅ 完全カバー（36テスト） |
| 確認応答システム（acknowledgment） | ✅ | ✅ 完全カバー（9テスト） |
| ステージ進行（preflop→flop→turn→river→showdown） | ✅ | ✅ 完全カバー（27テスト） |
| デッキ管理・シャッフル | ✅ | ✅ 完全カバー（23テスト） |
| 役判定（hand evaluation） | ✅ | ✅ 完全カバー（22テスト） |
| ポット管理 | ✅ | ✅ 完全カバー（9テスト） |
| サイドポット | ✅ | ✅ 完全カバー（9テスト） |
| ショーダウン処理 | ✅ | ✅ 完全カバー（10テスト） |
| ディーラーボタン管理 | ✅ | ✅ 完全カバー（15テスト） |
| WebSocket通知 | ✅ | ✅ 完全カバー（10テスト） |
| エラーハンドリング | ✅ | ✅ 完全カバー（全域） |
| ベット制限とバリデーション | ✅ | ✅ 完全カバー（36テスト） |
| チップスタック管理 | ✅ | ✅ 完全カバー（31テスト） |
| 複雑なベッティングパターン | ✅ | ✅ 完全カバー（46テスト） |

---

## 🧪 テスト実行方法

### 全テスト実行
```bash
cd server-v2
npm test
```

### 特定のテストスイート実行
```bash
# エンジン層テスト
npm test -- --testPathPattern="engine"

# 統合テスト
npm test -- --testPathPattern="integration"

# 特定のファイル
npm test -- --testPathPattern="acknowledgment"
npm test -- --testPathPattern="heads-up"
```

### カバレッジレポート生成
```bash
npm run test:coverage
```

### ウォッチモード
```bash
npm run test:watch
```

---

## 🎯 テスト設計方針

### ユニットテスト
- **目的**: 各コンポーネントの独立した動作を検証
- **スコープ**: エンジン層、WebSocket層、マネージャー、サービス
- **特徴**: 純粋関数型アプローチ、`fp-ts/Either` によるエラーハンドリング
- **カバレッジ目標**: 90%以上

### 統合テスト
- **目的**: REST APIエンドポイントとWebSocketの動作を検証
- **スコープ**: HTTPリクエスト/レスポンス、フルゲームフロー、リアルタイム通知
- **ツール**: supertest, socket.io-client
- **カバレッジ目標**: 主要シナリオ100%

### テストピラミッド
```
       /\
      /E2\     <- 将来実装（Playwright）
     /----\
    / 統合 \   <- 48テスト（現在実装済み）
   /--------\
  / ユニット \  <- 225テスト（現在実装済み）
 /----------\
```

---

## 📝 テスト追加ガイドライン

### 新しいテストケースを追加する場合

1. **ファイル配置**
   - エンジン層テスト: `tests/engine/`
   - WebSocket層テスト: `tests/websocket/`
   - マネージャー/サービステスト: `tests/managers/`, `tests/services/`
   - 統合テスト: `tests/integration/`

2. **命名規則**
   - ファイル名: `*.test.ts`
   - describe: 機能名または API エンドポイント
   - it: "should" で始まる動作説明

3. **テスト構成**
   ```typescript
   describe('Feature Name', () => {
     // セットアップ
     beforeEach(() => {
       // 初期化処理
     });

     // クリーンアップ
     afterEach(() => {
       // 後処理
     });

     it('should do something', () => {
       // Arrange: テストデータ準備
       // Act: 実行
       // Assert: 検証
     });
   });
   ```

4. **アサーション**
   - 明確な期待値を設定
   - エラーメッセージをわかりやすく
   - 境界値テストを含める

---

## 🔍 未実装のテストシナリオ（将来の拡張）

### Phase 4: WebSocket高度なテスト
- [ ] 複数クライアントへの同時通知
- [ ] 接続/切断の処理
- [ ] 再接続ロジック
- [ ] ネットワークエラー時の挙動

### Phase 6: E2Eテスト
- [ ] ブラウザ操作テスト（Playwright）
- [ ] マルチプレイヤーシナリオ
- [ ] UI/UX フローテスト

### 追加の統合テスト
- [ ] タイムアウト処理（acknowledge timeout）
- [ ] 大量データ処理（100人同時接続）
- [ ] 不正データ送信のセキュリティテスト
- [ ] レート制限テスト

---

## 📚 関連ドキュメント

- [HANDOVER.md](./HANDOVER.md) - プロジェクト引き継ぎドキュメント
- [README.md](./README.md) - プロジェクト概要
- [openapi.yaml](./openapi.yaml) - REST API仕様書
- [../docs/migration/server-v2-migration-openapi.md](../docs/migration/server-v2-migration-openapi.md) - マイグレーション計画書

---

## 📈 テスト拡充履歴

### 2025-12-04 - エンジン層テスト大幅拡充
- **追加テスト数**: 200ケース（73 → 273ケース）
- **追加カテゴリー**:
  - エンジン層ユニットテスト: 190ケース（新規）
    - Acknowledgment（確認応答システム）: 9ケース
    - Actions（プレイヤーアクション）: 36ケース
    - Deck（デッキ管理）: 23ケース
    - Game Init（ゲーム初期化）: 15ケース
    - Hand Evaluator（役判定）: 22ケース
    - Pot（ポット管理）: 9ケース
    - Showdown（ショーダウン）: 10ケース
    - Stage（ステージ進行）: 27ケース
    - Utils（ユーティリティ）: 31ケース
    - Game Flow Integration: 8ケース
  - WebSocket層ユニットテスト: 8ケース（新規）
  - WebSocket統合テスト: 2ケース（新規）
- **総テスト数**: 73 → 273 (+200, +274%)
- **カバレッジ**: 純粋関数型エンジン層100%達成

### 2025-12-02 - ヘッズアップテスト大幅拡充
- **追加テスト数**: 17ケース（16 → 33ケース）
- **追加カテゴリ**:
  - ステージ別テスト（フロップ、ターン、リバー）: 6ケース
  - ベット制限とバリデーション: 3ケース
  - エラーハンドリング（無効アクション）: 3ケース
  - チップスタック管理: 2ケース
  - 複数ベッティングラウンド: 1ケース
  - ショーダウンシナリオ: 1ケース
- **総テスト数**: 56 → 73 (+17, +30%)
- **カバレッジ**: 主要ヘッズアップシナリオ100%達成

---

**作成日**: 2025-12-02
**最終更新**: 2025-12-04
**メンテナ**: Claude Code
