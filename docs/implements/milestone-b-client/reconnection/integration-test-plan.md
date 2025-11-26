# 再接続機能 - 統合テスト計画

## 概要
クライアント・サーバー間の再接続機能を実際のSocket.io接続を使って検証する統合テスト。

## テスト環境
- **テストフレームワーク**: Vitest
- **サーバー**: 実際のExpressサーバーを起動
- **クライアント**: 実際のSocket.io-clientを使用
- **ポート**: テスト用に3001を使用（本番は3000）

## テストケース

### IT-01: 基本的な再接続フロー
**目的**: Socket切断後、120秒以内に再接続できることを確認

**手順**:
1. サーバー起動
2. クライアント接続（Socket.io-client）
3. プレイヤーをルームに参加させる
4. playerId, roomId を localStorage に保存
5. Socket を強制切断
6. 5秒待機
7. Socket を再接続
8. reconnectRequest を送信
9. gameState イベントを受信
10. ゲーム状態が復元されることを確認

**期待結果**:
- ✅ reconnectRequest が正しく送信される
- ✅ サーバーから gameState が返ってくる
- ✅ プレイヤー情報、ポット、コミュニティカードが復元される

---

### IT-02: グレースピリオド内での再接続
**目的**: 119秒後の再接続が成功することを確認

**手順**:
1. サーバー起動
2. クライアント接続してゲーム参加
3. Socket 切断
4. 119秒待機（グレースピリオド120秒未満）
5. 再接続試行

**期待結果**:
- ✅ 再接続成功
- ✅ gameState 受信

**注意**: テスト実行時間が長いため、モックタイマーを使用するか、サーバー側のグレースピリオドを短く設定

---

### IT-03: グレースピリオド超過後の再接続失敗
**目的**: 120秒超過後の再接続が失敗することを確認

**手順**:
1. サーバー起動
2. クライアント接続してゲーム参加
3. Socket 切断
4. 121秒待機（グレースピリオド超過）
5. 再接続試行

**期待結果**:
- ✅ RECONNECT_FAILED エラーを受信
- ✅ localStorage がクリアされる
- ❌ gameState は受信しない

---

### IT-04: 複数プレイヤーの再接続
**目的**: 複数プレイヤーが同時に再接続できることを確認

**手順**:
1. サーバー起動
2. プレイヤーA, B, C を同じルームに参加
3. プレイヤーA のSocket切断
4. プレイヤーB のSocket切断
5. プレイヤーA 再接続
6. プレイヤーB 再接続
7. 各プレイヤーがgameStateを受信

**期待結果**:
- ✅ 各プレイヤーが独立して再接続できる
- ✅ 他のプレイヤーに playerReconnected イベントが通知される

---

### IT-05: 無効なセッションでの再接続試行
**目的**: 存在しないplayerIdでの再接続が拒否されることを確認

**手順**:
1. サーバー起動
2. クライアント接続（ゲームには参加しない）
3. 存在しない playerId で reconnectRequest 送信

**期待結果**:
- ✅ RECONNECT_FAILED エラーを受信
- ❌ gameState は受信しない

---

## テスト実装方針

### テスト用サーバーセットアップ
```typescript
// テスト用サーバーを起動
async function setupTestServer(): Promise<Server> {
  const app = express();
  const server = createServer(app);
  const io = new Server(server);

  // SocketハンドラーとGameManagerをセットアップ
  setupSocketHandlers(io);

  await new Promise<void>((resolve) => {
    server.listen(3001, resolve);
  });

  return server;
}
```

### テスト用クライアント
```typescript
// Socket.io-client を直接使用
const socket = io('http://localhost:3001', {
  transports: ['websocket'],
  reconnection: false, // 手動で再接続を制御
});
```

### タイムアウト対策
- グレースピリオドテストは時間がかかるため、テスト用環境変数でグレースピリオドを短縮
- 例: `TEST_GRACE_PERIOD=5000` (5秒)

### クリーンアップ
```typescript
afterEach(async () => {
  // すべてのSocket切断
  socket.disconnect();

  // サーバー停止
  await new Promise((resolve) => server.close(resolve));

  // Redis クリア（セッションデータ削除）
  await redisClient.flushdb();
});
```

## 実装ファイル
- `client/src/__tests__/integration/reconnection.integration.test.ts`
- `server/src/__tests__/helpers/testServer.ts` (ヘルパー)

## 成功基準
- ✅ 全5テストケースが成功
- ✅ テスト実行時間 < 30秒（タイマーモック使用時）
- ✅ カバレッジ: 再接続ロジック 90%以上
