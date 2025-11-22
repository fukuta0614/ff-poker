# マイルストーンB API仕様書

## 概要

このドキュメントはマイルストーンBで追加・変更されるSocket.ioイベントAPI仕様を記載します。

REST APIは既存のマイルストーンAから変更なし。

---

## Socket.io イベント API

### クライアント → サーバー

---

#### `reconnectRequest` - 再接続リクエスト 🔵 *REQ-006, requirements.md API仕様より*

**概要**: 切断後の再接続を試みる

**リクエスト**:
```typescript
{
  roomId: string;    // ルームID
  playerId: string;  // プレイヤーID（localStorageから取得）
}
```

**レスポンス（成功時）**:

複数のイベントが順次送信される:

1. `roomState` - ルーム情報
```typescript
{
  room: {
    id: string;
    players: Player[];
    state: 'waiting' | 'in_progress' | 'finished';
    // その他のルーム公開情報
  }
}
```

2. `gameState` - ゲーム状態
```typescript
{
  roundState: RoundState;
  playersPublic: PublicPlayerInfo[];
}
```

3. `privateHand` - 手札（個別送信）
```typescript
{
  playerId: string;
  cards: string[];  // 例: ["Ah", "Kd"]
}
```

4. `reconnectSuccess` - 再接続成功通知
```typescript
{
  message: "再接続に成功しました"
}
```

**レスポンス（失敗時）**:

`error` イベント
```typescript
{
  code: "RECONNECT_FAILED",
  message: "再接続に失敗しました。セッションの有効期限が切れています。"
}
```

**実装ポイント** 🔵 *REQ-104, REQ-105より*:
- セッションが120秒以内の場合のみ成功
- 120秒を超えた場合は`RECONNECT_FAILED`エラー
- 再接続成功時、他のプレイヤーに`playerReconnected`イベントをブロードキャスト

---

### サーバー → クライアント

---

#### `playerDisconnected` - プレイヤー切断通知 🔵 *REQ-106より*

**概要**: 他のプレイヤーが切断されたことを通知（グレースピリオド開始）

**イベントデータ**:
```typescript
{
  playerId: string;           // 切断したプレイヤーID
  playerName: string;         // プレイヤー名
  remainingSeconds: number;   // 残りグレースピリオド（秒）
}
```

**UI表示例**:
```
プレイヤーXが再接続を試みています... 残り115秒
```

**更新頻度**: 1秒毎に`remainingSeconds`が更新される

---

#### `playerReconnected` - プレイヤー再接続通知 🔵 *REQ-007より*

**概要**: 切断していたプレイヤーが再接続したことを通知

**イベントデータ**:
```typescript
{
  playerId: string;      // 再接続したプレイヤーID
  playerName: string;    // プレイヤー名
}
```

**UI表示例**:
```
プレイヤーXが再接続しました
```

---

#### `playerTimeout` - プレイヤータイムアウト通知 🔵 *REQ-105, EDGE-003より*

**概要**: プレイヤーがグレースピリオドを超過、またはターンタイムアウトしたことを通知

**イベントデータ**:
```typescript
{
  playerId: string;                                   // タイムアウトしたプレイヤーID
  playerName: string;                                 // プレイヤー名
  reason: 'grace_period_expired' | 'turn_timeout';   // 理由
}
```

**UI表示例**:
```
reason = 'grace_period_expired':
  「プレイヤーXが再接続できませんでした（自動フォールド）」

reason = 'turn_timeout':
  「プレイヤーXがタイムアウトしました（自動フォールド）」
```

---

#### `turnStart` - ターン開始通知 🔵 *REQ-008, implementation-planより*

**概要**: プレイヤーのターンが開始されたことを通知

**イベントデータ**:
```typescript
{
  playerId: string;              // 対象プレイヤーID
  timeLimit: number;             // タイムリミット（秒）、通常60秒
  allowedActions: string[];      // 許可されたアクション ["fold", "check", "call", "bet", "raise"]
}
```

**実装ポイント** 🔵 *REQ-008より*:
- タイムリミットは60秒固定
- クライアントはこのイベントを受信したらカウントダウンタイマーを開始

---

#### `timerUpdate` - タイマー更新通知 🔵 *REQ-009, REQ-203より*

**概要**: ターンタイマーの残り時間を1秒毎に通知

**イベントデータ**:
```typescript
{
  remainingSeconds: number;      // 残り時間（秒）
  isWarning: boolean;            // 警告状態（残り10秒以下）
}
```

**実装ポイント** 🔵 *REQ-010, REQ-204より*:
- 1秒毎に更新
- `isWarning = true`の場合、クライアントはタイマー表示を赤色に変更

---

