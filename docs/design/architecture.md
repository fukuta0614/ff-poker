# Online Poker - 設計書

## 目次

1. [システムアーキテクチャ](#システムアーキテクチャ)
2. [フロントエンド設計](#フロントエンド設計)
3. [バックエンド設計](#バックエンド設計)
4. [ゲームロジック設計](#ゲームロジック設計)
5. [通信設計](#通信設計)
6. [データフロー](#データフロー)
7. [インフラ設計](#インフラ設計)
8. [セキュリティ・チート対策](#セキュリティチート対策)

---

## システムアーキテクチャ

### 全体構成図

```
┌─────────────────────────────────┐
│  Browser Client (React)         │
│  - UI Components                │
│  - Socket.io Client             │
│  - State Management             │
└─────────────┬───────────────────┘
              │
              │ WebSocket (socket.io)
              │ HTTPS/WSS
              │
┌─────────────▼───────────────────┐
│  Node.js Game Server            │
│  - Express/Fastify              │
│  - Socket.io Server             │
│  - Game Logic                   │
│  - Room Management              │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼──────┐    ┌──────▼─────────┐
│  Redis   │    │  PostgreSQL    │
│ (State)  │    │ (Audit Logs)   │
│ (Cache)  │    │  (Optional)    │
└──────────┘    └────────────────┘
```

### アーキテクチャの原則

1. **サーバが唯一の真実（Single Source of Truth）**
   - ゲーム状態はサーバ側のみで管理
   - クライアントは表示専用

2. **リアルタイム通信**
   - Socket.ioによる双方向通信
   - イベント駆動アーキテクチャ

3. **スケーラビリティ**
   - Redis adapter によるスケール対応
   - Sticky session またはRedis pub/sub

---

## フロントエンド設計

### ディレクトリ構造

```
/src
  /components
    /common
      Button.tsx
      Card.tsx
      Loading.tsx
    /game
      Table.tsx
      PlayerSeat.tsx
      CommunityCards.tsx
      ActionPanel.tsx
      PotDisplay.tsx
      Timer.tsx
    /room
      Lobby.tsx
      RoomHeader.tsx
      PlayerList.tsx
    /chat
      Chat.tsx
      ChatMessage.tsx
  /hooks
    useSocket.ts
    useRoomState.ts
    useGameState.ts
    useReconnect.ts
  /contexts
    SocketContext.tsx
    GameContext.tsx
  /pages
    Home.tsx
    Lobby.tsx
    Room.tsx
  /utils
    card.ts
    handEvaluator.ts
    constants.ts
  /types
    game.ts
    socket.ts
  App.tsx
  main.tsx
```

### 主要コンポーネント設計

#### 1. Lobby（ロビー画面）
**責務**: ルーム作成・参加画面
- ルーム作成フォーム
- ルームID入力フォーム
- プレイヤー名入力

**Props**:
```typescript
interface LobbyProps {
  onCreateRoom: (playerName: string, blinds: BlindConfig) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
}
```

#### 2. Room（ゲームルーム）
**責務**: テーブルとプレイヤー一覧表示、socket接続管理
- Socket接続の初期化
- ルーム状態の購読
- 各種ゲームコンポーネントの配置

**State**:
```typescript
interface RoomState {
  roomId: string;
  players: Player[];
  gameState: GameState | null;
  isConnected: boolean;
}
```

#### 3. Table（ゲームテーブル）
**責務**: コミュニティカード、ポット、タイマー表示
- コミュニティカードの表示
- ポット総額の表示
- ターンタイマーの表示

**Props**:
```typescript
interface TableProps {
  communityCards: string[];
  pot: number;
  sidePots: SidePot[];
  currentPlayerIndex: number;
  timeRemaining: number;
}
```

#### 4. PlayerSeat（プレイヤー座席）
**責務**: 各プレイヤーの情報表示
- プレイヤー名
- チップ量
- ステータス（folded/active/turn）
- ホールカード（自分のみ表示）

**Props**:
```typescript
interface PlayerSeatProps {
  player: Player;
  isCurrentPlayer: boolean;
  isSelf: boolean;
  holeCards?: string[];
  bet: number;
}
```

#### 5. ActionPanel（アクションパネル）
**責務**: プレイヤーの操作ボタン
- Fold / Check / Call / Bet / Raise ボタン
- ベット額入力スライダー
- サーバからの許可に応じてボタン活性化

**Props**:
```typescript
interface ActionPanelProps {
  allowedActions: ActionType[];
  currentBet: number;
  playerChips: number;
  onAction: (action: ActionType, amount?: number) => void;
  disabled: boolean;
}
```

#### 6. Chat（チャット）
**責務**: チャットログ表示・送信
- メッセージログ表示
- メッセージ入力フォーム
- 送信処理

#### 7. ReconnectModal（再接続モーダル）
**責務**: 切断時の再接続UI
- 接続状態の表示
- 再接続ボタン
- 自動再接続処理

### 状態管理戦略

#### Context + useReducer パターン

```typescript
// SocketContext: Socket.io接続管理
const SocketContext = React.createContext<SocketContextValue>(null);

// GameContext: ゲーム状態管理
interface GameState {
  room: Room | null;
  roundState: RoundState | null;
  myPlayerId: string | null;
  myHand: string[];
}

const gameReducer = (state: GameState, action: GameAction) => {
  // 状態更新ロジック
};
```

#### カスタムフック

```typescript
// useSocket: Socket.io接続とイベント管理
const useSocket = (roomId: string) => {
  // 接続管理、イベントリスナー登録
};

// useRoomState: ルーム状態の購読
const useRoomState = () => {
  // roomStateイベントの購読と状態更新
};

// useGameState: ゲーム状態の購読
const useGameState = () => {
  // gameStateイベントの購読と状態更新
};

// useReconnect: 再接続ロジック
const useReconnect = () => {
  // 切断検知と再接続処理
};
```

### UI/UX設計

#### レスポンシブデザイン
- モバイル優先（Mobile First）
- ブレークポイント: 640px, 768px, 1024px
- タッチ対応（最小タップエリア: 44x44px）

#### アクセシビリティ
- キーボード操作対応
- ARIAラベル適用
- カラーコントラスト確保（WCAG AA準拠）

#### インタラクション
- ボタン連打防止（ローカルロック）
- ローディング状態の表示
- エラーメッセージの表示
- タイムバンク可視化

---

## バックエンド設計

### ディレクトリ構造

```
/server
  /src
    /api
      routes.ts
      roomController.ts
    /game
      GameManager.ts
      Room.ts
      Round.ts
      Deck.ts
      HandEvaluator.ts
      PotCalculator.ts
    /socket
      socketHandler.ts
      eventHandlers.ts
    /models
      Player.ts
      Room.ts
      RoundState.ts
    /services
      RedisService.ts
      LoggerService.ts
    /utils
      validation.ts
      constants.ts
    /types
      game.ts
      socket.ts
    app.ts
    server.ts
  /tests
    /unit
    /integration
```

### 主要モジュール設計

#### 1. GameManager（ゲーム管理）
**責務**: ゲーム全体のフロー制御、ルーム管理のファサード
- ルームの生成・削除・検索
- プレイヤーアクションの受付と処理 (`handlePlayerAction`)
- ゲームイベントの生成と返却

```typescript
class GameManager {
  private rooms: Map<string, Room>;

  createRoom(hostName: string, smallBlind: number, bigBlind: number): { room: Room; host: Player };
  getRoom(roomId: string): Room | undefined;
  handlePlayerAction(roomId: string, playerId: string, action: ActionType, amount?: number): GameActionResult;
}
```

#### 2. Room（ルームクラス）
**責務**: ルーム単位の状態管理、プレイヤー管理、ラウンドライフサイクル
- プレイヤーの入室・退室管理
- ラウンド（Round）の生成と保持
- ルームの状態（待機中、プレイ中など）の管理

```typescript
class Room {
  id: string;
  players: Player[];
  state: RoomState;
  
  addPlayer(playerName: string): Player;
  removePlayer(playerId: string): void;
  startRound(): Round;
  endRound(): void;
  getRound(): Round | undefined;
}
```

#### 3. Round（ラウンドクラス）
**責務**: 1ハンド（局）単位のポーカーロジック
- デッキ管理とカード配布
- ベッティングラウンドの進行管理
- 勝敗判定とポット分配

```typescript
class Round {
  stage: RoundStage;
  deck: Deck;
  communityCards: string[];

  executeAction(playerId: string, action: ActionType, amount?: number): void;
  advanceRound(): void;
  performShowdown(): void;
}
```

#### 4. SocketHandler（通信層）
**責務**: クライアントとの通信、イベントの振り分け
- Socket.ioイベントの受信
- GameManagerへの処理委譲
- GameManagerから返されたイベント（GameEvent）のクライアントへの通知
- 自動フォールドなどのタイマー管理

```typescript
// イベント駆動型アーキテクチャ
const processGameEvents = (roomId: string, events: GameEvent[]) => {
  // イベント種別に応じてクライアントに通知
  // 必要に応じて遅延処理（ショーダウン後の待機など）
};
```

#### 4. Deck（デッキクラス）
**責務**: デッキ管理、シャッフル、カード配布

```typescript
class Deck {
  private cards: string[];

  shuffle(): void;
  deal(count: number): string[];
  serialize(): string;
  static deserialize(data: string): Deck;
}
```

**シャッフルアルゴリズム**: Fisher-Yates シャッフル

```typescript
shuffle(): void {
  for (let i = this.cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
  }
}
```

#### 5. HandEvaluator（役判定）
**責務**: ポーカーハンドの評価と比較

```typescript
class HandEvaluator {
  static evaluate(cards: string[]): HandRank;
  static compare(hand1: HandRank, hand2: HandRank): number;
  static getBestHand(holeCards: string[], communityCards: string[]): HandRank;
}
```

**実装方針**:
- 既存ライブラリの使用を推奨（例: pokersolver）
- または自作の場合、厳密なテストを実施

#### 6. PotCalculator（ポット計算）
**責務**: メインポットとサイドポットの計算

```typescript
class PotCalculator {
  static calculate(bets: Map<playerId, number>, folded: Set<playerId>): Pot[];
  static distribute(pots: Pot[], winners: Map<potIndex, playerId[]>): Map<playerId, number>;
}
```

**サイドポット計算アルゴリズム**:
1. 各プレイヤーのベット額を集計
2. 最小ベット毎に分割
3. 各ポットに参加可能なプレイヤーを記録

---

## ゲームロジック設計

### ゲームフロー

```
┌─────────────────┐
│  ルーム作成/参加  │
│   (待機状態)     │
└────────┬────────┘
         │
         │ ホストがゲーム開始
         │
┌────────▼────────┐
│  ラウンド開始    │
│  - ディーラー決定 │
│  - ブラインド徴収 │
└────────┬────────┘
         │
┌────────▼────────┐
│  デッキ生成      │
│  シャッフル      │
└────────┬────────┘
         │
┌────────▼────────┐
│ ホールカード配布  │
│ (個別送信)       │
└────────┬────────┘
         │
┌────────▼────────────┐
│  プリフロップ        │
│  ベッティングラウンド │
└────────┬────────────┘
         │
┌────────▼────────────┐
│  フロップ (3枚)     │
│  ベッティングラウンド │
└────────┬────────────┘
         │
┌────────▼────────────┐
│  ターン (1枚)       │
│  ベッティングラウンド │
└────────┬────────────┘
         │
┌────────▼────────────┐
│  リバー (1枚)       │
│  ベッティングラウンド │
└────────┬────────────┘
         │
┌────────▼────────┐
│  ショーダウン     │
│  - 役判定        │
│  - ポット配分     │
└────────┬────────┘
         │
┌────────▼────────┐
│  結果通知        │
│  次ラウンド準備   │
└─────────────────┘
```

### ステートマシン

#### Room State
```
waiting → in_progress → finished
   ↑________________________|
```

#### Round Stage
```
preflop → flop → turn → river → showdown → end
   ↑_______________________________________________|
```

### ベッティングラウンドロジック

```typescript
class BettingRound {
  private currentPlayerIndex: number;
  private currentBet: number;
  private bets: Map<string, number>;
  private folded: Set<string>;

  handleAction(playerId: string, action: Action): BettingRoundResult {
    // 1. アクションのバリデーション
    if (!this.isValidAction(playerId, action)) {
      throw new Error('Invalid action');
    }

    // 2. アクション実行
    switch (action.type) {
      case 'fold':
        this.folded.add(playerId);
        break;
      case 'check':
        // チェック可能な状況か確認
        break;
      case 'call':
        this.bets.set(playerId, this.currentBet);
        break;
      case 'bet':
      case 'raise':
        this.currentBet = action.amount;
        this.bets.set(playerId, action.amount);
        break;
    }

    // 3. 次のプレイヤーへ
    this.advanceToNextPlayer();

    // 4. ラウンド終了判定
    if (this.isRoundComplete()) {
      return { complete: true };
    }

    return { complete: false, nextPlayerIndex: this.currentPlayerIndex };
  }

  private isRoundComplete(): boolean {
    // 全員がアクション完了、または1人以外全員フォールド
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 1) return true;

    // 全員が同額ベット
    return activePlayers.every(p =>
      this.bets.get(p) === this.currentBet
    );
  }
}
```

### タイムアウト処理

```typescript
class TurnTimer {
  private timeout: NodeJS.Timeout | null = null;

  start(playerId: string, duration: number, onTimeout: () => void): void {
    this.timeout = setTimeout(() => {
      // タイムアウト時の自動処理
      onTimeout();
    }, duration);
  }

  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
```

**タイムアウト時の自動アクション**:
- チェック可能な場合: 自動チェック
- それ以外: 自動フォールド

---

## 通信設計

### WebSocketイベントフロー

#### ゲーム開始フロー

```
Client (Host)          Server              Client (Others)
    │                    │                      │
    │──startGame────────>│                      │
    │                    │                      │
    │                    │──roomState──────────>│
    │<──roomState────────│                      │
    │                    │                      │
    │                    │──privateHand────────>│ (個別)
    │<──privateHand──────│ (個別)               │
    │                    │                      │
    │                    │──gameState──────────>│
    │<──gameState────────│                      │
    │                    │                      │
    │                    │──playerActionRequest─>│ (該当者のみ)
```

#### アクション実行フロー

```
Client                 Server              All Clients
    │                    │                      │
    │──action───────────>│                      │
    │                    │                      │
    │                    │ [検証・実行]          │
    │                    │                      │
    │                    │──actionResult───────>│ (broadcast)
    │<──actionResult─────│                      │
    │                    │                      │
    │                    │──gameState──────────>│ (broadcast)
    │<──gameState────────│                      │
    │                    │                      │
    │                    │──playerActionRequest─>│ (次のプレイヤー)
```

#### 再接続フロー

```
Client                 Server
    │                    │
    │──reconnectRequest─>│
    │                    │
    │                    │ [セッション検証]
    │                    │
    │<──roomState────────│
    │<──gameState────────│
    │<──privateHand──────│ (個別)
```

### イベントハンドラ実装

```typescript
// server/src/socket/socketHandler.ts
export const setupSocketHandlers = (io: Server, gameManager: GameManager) => {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('joinRoom', (data: JoinRoomData) => {
      handleJoinRoom(socket, gameManager, data);
    });

    socket.on('startGame', (data: StartGameData) => {
      handleStartGame(socket, gameManager, data);
    });

    socket.on('action', (data: ActionData) => {
      handleAction(socket, gameManager, data);
    });

    socket.on('disconnect', () => {
      handleDisconnect(socket, gameManager);
    });
  });
};
```

---

## データフロー

### クライアント側データフロー

```
Socket Event → Context → State Update → Component Re-render
```

### サーバ側データフロー

```
Socket Event → Validation → Game Logic → State Update → Broadcast
```

---

## インフラ設計

### デプロイ構成

#### 開発環境
```
Frontend: localhost:5173 (Vite dev server)
Backend:  localhost:3000 (Node.js)
Redis:    localhost:6379 (Docker)
```

#### 本番環境
```
Frontend: Vercel (CDN配信)
Backend:  Render/Fly.io (WebSocket対応)
Redis:    Upstash Redis (Managed)
```

### スケーリング戦略

#### 水平スケール（将来的）

```
Load Balancer (Sticky Session)
       │
   ┌───┴───┬───────┬───────┐
   │       │       │       │
Node-1  Node-2  Node-3  Node-N
   │       │       │       │
   └───┬───┴───┬───┴───┬───┘
       │       │       │
    Redis (Pub/Sub + State)
```

**Socket.io Redis Adapter使用**:
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### 監視・ロギング

#### ログレベル
- **ERROR**: システムエラー、例外
- **WARN**: 異常なアクション、タイムアウト
- **INFO**: ゲーム開始/終了、重要イベント
- **DEBUG**: 詳細なゲームフロー（開発時のみ）

#### 監視項目
- サーバCPU/メモリ使用率
- WebSocket接続数
- アクティブルーム数
- 平均レスポンスタイム
- エラー発生率

---

## セキュリティ・チート対策

### 実装方針

#### 1. サーバサイド検証
```typescript
// すべてのアクションをサーバ側で検証
function validateAction(player: Player, action: Action, gameState: GameState): boolean {
  // プレイヤーのターンか確認
  if (gameState.currentPlayerIndex !== player.index) {
    return false;
  }

  // アクションが許可されているか確認
  const allowedActions = getAllowedActions(player, gameState);
  if (!allowedActions.includes(action.type)) {
    return false;
  }

  // ベット額の妥当性確認
  if (action.type === 'bet' || action.type === 'raise') {
    if (action.amount > player.chips || action.amount < gameState.minBet) {
      return false;
    }
  }

  return true;
}
```

#### 2. カード情報の保護
```typescript
// privateHandは個別送信のみ
socket.to(playerId).emit('privateHand', {
  playerId,
  cards: player.holeCards
});

// 他のプレイヤーにはカード情報を送信しない
const publicPlayerState = players.map(p => ({
  id: p.id,
  name: p.name,
  chips: p.chips,
  // holeCardsは含めない
}));
```

#### 3. 再接続認証
```typescript
// プレイヤーIDをローカルストレージに保存
localStorage.setItem('playerId', playerId);

// 再接続時に検証
socket.on('reconnectRequest', ({ roomId, playerId }) => {
  const room = gameManager.getRoom(roomId);
  const player = room.getPlayer(playerId);

  if (!player || player.lastSeen < Date.now() - GRACE_PERIOD) {
    socket.emit('error', { message: 'Reconnection failed' });
    return;
  }

  player.socketId = socket.id;
  player.connected = true;
});
```

#### 4. レート制限
```typescript
// 連続アクション防止
const actionRateLimiter = new Map<string, number>();

function checkRateLimit(playerId: string): boolean {
  const lastAction = actionRateLimiter.get(playerId) || 0;
  const now = Date.now();

  if (now - lastAction < MIN_ACTION_INTERVAL) {
    return false;
  }

  actionRateLimiter.set(playerId, now);
  return true;
}
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-18 | 1.0 | 初版作成 |
