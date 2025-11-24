# DebugLogger Feature

## 概要

DebugLoggerは、開発環境でのデバッグ効率を向上させるためのログ記録機能です。サーバー起動以降のSocket.ioイベントと処理結果をファイルに記録し、開発者がゲームの動作を追跡・デバッグできるようにします。

## 機能

### サーバーサイド

- **自動ログ記録**: Socket.ioイベント（joinRoom, startGame, action等）を自動的に記録
- **処理結果の記録**: ゲームロジックの処理成功・失敗を記録
- **エラーログ**: エラー発生時の詳細情報を記録
- **環境分離**: 開発環境でのみ有効化（本番環境では自動的に無効化）
- **ファイル出力**: `server/logs/debug.log` にタイムスタンプ付きで出力

### クライアントサイド

- **デバッグログビューアー**: ブラウザからログを表示・管理するUI
- **ログ取得API**: サーバーからログを取得
- **ログクリアAPI**: 不要なログを削除

## 使い方

### ログの確認

1. ブラウザで http://localhost:5173/ を開く
2. 画面右上の **「🐛 Debug Logs」** ボタンをクリック
3. モーダルダイアログが開く
4. **「🔄 Refresh Logs」** ボタンをクリックしてログを読み込む
5. ログがモノスペースフォントで表示される

### ログのクリア

1. デバッグログビューアーを開く
2. **「🗑️ Clear Logs」** ボタンをクリック
3. 確認ダイアログで「OK」を選択
4. すべてのログが削除される

## ログフォーマット

```
[{timestamp}] [{level}] {message}
```

### 例

```
[2025-11-24 15:30:45.123] [DEBUG] Room creation requested by kk
[2025-11-24 15:30:45.156] [INFO] Room created: abc123 by kk
[2025-11-24 15:30:45.234] [INFO] Socket event received: joinRoom, playerId: kk, roomId: abc123
[2025-11-24 15:30:45.267] [INFO] Player kk joined room abc123
[2025-11-24 15:30:50.345] [INFO] Socket event received: startGame, roomId: abc123
[2025-11-24 15:30:50.378] [INFO] Game started in room abc123
[2025-11-24 15:31:00.456] [INFO] Socket event received: action, playerId: p1, action: call, amount: 20
[2025-11-24 15:31:00.489] [INFO] Action processed: Player p1 call 20
[2025-11-24 15:31:05.567] [ERROR] Invalid action - player p2 not current bettor
```

## ログレベル

- **DEBUG**: デバッグ情報（詳細な処理ステップ）
- **INFO**: 一般的な情報（イベント受信、処理成功）
- **ERROR**: エラー情報（バリデーションエラー、処理失敗）

## 記録されるイベント

### Socket.ioイベント

- `createRoom`: ルーム作成
- `joinRoom`: ルーム参加
- `leaveRoom`: ルーム退出
- `startGame`: ゲーム開始
- `action`: プレイヤーアクション（fold, check, call, bet, raise）
- `chatMessage`: チャットメッセージ

### 処理結果

- ルーム作成成功/失敗
- プレイヤー参加成功/失敗
- ゲーム開始成功/失敗
- アクション処理成功/失敗

## セキュリティ

### 記録される情報

- プレイヤーID（UUID）
- ルームID
- アクション種別
- ベット額

### 記録されない情報

- ホールカード（手札）
- プレイヤー名（個人情報）
- 環境変数
- シークレット情報

## API エンドポイント

### GET /api/debug/logs

**説明**: デバッグログを取得

**レスポンス**:
```json
{
  "logs": "[2025-11-24 15:30:45.123] [INFO] ..."
}
```

**制限**: 開発環境のみ（本番環境では403エラー）

### DELETE /api/debug/logs

**説明**: デバッグログをクリア

**レスポンス**:
```json
{
  "success": true,
  "message": "Debug logs cleared"
}
```

**制限**: 開発環境のみ（本番環境では403エラー）

## 実装詳細

### ファイル構成

```
server/
├── src/
│   ├── services/
│   │   ├── DebugLogger.ts          # DebugLoggerサービス本体
│   │   └── __tests__/
│   │       └── DebugLogger.test.ts # ユニットテスト
│   ├── utils/
│   │   ├── logFormatter.ts         # ログフォーマッタ
│   │   └── __tests__/
│   │       └── logFormatter.test.ts # ユニットテスト
│   ├── types/
│   │   └── debugLog.ts             # 型定義
│   ├── api/
│   │   └── routes.ts               # API エンドポイント
│   ├── socket/
│   │   └── socketHandler.ts        # Socket.io イベントハンドラ
│   └── server.ts                   # DebugLogger初期化
└── logs/
    └── debug.log                    # ログファイル（自動生成）

client/
└── src/
    └── components/
        ├── DebugLogViewer.tsx       # デバッグログビューアー
        └── Lobby.tsx                # ログビューアー呼び出し
```

### テストカバレッジ

- **DebugLogger**: 48/48 テストケース（100%）
- **logFormatter**: 6/6 テストケース（100%）
- **総合カバレッジ**: 80%以上

## トラブルシューティング

### ログが表示されない

1. サーバーが開発環境で起動しているか確認（`NODE_ENV !== 'production'`）
2. `server/logs/` ディレクトリが作成されているか確認
3. ログファイルの書き込み権限を確認

### ログファイルが見つからない

- サーバー再起動後、最初のイベント発生時にディレクトリとファイルが自動作成されます
- ブラウザでルーム作成などの操作を行ってください

### 本番環境でログを有効にしたい

```typescript
// server.ts
const debugLogger = new DebugLogger({
  enableInProduction: true
});
```

**注意**: 本番環境でのログ有効化はパフォーマンスに影響する可能性があります。

## 今後の拡張

- [ ] ログローテーション機能
- [ ] ログレベルフィルタリング
- [ ] リアルタイムログストリーミング
- [ ] ログエクスポート（JSON形式）
- [ ] ログ検索機能

## 関連ドキュメント

- [要件定義書](../spec/debug-logging-requirements.md)
- [設計書](../design/debug-logging/architecture.md)
- [テスト設計書](../design/debug-logging/test-design.md)
