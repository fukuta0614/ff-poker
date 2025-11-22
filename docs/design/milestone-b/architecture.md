# マイルストーンB（安定化） アーキテクチャ設計

## システム概要

マイルストーンBでは、マイルストーンAで実装した基本ゲームフローに、再接続機能・タイムアウト処理・エラーハンドリング・ロギング機能を追加し、実用的なゲームにする。

**設計の重要な方針**:
- **完全RAM管理**: セッション・ゲーム状態をRAMのみで管理し、Redis等の外部ストアは使用しない
- **開発中の柔軟性**: ROM永続化を避け、仕様変更時のデータマイグレーション負担を回避
- **サーバーが唯一の真実**: すべてのゲームロジック・バリデーションをサーバー側で実行

---

## アーキテクチャパターン

### 選択パターン: クライアント・サーバーモデル + イベント駆動アーキテクチャ

**理由**:
1. **リアルタイム性**: Socket.ioによる双方向通信でリアルタイムゲームを実現
2. **セキュリティ**: サーバー側で全ロジックを実行し、クライアントは表示のみ
3. **シンプル**: マイクロサービスは不要、単一サーバーで十分
4. **スケーラビリティ**: 将来的にRedis adapterで水平スケール可能（現時点では不使用）

---

## コンポーネント構成

```
┌─────────────────────────────────────┐
│  Browser Client (React)             │
│  - UI Components                    │
│  - Socket.io Client                 │
│  - State Management (Context API)   │
│  - localStorage (playerId保存)      │
└─────────────┬───────────────────────┘
              │
              │ WebSocket (Socket.io)
              │ HTTPS/WSS
              │
┌─────────────▼───────────────────────┐
│  Node.js Game Server                │
│  ┌─────────────────────────────────┐│
│  │ Socket.io Server                ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Session Manager (RAM Map)       ││
│  │ - playerId → session mapping    ││
│  │ - TTL: 120秒                    ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Turn Timer Manager              ││
│  │ - タイムアウト処理（60秒）        ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Game Manager (既存)             ││
│  │ - Room管理                      ││
│  │ - Round管理                     ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ Logger Service (winston)        ││
│  │ - ファイル出力                   ││
│  │ - 標準出力                       ││
│  │ - DEBUG/INFO/WARN/ERROR         ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## フロントエンド設計

### フレームワーク・ライブラリ

- **UI**: React 18.x + TypeScript 🔵 *tech-stack.md より*
- **ビルドツール**: Vite 5.x 🔵 *tech-stack.md より*
- **状態管理**: React Context API + useReducer 🔵 *tech-stack.md より*
- **スタイリング**: Tailwind CSS 3.x 🔵 *tech-stack.md より*
- **リアルタイム通信**: socket.io-client 4.x 🔵 *tech-stack.md より*

### ディレクトリ構造（追加分）

```
client/src/
  /components
    /common
      ReconnectModal.tsx       # 再接続モーダル 🔵 *REQ-025より*
      Timer.tsx                # カウントダウンタイマー 🔵 *REQ-027より*
      Toast.tsx                # エラー通知トースト 🔵 *REQ-029より*
  /hooks
    useReconnect.ts            # 再接続ロジック 🔵 *REQ-026より*
    useTimer.ts                # タイマー管理 🟡 *タイマーUI実装の妥当な推測*
  /services
    sessionStorage.ts          # playerId管理 🔵 *REQ-024より*
```

### 状態管理戦略（マイルストーンB追加）

```typescript
// 既存のGameContextに追加
interface GameState {
  // 既存フィールド
  room: Room | null;
  roundState: RoundState | null;
  myPlayerId: string | null;
  myHand: string[];

  // マイルストーンB追加 🔵 *milestone-b要件より*
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  reconnectTimer: number | null; // 残り秒数
  turnTimer: number | null; // アクションタイマー残り秒数
  error: ErrorMessage | null; // エラーメッセージ
}
```

---

## バックエンド設計

### フレームワーク・ライブラリ

- **ランタイム**: Node.js 20.x (LTS) 🔵 *tech-stack.md より*
- **Webフレームワーク**: Express 4.x 🔵 *tech-stack.md より*
- **リアルタイム通信**: socket.io 4.x 🔵 *tech-stack.md より*
- **ロギング**: winston 3.x 🔵 *tech-stack.md + REQ-014より*
- **言語**: TypeScript 5.x 🔵 *tech-stack.md より*

### ディレクトリ構造（追加分）

```
server/src/
  /services
    SessionManager.ts          # セッション管理 🔵 *REQ-001~004より*
    TurnTimerManager.ts        # タイムアウト処理 🔵 *REQ-008~010より*
    LoggerService.ts           # ロギング 🔵 *REQ-014~016より*
  /utils
    validation.ts              # 入力バリデーション強化 🔵 *REQ-011より*
