# FF Poker Server v2 - テストシナリオ一覧

**作成日**: 2025-12-02
**最終更新**: 2025-12-02
**テスト総数**: 73
**合格率**: 100% (73/73)

---

## 📋 目次

1. [ユニットテスト](#ユニットテスト)
   - [GameManager](#gamemanager-ユニットテスト)
   - [GameService](#gameservice-ユニットテスト)
2. [統合テスト](#統合テスト)
   - [基本フローテスト（3人プレイヤー）](#基本フローテスト3人プレイヤー)
   - [ヘッズアップテスト（2人プレイヤー）](#ヘッズアップテスト2人プレイヤー)

---

## ユニットテスト

### GameManager ユニットテスト
**ファイル**: `tests/managers/GameManager.test.ts`
**テスト数**: 17

#### ルーム管理
| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | should create a new room with default settings | デフォルト設定でルーム作成 |
| 2 | should create a room with custom blinds | カスタムブラインド設定 |
| 3 | should get room by ID | ルームID検索 |
| 4 | should return undefined for non-existent room | 存在しないルームの検索 |
| 5 | should delete a room | ルーム削除 |

#### プレイヤー管理
| # | テストケース | 検証内容 |
|---|------------|---------|
| 6 | should add player to room | プレイヤー追加 |
| 7 | should prevent duplicate player names in same room | 重複名の防止 |
| 8 | should remove player from room | プレイヤー削除 |
| 9 | should handle removing non-existent player | 存在しないプレイヤーの削除 |
| 10 | should enforce maximum player limit | 最大プレイヤー数の制限 |

#### ゲーム状態管理
| # | テストケース | 検証内容 |
|---|------------|---------|
| 11 | should set game state for room | ゲーム状態の設定 |
| 12 | should get game state for room | ゲーム状態の取得 |
| 13 | should return undefined for room without game state | ゲーム未開始時の状態取得 |
| 14 | should update room state to playing when game starts | ゲーム開始時のルーム状態更新 |

#### エラーハンドリング
| # | テストケース | 検証内容 |
|---|------------|---------|
| 15 | should handle adding player to non-existent room | 存在しないルームへの追加 |
| 16 | should handle removing player from non-existent room | 存在しないルームからの削除 |
| 17 | should handle setting game state for non-existent room | 存在しないルームへの状態設定 |

---

### GameService ユニットテスト
**ファイル**: `tests/services/GameService.test.ts`
**テスト数**: 10

#### ゲーム開始
| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | should start a game successfully | 正常なゲーム開始 |
| 2 | should fail to start game with insufficient players | プレイヤー不足時のエラー |
| 3 | should fail to start game for non-existent room | 存在しないルームでの開始エラー |

#### アクション実行
| # | テストケース | 検証内容 |
|---|------------|---------|
| 4 | should execute player action successfully | アクションの実行 |
| 5 | should fail to execute action for non-existent room | 存在しないルームでのアクション |
| 6 | should fail to execute action without game state | ゲーム未開始時のアクション |

#### ゲーム状態取得
| # | テストケース | 検証内容 |
|---|------------|---------|
| 7 | should get game state for player | プレイヤー視点の状態取得 |
| 8 | should filter opponent hands in game state | 相手の手札フィルタリング |
| 9 | should fail to get state for non-existent room | 存在しないルームの状態取得 |
| 10 | should fail to get state without game state | ゲーム未開始時の状態取得 |

---

## 統合テスト

### 基本フローテスト（3人プレイヤー）
**ファイル**: `tests/integration/api-game-flow.test.ts`
**テスト数**: 13

#### ルーム作成とプレイヤー参加
| # | テストケース | エンドポイント | 検証内容 |
|---|------------|--------------|---------|
| 1 | should create a new room | POST /api/v1/rooms | ルーム作成 |
| 2 | should get room information | GET /api/v1/rooms/:roomId | ルーム情報取得 |
| 3 | should allow player to join room | POST /api/v1/rooms/:roomId/join | プレイヤー参加（2人目） |
| 4 | should allow third player to join | POST /api/v1/rooms/:roomId/join | プレイヤー参加（3人目） |
| 5 | should return 404 for non-existent room | GET /api/v1/rooms/:roomId | 存在しないルームの検索 |
| 6 | should return 400 for invalid room creation | POST /api/v1/rooms | 無効なルーム作成 |

#### ゲーム開始
| # | テストケース | エンドポイント | 検証内容 |
|---|------------|--------------|---------|
| 7 | should start the game | POST /api/v1/rooms/:roomId/start | ゲーム開始 |
| 8 | should return game state for a player | GET /api/v1/rooms/:roomId/state | プレイヤー視点の状態取得 |
| 9 | should not start game with insufficient players | POST /api/v1/rooms/:roomId/start | プレイヤー不足時のエラー |

#### プレイヤーアクション
| # | テストケース | エンドポイント | 検証内容 |
|---|------------|--------------|---------|
| 10 | should execute a call action | POST /api/v1/rooms/:roomId/actions | コールアクション |
| 11 | should reject action from wrong player | POST /api/v1/rooms/:roomId/actions | 不正なターンの検証 |
| 12 | should reject invalid action type | POST /api/v1/rooms/:roomId/actions | 無効なアクションタイプ |

#### フルゲームシナリオ
| # | テストケース | 検証内容 |
|---|------------|---------|
| 13 | should play through multiple actions | 複数アクションの連続実行、ゲーム進行確認 |

---

### ヘッズアップテスト（2人プレイヤー）
**ファイル**: `tests/integration/api-game-flow-heads-up.test.ts`
**テスト数**: 33

#### 基本フロー
| # | テストケース | 検証内容 |
|---|------------|---------|
| 1 | should create room and have 2 players join | 2人ルーム作成と参加 |
| 2 | should start game with correct SB/BB placement | SB/BB配置の正確性 |
| 3 | should have SB act first preflop | プリフロップでのSB先行 |

#### アクションパターン - フォールド
| # | テストケース | 検証内容 |
|---|------------|---------|
| 4 | should end game immediately when one player folds preflop | フォールドによる即座のゲーム終了 |

#### アクションパターン - チェック/チェック
| # | テストケース | 検証内容 |
|---|------------|---------|
| 5 | should progress stage when both players check | 両者チェックでのステージ進行 |

#### アクションパターン - レイズ/コール
| # | テストケース | 検証内容 |
|---|------------|---------|
| 6 | should progress stage after raise and call | レイズ→コールでのステージ進行 |

#### アクションパターン - オールイン
| # | テストケース | 検証内容 |
|---|------------|---------|
| 7 | should handle all-in and call | オールイン→コール |
| 8 | should end game when opponent folds to all-in | オールイン→フォールド |

#### フルゲーム進行
| # | テストケース | 検証内容 |
|---|------------|---------|
| 9 | should play through all stages to showdown | 全ステージ（preflop→flop→turn→river→showdown）通過 |

#### エッジケース
| # | テストケース | 検証内容 |
|---|------------|---------|
| 10 | should handle preflop all-in from both players | プリフロップ両者オールイン |

#### 複数ラウンド
| # | テストケース | 検証内容 |
|---|------------|---------|
| 11 | should handle dealer button rotation across multiple rounds | ディーラーボタンの管理と新ラウンド開始 |

#### 複雑なシナリオ - リレイズの応酬
| # | テストケース | 検証内容 |
|---|------------|---------|
| 12 | should handle multiple re-raises (raise/raise/raise/call) | raise → raise → raise → call の連続 |

#### 複雑なシナリオ - 異なるチップ量
| # | テストケース | 検証内容 |
|---|------------|---------|
| 13 | should handle all-in with different chip amounts | 不均等なチップ量でのオールイン |

#### 複雑なシナリオ - サイドポット
| # | テストケース | 検証内容 |
|---|------------|---------|
| 14 | should create proper side pots with all-in scenarios | サイドポット処理の検証 |

#### 複雑なシナリオ - 最小ベット
| # | テストケース | 検証内容 |
|---|------------|---------|
| 15 | should enforce minimum raise amounts | 最小レイズ額の強制 |

#### 複雑なシナリオ - 連続プレイ
| # | テストケース | 検証内容 |
|---|------------|---------|
| 16 | should handle continuous check-downs through all streets | 全ストリート連続チェックダウン |

#### ステージ別テスト - フロップ
| # | テストケース | 検証内容 |
|---|------------|---------|
| 17 | should handle bet on flop and call | フロップでベット→コール→ターン進行 |
| 18 | should handle check-raise on flop | フロップでチェックレイズ |
| 19 | should handle fold on flop after bet | フロップでベット→フォールド |

#### ステージ別テスト - ターン
| # | テストケース | 検証内容 |
|---|------------|---------|
| 20 | should handle bet on turn and fold | ターンでベット→フォールド |
| 21 | should handle pot-sized bet on turn | ターンでポットサイズベット |

#### ステージ別テスト - リバー
| # | テストケース | 検証内容 |
|---|------------|---------|
| 22 | should reach river and handle final betting | リバー到達とファイナルベッティング |
| 23 | should handle all-in on river | リバーでオールイン |

#### ベット制限とバリデーション
| # | テストケース | 検証内容 |
|---|------------|---------|
| 24 | should reject bet amount below minimum | 最小額以下のベット拒否 |
| 25 | should handle bet amount exceeding chips (auto all-in) | チップ超過時の自動オールイン |
| 26 | should validate bet increments | ベット増分の検証 |

#### エラーハンドリング - 無効なアクション
| # | テストケース | 検証内容 |
|---|------------|---------|
| 27 | should reject action from non-existent player | 存在しないプレイヤーのアクション拒否 |
| 28 | should reject check when bet is required | ベットが必要な時のチェック拒否 |
| 29 | should reject negative bet amount | 負のベット額の拒否 |

#### チップスタック管理
| # | テストケース | 検証内容 |
|---|------------|---------|
| 30 | should track chip changes across multiple actions | 複数アクション間のチップ変化追跡 |
| 31 | should handle player with low chips (short stack) | 少ないチップのプレイヤー処理 |

#### 複数ベッティングラウンド
| # | テストケース | 検証内容 |
|---|------------|---------|
| 32 | should handle aggressive betting on every street | 全ストリートでのアグレッシブベッティング |

#### ショーダウンシナリオ
| # | テストケース | 検証内容 |
|---|------------|---------|
| 33 | should reach showdown with both players having cards | ショーダウン到達と手札確認 |

---

## 📊 カバレッジ概要

### テストカテゴリー別
| カテゴリー | テスト数 | 合格率 |
|----------|--------|-------|
| ユニットテスト - GameManager | 17 | 100% |
| ユニットテスト - GameService | 10 | 100% |
| 統合テスト - 基本フロー | 13 | 100% |
| 統合テスト - ヘッズアップ | 33 | 100% |
| **合計** | **73** | **100%** |

### 機能カバレッジ
| 機能 | 実装状況 | テスト状況 |
|-----|--------|----------|
| ルーム管理（作成/取得/削除） | ✅ | ✅ 完全カバー |
| プレイヤー管理（追加/削除） | ✅ | ✅ 完全カバー |
| ゲーム開始 | ✅ | ✅ 完全カバー |
| プレイヤーアクション（fold/check/call/raise/allin） | ✅ | ✅ 完全カバー |
| ステージ進行（preflop→flop→turn→river→showdown） | ✅ | ✅ 完全カバー（各ステージ個別テスト含む） |
| ポット管理 | ✅ | ✅ 完全カバー（ポットサイズベット含む） |
| サイドポット | ✅ | ✅ 完全カバー |
| ディーラーボタン管理 | ✅ | ✅ 完全カバー |
| エラーハンドリング | ✅ | ✅ 完全カバー（無効アクション、境界値テスト） |
| ベット制限とバリデーション | ✅ | ✅ 完全カバー（最小/最大額、増分検証） |
| チップスタック管理 | ✅ | ✅ 完全カバー（ショートスタック、チップ追跡） |
| 複雑なベッティングパターン | ✅ | ✅ 完全カバー（リレイズ、チェックレイズ、連続ベット） |

---

## 🧪 テスト実行方法

### 全テスト実行
```bash
cd server-v2
npm test
```

### 特定のテストスイート実行
```bash
# GameManagerテスト
npm test -- --testPathPattern="GameManager"

# GameServiceテスト
npm test -- --testPathPattern="GameService"

# 統合テスト（3人プレイヤー）
npm test -- --testPathPattern="api-game-flow.test"

# ヘッズアップテスト
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
- **スコープ**: GameManager, GameService
- **モック**: なし（純粋な単体テスト）
- **カバレッジ目標**: 90%以上

### 統合テスト
- **目的**: REST APIエンドポイントの動作を検証
- **スコープ**: HTTPリクエスト/レスポンス、フルゲームフロー
- **ツール**: supertest
- **カバレッジ目標**: 主要シナリオ100%

### テストピラミッド
```
       /\
      /E2\     <- 将来実装（Playwright）
     /----\
    / 統合 \   <- 46テスト（現在実装済み）
   /--------\
  / ユニット \  <- 27テスト（現在実装済み）
 /----------\
```

---

## 📝 テスト追加ガイドライン

### 新しいテストケースを追加する場合

1. **ファイル配置**
   - ユニットテスト: `tests/managers/` または `tests/services/`
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

### Phase 4: WebSocket通知テスト
- [ ] リアルタイム通知の送受信
- [ ] 複数クライアントへの同時通知
- [ ] 接続/切断の処理
- [ ] 再接続ロジック

### Phase 6: E2Eテスト
- [ ] ブラウザ操作テスト（Playwright）
- [ ] マルチプレイヤーシナリオ
- [ ] UI/UX フローテスト

### 追加の統合テスト
- [ ] タイムアウト処理
- [ ] 大量データ処理（100人同時接続）
- [ ] 不正データ送信のセキュリティテスト
- [ ] レート制限テスト

---

## 📚 関連ドキュメント

- [HANDOVER.md](./HANDOVER.md) - プロジェクト引き継ぎドキュメント
- [README.md](./README.md) - プロジェクト概要
- [../docs/migration/server-v2-migration-openapi.md](../docs/migration/server-v2-migration-openapi.md) - マイグレーション計画書
- [../server/src/engine/README.md](../server/src/engine/README.md) - エンジン仕様書

---

## 📈 テスト拡充履歴

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
**最終更新**: 2025-12-02
**メンテナ**: Claude Code