#### `autoAction` - 自動アクション実行通知 🔵 *REQ-108, REQ-109より*

**概要**: タイムアウトにより自動アクションが実行されたことを通知

**イベントデータ**:
```typescript
{
  playerId: string;                    // 対象プレイヤーID
  action: 'check' | 'fold';           // 実行されたアクション
  message: string;                     // 通知メッセージ
}
```

**UI表示例**:
```
action = 'check':
  「タイムアウトにより自動チェックしました」

action = 'fold':
  「タイムアウトにより自動フォールドしました」
```

**実装ポイント** 🔵 *architecture.mdタイムアウト処理より*:
- チェック可能な場合: `action = 'check'`
- チェック不可能な場合: `action = 'fold'`

---

#### `error` - エラー通知（拡張） 🔵 *REQ-012, REQ-013より*

**概要**: 既存のerrorイベントを拡張し、詳細なエラーコードとメッセージを追加

**イベントデータ**:
```typescript
{
  code: ErrorCode;                     // エラーコード（列挙型）
  message: string;                     // ユーザー向けメッセージ（日本語）
  details?: {                          // 詳細情報（デバッグ用、オプション）
    field?: string;
    expected?: any;
    actual?: any;
  }
}
```

**エラーコード一覧**:

| コード | 説明 | メッセージ例 |
|---|---|---|
| `NOT_YOUR_TURN` | 自分のターンでない | 今はあなたのターンではありません |
| `INVALID_ACTION` | 不正なアクション | そのアクションは実行できません |
| `INVALID_BET_AMOUNT` | 不正なベット額 | 所持チップを超えるベットはできません |
| `ROOM_NOT_FOUND` | ルームが見つからない | ルームが見つかりません。ルームIDを確認してください |
| `RECONNECT_FAILED` | 再接続失敗 | 再接続に失敗しました。セッションの有効期限が切れています |
| `TIMEOUT` | タイムアウト | タイムアウトしました |
| `INTERNAL_ERROR` | 内部エラー | サーバーエラーが発生しました。しばらくしてから再度お試しください |
| `ROOM_FULL` | ルーム満員 | ルームが満員です |
| `GAME_IN_PROGRESS` | ゲーム進行中 | ゲームが進行中のため参加できません |

**UI表示** 🔵 *REQ-029, REQ-030より*:
- トースト通知で表示
- 3秒後に自動で消える
- 分かりやすい日本語メッセージ

---

## Socket.ioイベント一覧（マイルストーンB追加分）

### Client → Server

| イベント名 | 概要 | 追加/変更 |
|---|---|---|
| `reconnectRequest` | 再接続リクエスト | 🆕 新規 |

### Server → Client

| イベント名 | 概要 | 追加/変更 |
|---|---|---|
| `playerDisconnected` | プレイヤー切断通知 | 🆕 新規 |
| `playerReconnected` | プレイヤー再接続通知 | 🆕 新規 |
| `playerTimeout` | プレイヤータイムアウト通知 | 🆕 新規 |
| `turnStart` | ターン開始通知 | 🆕 新規 |
| `timerUpdate` | タイマー更新通知 | 🆕 新規 |
| `autoAction` | 自動アクション実行通知 | 🆕 新規 |
| `error` | エラー通知 | ✏️ 拡張（エラーコード追加） |

---

## REST API（マイルストーンAから変更なし）

既存のREST APIはマイルストーンBでは変更なし。

参考: `docs/design/requirements.md` セクション「API仕様」

---

## イベントフローの例

### 再接続フロー

```
1. Client切断
   → Server: (自動検知)
   → Server → All Clients: playerDisconnected

2. Clientが再接続を試みる
   Client → Server: reconnectRequest

3. サーバーがセッション確認（120秒以内）
   → 成功の場合:
     Server → Client: roomState
     Server → Client: gameState
     Server → Client: privateHand
     Server → Client: reconnectSuccess
     Server → All Clients: playerReconnected

   → 失敗の場合（120秒超過）:
     Server → Client: error('RECONNECT_FAILED')
```

### タイムアウトフロー

```
1. ターン開始
   Server → Client: turnStart(playerId, 60秒)

2. タイマー更新（1秒毎）
   Server → Client: timerUpdate(59秒, false)
   Server → Client: timerUpdate(58秒, false)
   ...
   Server → Client: timerUpdate(10秒, true)  ← 警告状態
   Server → Client: timerUpdate(9秒, true)
   ...
   Server → Client: timerUpdate(1秒, true)

3. タイムアウト
   Server → All Clients: autoAction(playerId, 'check' or 'fold')
   Server → All Clients: actionResult(...)
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-22 | 1.0 | 初版作成（マイルストーンB API仕様） |
