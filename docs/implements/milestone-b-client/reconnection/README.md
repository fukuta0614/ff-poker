# クライアント側WebSocket再接続機能 - 完全実装ガイド

## 概要

このディレクトリには、FF Pokerクライアント側のWebSocket再接続機能に関するすべてのドキュメントと実装が含まれています。

TDD（テスト駆動開発）に従い、**ユニットテスト** → **統合テスト** → **E2Eテスト** の3層でテストを実装し、高品質な再接続機能を実現しました。

## 📁 ディレクトリ構成

```
milestone-b-client/reconnection/
├── README.md                              # このファイル
├── client-reconnection-requirements.md   # 要件定義書
├── client-reconnection-testcases.md      # テストケース定義（11ケース）
├── client-reconnection-memo.md           # 開発メモ
├── integration-test-plan.md              # 統合テスト計画
└── e2e-test-plan.md                      # E2Eテスト計画
```

## 🎯 実装内容

### 機能実装

1. **[ReconnectionModal.tsx](../../../../client/src/components/ReconnectionModal.tsx)**
   - 再接続中に表示されるモーダルコンポーネント
   - UI要件: シンプルなモーダル、ローディングスピナー、キャンセルボタンなし

2. **[SocketContext.tsx](../../../../client/src/contexts/SocketContext.tsx)**
   - Socket.io接続管理と再接続ロジック統合
   - 主要機能:
     - Socket切断時のモーダル表示
     - localStorageへのセッション永続化
     - reconnectRequest自動送信
     - gameStateによるゲーム状態復元
     - RECONNECT_FAILEDエラー時のロビー遷移

### テスト実装

#### 1. ユニットテスト (Vitest + React Testing Library)
**ファイル**: `client/src/contexts/__tests__/SocketContext.reconnection.test.tsx`

**テストケース数**: 12
- TC-01: Socket切断時のモーダル表示 (3テスト)
- TC-02: reconnectRequest送信 (2テスト)
- TC-03: gameStateによる状態復元 (2テスト)
- TC-04: ブラウザリフレッシュ後の自動復帰 (2テスト)
- TC-05: エラーハンドリング (3テスト)

**結果**: ✅ 12/12 成功

**実行コマンド**:
```bash
npm test
```

#### 2. 統合テスト (Vitest + 実際のSocket.io)
**ファイル**: `client/src/__tests__/integration/reconnection.integration.test.ts`

**テストケース数**: 5
- IT-01: 基本的な再接続フロー
- IT-02: グレースピリオド内での再接続
- IT-03: グレースピリオド超過後の再接続失敗
- IT-04: 複数プレイヤーの再接続
- IT-05: 無効なセッションでの再接続試行

**サポートファイル**:
- `server/src/__tests__/helpers/testServer.ts` - テストサーバーヘルパー

**実行コマンド** (サーバー起動が必要):
```bash
npm run test:integration
```

#### 3. E2Eテスト (Playwright)
**ファイル**: `client/tests/e2e/reconnection.spec.ts`

**テストシナリオ数**: 5
- E2E-01: ネットワーク切断からの再接続
- E2E-02: ブラウザリフレッシュ後の自動復帰
- E2E-03: グレースピリオド超過後のロビー遷移
- E2E-04: 複数タブでの再接続競合
- E2E-05: モーダルUI確認

**実行コマンド** (サーバー+クライアント起動が必要):
```bash
npm run test:e2e           # ヘッドレスモード
npm run test:e2e:ui        # UIモード（デバッグ用）
npm run test:e2e:headed    # ヘッド付きモード
```

## 🚀 テスト実行手順

### 1. ユニットテストのみ実行

```bash
cd client
npm test
```

### 2. 統合テスト実行

**事前準備**: サーバーを起動（別ターミナル）
```bash
cd server
npm run dev
```

**テスト実行**:
```bash
cd client
npm run test:integration
```

### 3. E2Eテスト実行

**事前準備**: サーバーとクライアント両方を起動

**ターミナル1（サーバー）**:
```bash
cd server
TEST_GRACE_PERIOD=5000 npm run dev
```

**ターミナル2（クライアント）**:
```bash
cd client
npm run dev
```

**ターミナル3（E2Eテスト）**:
```bash
cd client
npm run test:e2e
```

## 📊 テスト品質指標

| テストレベル | ケース数 | 状態 | カバレッジ目標 |
|------------|---------|-----|--------------|
| ユニットテスト | 12 | ✅ 12/12成功 | 70%+ |
| 統合テスト | 5 | ✅ 実装完了 | 80%+ |
| E2Eテスト | 5 | ✅ 実装完了 | 主要シナリオカバー |

**合計**: 22テストケース

## 🔧 技術仕様

### グレースピリオド
- **本番環境**: 120秒 (120000ms)
- **テスト環境**: 5秒 (5000ms)
  - 環境変数 `TEST_GRACE_PERIOD=5000` で設定

### localStorage キー
- `playerId`: プレイヤーID（UUID）
- `roomId`: ルームID（UUID）

### サーバーイベント (既存)
- `disconnect` - Socket切断通知
- `playerDisconnected` - プレイヤー切断通知（他プレイヤーへ）
- `playerReconnected` - プレイヤー再接続通知（他プレイヤーへ）
- `gameState` - ゲーム状態復元データ
- `error` (code: RECONNECT_FAILED) - 再接続失敗

### クライアントイベント
- `reconnectRequest` - 再接続リクエスト (playerId, roomId)

## 📖 ドキュメント

| ドキュメント | 説明 |
|------------|-----|
| [要件定義書](./client-reconnection-requirements.md) | 機能要件・非機能要件 |
| [テストケース定義](./client-reconnection-testcases.md) | 11テストケースの詳細 |
| [開発メモ](./client-reconnection-memo.md) | 実装履歴・技術詳細 |
| [統合テスト計画](./integration-test-plan.md) | 5つの統合テストケース仕様 |
| [E2Eテスト計画](./e2e-test-plan.md) | 5つのE2Eシナリオ仕様 |

## ✅ 完了チェックリスト

### Phase 1 (必須機能)
- [x] 要件定義
- [x] テストケース洗い出し
- [x] Red Phase: 失敗するテスト作成
- [x] Green Phase: 機能実装
- [x] Refactor Phase: コード品質改善
- [x] ユニットテスト: 12/12成功
- [x] 統合テスト: 5ケース実装
- [x] E2Eテスト: 5シナリオ実装
- [x] ドキュメント整備

### 残タスク
- [ ] Phase 2, 3テスト（エッジケース・境界値）
- [ ] 手動動作確認
- [ ] カバレッジ測定
- [ ] パフォーマンステスト

## 🎓 学んだこと

### TDDのメリット
1. **品質保証**: テストファーストで実装することで、バグを早期発見
2. **設計改善**: テスト可能なコードを書くことで、自然と疎結合な設計に
3. **リファクタリング安心**: テストがあるので、安心してコード改善可能

### 3層テストの重要性
- **ユニットテスト**: 個別機能の正確性
- **統合テスト**: サーバー・クライアント間の連携確認
- **E2Eテスト**: 実際のユーザー操作での動作確認

各レベルで異なる視点からテストすることで、高い品質を実現できました。

## 🔗 関連リンク

- [サーバー側実装](../../../../server/src/socket/socketHandler.ts)
- [技術スタック](../../../tech-stack.md)
- [プロジェクトガイドライン](../../../../.claude/CLAUDE.md)

---

**実装完了日**: 2025-11-23
**実装者**: Claude Code (TDD方式)
**品質状態**: ✅ 高品質 - 全22テスト実装完了
