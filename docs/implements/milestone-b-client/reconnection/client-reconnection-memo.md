# クライアント側再接続機能 - 開発メモ

## 開発日時
- 開始: 2025-11-23
- 最終更新: 2025-11-23

## 概要
クライアント側のWebSocket再接続機能をTDDで実装する。サーバー側は既に実装済み（SessionManager、120秒のグレースピリオド）。

## TDD進捗

### Red Phase (テスト実装) ✅ 完了

#### 実装したテストファイル
- `client/src/contexts/__tests__/SocketContext.reconnection.test.tsx`

#### テスト環境セットアップ
- **テストフレームワーク**: Vitest 3.2.4
- **React テストライブラリ**: @testing-library/react 16.3.0
- **DOM マッチャー**: @testing-library/jest-dom 6.9.1
- **環境**: jsdom 27.0.1

#### セットアップファイル
1. `client/vitest.config.ts` - Vitest設定
2. `client/src/test/setup.ts` - テスト共通設定
3. `client/package.json` - テストスクリプト追加
   - `npm test` - 対話モード
   - `npm run test:ui` - UIモード
   - `npm run test:coverage` - カバレッジ測定

#### 実装したテストケース (Phase 1)

**TC-01: Socket切断時に再接続モーダルが表示される** (3テスト)
- ✅ disconnect イベント発生時に「再接続中...」モーダルが表示される
- ✅ モーダルにローディングスピナーが表示される
- ✅ モーダルにキャンセルボタンが表示されない

**TC-02: reconnectRequestの送信** (2テスト)
- ❌ localStorageにplayerIdとroomIdが存在する場合、reconnectRequestを送信する
- ❌ localStorageからplayerIdとroomIdを正しく取得する

**TC-03: gameStateによる状態復元** (2テスト)
- ❌ gameStateイベントを受信したらGameContextの状態が更新される
- ❌ gameState受信後に再接続モーダルが閉じる

**TC-04: ブラウザリフレッシュ後の自動復帰** (2テスト)
- ❌ ページ読み込み時にlocalStorageにセッション情報があればreconnectRequestを送信
- ✅ localStorageにセッション情報がない場合はreconnectRequestを送信しない

**TC-05: RECONNECT_FAILEDエラー時の処理** (3テスト)
- ❌ RECONNECT_FAILEDエラーを受信したらロビーに遷移する
- ❌ RECONNECT_FAILEDエラー時にlocalStorageをクリアする
- ❌ RECONNECT_FAILEDエラー時に再接続モーダルが閉じる

#### テスト結果
```
Test Files  1 failed (1)
Tests  10 failed | 2 passed (12)
Duration  11.26s
```

**成功したテスト**: 2/12 (16.7%)
**失敗したテスト**: 10/12 (83.3%)

✅ **Red Phaseとして正常** - テストが失敗していることを確認

#### モック構成
```typescript
// Socket.io-client モック
const mockSocket = {
  id: 'mock-socket-id',
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  close: vi.fn(),
};

// React Router モック
const mockNavigate = vi.fn();

// localStorage モック
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
```

#### 技術的な課題と対応

**1. Act Warning**
```
An update to SocketProvider inside a test was not wrapped in act(...)
```
- **原因**: React状態更新が非同期で発生
- **対応**: `waitFor()` を使用してReact更新を待機
- **状態**: 警告は表示されるが、テストは動作している

**2. テストで検出した未実装機能**
- 再接続モーダルコンポーネント (ReconnectionModal)
- Socket切断時のモーダル表示ロジック
- reconnectRequest イベントの送信ロジック
- gameState イベントハンドラー
- RECONNECT_FAILED エラーハンドラー
- localStorage への永続化ロジック
- ロビー遷移ロジック

### Green Phase (機能実装) ✅ 完了

#### 実装が必要なコンポーネント/機能

1. **ReconnectionModal コンポーネント**
   - 場所: `client/src/components/ReconnectionModal.tsx`
   - UI要件:
     - シンプルなモーダルダイアログ
     - "再接続中..." テキスト
     - ローディングスピナー (role="status")
     - ボタンなし (キャンセル不可)

2. **SocketContext の拡張**
   - 場所: `client/src/contexts/SocketContext.tsx`
   - 追加する状態:
     - `isReconnecting: boolean` - 再接続中フラグ
   - 追加するイベントハンドラー:
     - `connect` - 再接続成功時の処理
     - `disconnect` - 切断時の処理
     - `gameState` - 状態復元
     - `error` - RECONNECT_FAILED ハンドリング
   - localStorage 操作:
     - 接続成功時: playerId, roomId を保存
     - 再接続時: localStorage から読み取り
     - エラー時: localStorage をクリア

3. **GameContext の拡張**
   - 場所: `client/src/contexts/GameContext.tsx`
   - 追加するメソッド:
     - `restoreGameState(gameState)` - サーバーから受信したgameStateで状態を復元

4. **useReconnection カスタムフック (オプション)**
   - 場所: `client/src/hooks/useReconnection.ts`
   - 責務:
     - 再接続ロジックの分離
     - localStorage 管理
     - エラーハンドリング

#### 実装順序 (推奨)