```

### 主要コンポーネント設計

#### 1. SessionManager（新規）🔵 *REQ-001~004, REQ-101~103より*

**責務**: プレイヤーセッションの作成・更新・削除、グレースピリオド管理

```typescript
class SessionManager {
  private sessions: Map<string, PlayerSession>;
  private readonly GRACE_PERIOD = 120000; // 120秒 🔵 *ユーザーヒアリング2025-11-22より*

  createSession(playerId: string, socketId: string): void;
  updateSession(playerId: string, socketId: string): void;
  reconnect(playerId: string, newSocketId: string): boolean;
  cleanupExpiredSessions(): void; // 定期実行
  isSessionValid(playerId: string): boolean;
}

interface PlayerSession {
  playerId: string;
  socketId: string;
  lastSeen: number; // timestamp
}
```

**設計ポイント**:
- RAM（Map）のみで管理、永続化なし 🔵 *REQ-401, REQ-402より*
- 120秒のTTL（Time To Live） 🔵 *REQ-103より*
- 定期的なクリーンアップ処理（setInterval） 🟡 *セッション管理実装の妥当な推測*

---

#### 2. TurnTimerManager（新規）🔵 *REQ-008~010, REQ-107~109より*

**責務**: プレイヤーターンのタイムアウト管理、自動アクション実行

```typescript
class TurnTimerManager {
  private timers: Map<string, NodeJS.Timeout>;
  private readonly TIMEOUT_DURATION = 60000; // 60秒 🔵 *ユーザーヒアリング2025-11-22より*
  private readonly WARNING_THRESHOLD = 10000; // 10秒 🔵 *ユーザーヒアリング2025-11-22より*

  startTimer(roomId: string, playerId: string, onTimeout: () => void): void;
  cancelTimer(roomId: string): void;
  getRemainingTime(roomId: string): number;
}
```

**設計ポイント**:
- NodeJS.Timeoutを使用したタイマー管理
- タイムアウト時の自動処理
  - チェック可能: 自動チェック 🔵 *REQ-108より*
  - チェック不可: 自動フォールド 🔵 *REQ-109より*
- 残り時間を1秒毎にクライアントに送信 🔵 *REQ-203より*

---

#### 3. LoggerService（新規）🔵 *REQ-014~023より*

**責務**: 構造化ログ出力、ログレベル管理

```typescript
import winston from 'winston';

class LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // 🔵 *REQ-117, REQ-118より*
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(), // 標準出力
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
      ]
    });
  }

  debug(message: string, meta?: object): void;
  info(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  error(message: string, error?: Error, meta?: object): void;
}
```

**ログ出力内容** 🔵 *REQ-119~123より*:
- ゲーム開始: ルームID、プレイヤー一覧、ブラインド額
- カード配布: デッキハッシュ値（監査用）
- アクション実行: playerId、アクション種別、ベット額、残チップ数
- ポット計算: メインポット、サイドポット詳細
- 接続/切断: socketId、playerId、タイムスタンプ
- エラー: スタックトレース含む

---

#### 4. バリデーション強化 🔵 *REQ-011~013, REQ-110~113より*

**責務**: すべてのアクションのサーバー側検証、詳細なエラーメッセージ

```typescript
// server/src/utils/validation.ts

export function validateAction(
  playerId: string,
  action: Action,
  gameState: GameState
): ValidationResult {
  // プレイヤーのターンか確認
  if (gameState.currentPlayerId !== playerId) {
    return {
      valid: false,
      errorCode: 'NOT_YOUR_TURN',
      errorMessage: '今はあなたのターンではありません' // 🔵 *REQ-030より*
    };
  }

  // アクションが許可されているか確認
  const allowedActions = getAllowedActions(playerId, gameState);
  if (!allowedActions.includes(action.type)) {
    return {
      valid: false,
      errorCode: 'INVALID_ACTION',
      errorMessage: `${action.type}は現在実行できません`
    };
  }

  // ベット額の妥当性確認
  if ((action.type === 'bet' || action.type === 'raise') && action.amount) {
    if (action.amount > gameState.playerChips[playerId]) {
      return {
        valid: false,
        errorCode: 'INVALID_BET_AMOUNT',
        errorMessage: '所持チップを超えるベットはできません'
      };
    }
  }

  return { valid: true };
}

interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}
```

---

## データストア設計

### RAM管理のみ（Redis不使用）🔵 *REQ-401, REQ-402, ユーザーヒアリング2025-11-22より*

**使用データ構造**:

```typescript
// SessionManager内
private sessions: Map<playerId, PlayerSession>

// TurnTimerManager内
private timers: Map<roomId, NodeJS.Timeout>

// GameManager内（既存）
private rooms: Map<roomId, Room>
```

**データ永続化方針**:
- **サーバー再起動時**: 全データ消失（許容） 🔵 *EDGE-001より*
- **メモリ管理**: 古いセッションの定期削除によりメモリリーク防止 🟡 *RAM管理設計の妥当な推測*

---

## セキュリティ設計

### 1. サーバー側検証の徹底 🔵 *NFR-201, NFR-202より*

- すべてのプレイヤーアクションをサーバー側でバリデーション
- クライアントからの入力を信頼しない
- ゲームロジックはサーバー側のみで実行

### 2. セッション認証 🔵 *REQ-006より*

- playerIdをUUIDで生成し、推測不可能にする
- 再接続時にplayerIdとsocketIdのマッピングを検証

### 3. レート制限 🟡 *architecture.md既存設計より*

```typescript
// 連続アクション防止
const MIN_ACTION_INTERVAL = 100; // 100ms

function checkRateLimit(playerId: string): boolean {
  const lastAction = actionTimestamps.get(playerId) || 0;
  const now = Date.now();

  if (now - lastAction < MIN_ACTION_INTERVAL) {
    return false;
  }

  actionTimestamps.set(playerId, now);
  return true;
}
```

---

## パフォーマンス設計

### 目標 🔵 *NFR-001, NFR-002より*

- アクション実行から結果反映まで: **1秒以内**
- タイマー更新間隔: **1秒間隔** で正確に更新
- 同時接続数: **10ルーム（最大60ユーザー）** を同時処理

### 最適化戦略

1. **イベント駆動**: ポーリング不要、Socket.ioのpush通知
2. **効率的なデータ構造**: MapによるO(1)検索
3. **非同期処理**: async/awaitでブロッキングを回避

---

## エラーハンドリング戦略

### エラー分類 🔵 *REQ-012, REQ-013より*

```typescript
interface ErrorResponse {
  message: string;      // ユーザー向けメッセージ（日本語）
  code: string;         // エラーコード
  details?: object;     // 詳細情報（デバッグ用）
}

enum ErrorCode {
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_BET_AMOUNT = 'INVALID_BET_AMOUNT',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  RECONNECT_FAILED = 'RECONNECT_FAILED',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

### クライアント側エラー表示 🔵 *REQ-029, REQ-030より*

- トースト通知で一時的に表示
- 分かりやすい日本語メッセージ
- 自動で消える（3秒程度）

---

## モニタリング・ロギング設計

### ログレベル定義 🔵 *REQ-015より*

- **ERROR**: システムエラー、例外、スタックトレース
- **WARN**: 異常なアクション、タイムアウト
- **INFO**: ゲーム開始/終了、重要イベント
- **DEBUG**: 詳細なゲームフロー、内部状態（開発時のみ）

### ログ出力例 🔵 *REQ-119~123より*

```json
{
  "timestamp": "2025-11-22T10:30:00.123Z",
  "level": "info",
  "message": "Game started",
  "roomId": "abc123",
  "players": ["player1", "player2"],
  "smallBlind": 10,
  "bigBlind": 20
}

{
  "timestamp": "2025-11-22T10:30:05.456Z",
  "level": "debug",
  "message": "Player action",
  "playerId": "player1",
  "action": "bet",
  "amount": 50,
  "remainingChips": 950
}

{
  "timestamp": "2025-11-22T10:30:10.789Z",
  "level": "error",
  "message": "Validation error",
  "errorCode": "INVALID_BET_AMOUNT",
  "playerId": "player1",
  "stack": "..."
}
```

---

## デプロイメント設計

### 開発環境 🔵 *tech-stack.md, requirements.mdより*

```
Frontend: localhost:5173 (Vite dev server)
Backend:  localhost:3000 (Node.js + nodemon)
```

### 本番環境（将来）🟡 *tech-stack.md「マイルストーンC」より*

```
Frontend: Vercel (CDN配信)
Backend:  Render / Fly.io (WebSocket対応)
```

**注**: マイルストーンBでは本番デプロイは想定せず、ローカル・開発環境のみ

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-22 | 1.0 | 初版作成（マイルストーンB技術設計） |