1. ReconnectionModal コンポーネント作成
2. SocketContext に isReconnecting 状態追加
3. disconnect イベントハンドラー実装
4. connect イベントハンドラー + reconnectRequest 送信
5. gameState イベントハンドラー実装
6. error イベントハンドラー (RECONNECT_FAILED)
7. localStorage 永続化ロジック
8. GameContext の restoreGameState メソッド

### Refactor Phase ✅ 完了

実施したリファクタリング:
- ✅ 未使用変数の削除 (`gameState`)
- ✅ TypeScript型定義の追加 (jest-dom matchers)
- ✅ ビルドエラーの修正
- ✅ テスト通過確認 (12/12)

**リファクタリング結果:**
- ビルド: ✅ 成功
- テスト: ✅ 12/12 成功
- TypeScriptエラー: ✅ 0件
- コード品質: ✅ 良好

## 技術仕様

### サーバーAPI (既存)

#### イベント: reconnectRequest (Client → Server)
```typescript
{
  playerId: string;
  roomId: string;
}
```

#### イベント: gameState (Server → Client)
```typescript
{
  roomId: string;
  players: Array<{ id: string; name: string; chips: number; seat: number }>;
  communityCards: string[];
  pot: number;
  currentBettorId: string | null;
  playerBets: Record<string, number>;
  hand: [string, string] | null;
}
```

#### イベント: error (Server → Client)
```typescript
{
  message: string;
  code: 'RECONNECT_FAILED' | ...;
}
```

### グレースピリオド
- **サーバー側設定**: 120秒 (120000ms)
- **定義場所**: `server/src/utils/constants.ts`
- **SessionManager**: `server/src/services/SessionManager.ts`

### localStorage キー
- `playerId`: プレイヤーID (UUID)
- `roomId`: ルームID (UUID)

## 参考ドキュメント
- [要件定義書](./client-reconnection-requirements.md)
- [テストケース定義](./client-reconnection-testcases.md)
- [技術スタック](../../../tech-stack.md)
- [サーバー側実装](../../../server/src/socket/socketHandler.ts)

## TODO
- [x] Green Phase: 機能実装
- [x] Refactor Phase: リファクタリング
- [x] 統合テスト実装 (Vitest) - 5テストケース
- [x] E2Eテスト実装 (Playwright) - 5シナリオ
- [ ] Phase 2 テスト実装 (エッジケース) - TC-06, TC-07
- [ ] Phase 3 テスト実装 (境界値) - TC-08, TC-09, TC-10, TC-11
- [ ] 手動動作確認（サーバー + クライアント起動）
- [ ] ドキュメント更新 (README, 技術仕様書)

## 実装完了サマリー

**Phase 1 (必須機能) + 統合/E2Eテスト 完全実装完了! 🎉**

- ✅ Red Phase: 12ユニットテスト実装
- ✅ Green Phase: 全機能実装
- ✅ Refactor Phase: コード品質改善
- ✅ ユニットテスト: 12/12 成功
- ✅ 統合テスト: 5ケース実装
- ✅ E2Eテスト: 5シナリオ実装
- ✅ ビルド: エラー0件

**実装済みファイル:**

**機能実装:**
- `client/src/components/ReconnectionModal.tsx` - 再接続モーダル
- `client/src/contexts/SocketContext.tsx` - 再接続ロジック統合

**ユニットテスト:**
- `client/src/contexts/__tests__/SocketContext.reconnection.test.tsx` - 12テストケース
- `client/vitest.config.ts` - Vitest設定
- `client/src/test/setup.ts` - テストセットアップ
- `client/src/test/vitest.d.ts` - TypeScript型定義

**統合テスト:**
- `server/src/__tests__/helpers/testServer.ts` - テストサーバーヘルパー
- `client/src/__tests__/integration/reconnection.integration.test.ts` - 5統合テスト

**E2Eテスト:**
- `client/tests/e2e/reconnection.spec.ts` - 5E2Eシナリオ

**テスト計画ドキュメント:**
- `docs/implements/milestone-b-client/reconnection/integration-test-plan.md`
- `docs/implements/milestone-b-client/reconnection/e2e-test-plan.md`

**テスト実行コマンド:**
```bash
# ユニットテスト
npm test

# 統合テスト（サーバー起動が必要）
npm run test:integration

# E2Eテスト（サーバー+クライアント起動が必要）
npm run test:e2e
npm run test:e2e:ui  # UIモード
npm run test:e2e:headed  # ヘッド付きモード
```

**次のステップ:**
1. 手動動作確認（サーバー + クライアント統合テスト）
2. エッジケース・境界値テスト追加 (Phase 2, 3)
3. カバレッジ測定・品質保証

## 変更履歴

| 日付 | フェーズ | 内容 |
|------|---------|------|
| 2025-11-23 | Red | Phase 1 ユニットテスト実装完了 (12ケース、10失敗/2成功) |
| 2025-11-23 | Green | 全機能実装完了 (12/12ユニットテスト成功) |
| 2025-11-23 | Refactor | リファクタリング完了 (TypeScript型定義、未使用変数削除) |
| 2025-11-23 | 統合テスト | 5つの統合テストケース実装完了 |
| 2025-11-23 | E2Eテスト | 5つのE2Eシナリオ実装完了 |
