# FF Poker - 設計書 (v2.0)

**作成日**: 2025-12-02
**バージョン**: 2.0
**ステータス**: Draft

---

## 目次

1. [システムアーキテクチャ](#1-システムアーキテクチャ)
2. [game_engine設計](#2-game_engine設計)
3. [Server側設計](#3-server側設計)
4. [Client側設計](#4-client側設計)
5. [通信プロトコル](#5-通信プロトコル)
6. [データモデル](#6-データモデル)
7. [テスト戦略](#7-テスト戦略)
8. [セキュリティ設計](#8-セキュリティ設計)
9. [パフォーマンス最適化](#9-パフォーマンス最適化)

---

## 1. システムアーキテクチャ

### 1.1 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (React)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   UI Layer  │  │ State Layer  │  │  Socket Client   │   │
│  │ (Components)│─▶│ (Context API)│─▶│   (Socket.io)    │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└────────────────────────────────┬────────────────────────────┘
                                 │ WebSocket
                                 │ (Socket.io)
┌────────────────────────────────▼────────────────────────────┐
│                       Server (Node.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │Socket Handler│─▶│ Room Manager │─▶│   game_engine    │  │
│  │  (Events)    │  │  (Stateful)  │  │   (Stateless)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Session    │  │Turn Timer    │  │     Logger       │  │
│  │   Manager    │  │   Manager    │  │   (winston)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 1.2 レイヤー責務

| レイヤー | 責務 | Stateful/Stateless |
|---------|------|--------------------|
| **Client UI** | ユーザーインタラクション、表示 | Stateful |
| **Client State** | ゲーム状態管理、楽観的更新 | Stateful |
| **Socket Client** | WebSocket通信 | Stateless |
| **Socket Handler** | イベント受信・送信 | Stateless |
| **Room Manager** | ルーム・プレイヤー管理 | Stateful |
| **game_engine** | ゲームロジック(純粋関数) | **Stateless** |
| **Session Manager** | 再接続セッション管理 | Stateful |
| **Turn Timer** | ターンタイムアウト管理 | Stateful |
| **Logger** | ロギング | Stateless |

---

## 2. game_engine設計

### 2.1 コンセプト

**game_engine** は、ゲームロジックを司る**純粋関数の集合**として設計する。

**設計原則**:
1. **Stateless**: 状態を保持しない
2. **Pure Functions**: `(currentState, action) → nextState`
3. **Testable**: 副作用がないため、unit testが容易
4. **Deterministic**: 同じ入力は常に同じ出力

### 2.2 game_engineの責務範囲

**含む**:
- ベッティングロジック(fold, check, call, bet, raise, allin)
- ベッティング完了判定
- ストリート進行(preflop → flop → turn → river → showdown)
- 役判定(HandEvaluator)
- ポット・サイドポット計算(PotCalculator)
- デッキ管理・カード配布
- 勝者決定

**含まない**:
- Room管理(プレイヤー追加/削除、ルーム作成)
- Socket.io送信
- タイマー管理
- ロギング
- セッション管理

### 2.3 game_engine API設計

#### 型定義

```typescript
// ゲーム状態
type GameState = {
  // ラウンド情報
  roundId: string;
  stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

  // プレイヤー情報
  players: PlayerState[];
  dealerIndex: number;
  currentBettorIndex: number;

  // カード情報
  deck: string[];  // 残りのカード
  communityCards: string[];
  playerHands: Record<string, [string, string]>;  // playerId → hand

  // ベッティング情報
  pot: number;
  playerBets: Record<string, number>;  // 現在ストリートのベット額
  cumulativeBets: Record<string, number>;  // 全ストリート合計
  currentBet: number;  // 現在のベット額
  minRaiseAmount: number;

  // プレイヤー状態
  folded: Set<string>;  // playerId
  allIn: Set<string>;  // playerId
  hasActed: Set<string>;  // playerId

  // ブラインド情報
  smallBlind: number;
  bigBlind: number;
  smallBlindPlayerId: string;
  bigBlindPlayerId: string;
};

type PlayerState = {
  id: string;
  name: string;
  chips: number;
  seat: number;
};

// アクション定義
type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number }
  | { type: 'allin' };

// game_engine結果
type GameEngineResult = {
  nextState: GameState;
  events: GameEvent[];
};

type GameEvent =
  | { type: 'actionPerformed'; playerId: string; action: PlayerAction; newPot: number }
  | { type: 'turnChanged'; playerId: string; validActions: string[] }
  | { type: 'streetChanged'; stage: string; communityCards: string[] }
  | { type: 'showdown'; winners: Winner[]; sidePots: SidePot[] }
  | { type: 'roundEnded'; winners: Winner[] };

type Winner = {
  playerId: string;
  amount: number;
  hand?: {
    rank: number;
    name: string;
    cards: string[];
  };
};

type SidePot = {
  amount: number;
  eligiblePlayers: string[];
};
```

#### 主要関数

```typescript
// ラウンド開始
function startRound(params: {
  players: PlayerState[];
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
}): GameEngineResult;

// アクション実行
function executeAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): GameEngineResult;

// ベッティング完了判定
function isBettingComplete(state: GameState): boolean;

// 次のストリートへ進行
function advanceStreet(state: GameState): GameEngineResult;

// ショーダウン実行
function performShowdown(state: GameState): GameEngineResult;

// 有効なアクション取得
function getValidActions(state: GameState, playerId: string): string[];
```

### 2.4 game_engineの実装構成

```
server/src/game_engine/
├── index.ts              # 主要関数のエクスポート
├── state.ts              # GameState型定義
├── actions.ts            # executeAction実装
├── betting.ts            # ベッティングロジック
├── street.ts             # ストリート進行
├── showdown.ts           # ショーダウン処理
├── hand-evaluator.ts     # 役判定(pokersolver wrapper)
├── pot-calculator.ts     # ポット計算
├── deck.ts               # デッキ管理
└── utils.ts              # ユーティリティ関数
```

---

## 3. Server側設計

### 3.1 ディレクトリ構成

#### Server (server/)

```
server/
├── src/
│   ├── game_engine/           # ゲームロジック(stateless)
│   │   ├── index.ts           # 主要関数エクスポート
│   │   ├── state.ts           # GameState型定義
│   │   ├── actions.ts         # executeAction実装
│   │   ├── betting.ts         # ベッティングロジック
│   │   ├── street.ts          # ストリート進行
│   │   ├── showdown.ts        # ショーダウン処理
│   │   ├── hand-evaluator.ts  # 役判定 (pokersolver wrapper)
│   │   ├── pot-calculator.ts  # ポット・サイドポット計算
│   │   ├── deck.ts            # デッキ管理 (Fisher-Yates)
│   │   └── utils.ts           # ユーティリティ関数
│   │
│   ├── room/                  # Room管理(stateful)
│   │   ├── RoomManager.ts     # 複数ルーム管理
│   │   └── Room.ts            # 単一ルーム状態管理
│   │
│   ├── socket/                # WebSocket通信層
│   │   └── socketHandler.ts   # Socket.ioイベントハンドラ
│   │
│   ├── services/              # サービス層
│   │   ├── SessionManager.ts  # セッション管理 (120秒グレースピリオド)
│   │   ├── TurnTimerManager.ts # ターンタイムアウト (60秒)
│   │   └── LoggerService.ts   # winston統合ロギング
│   │
│   ├── types/                 # 型定義
│   │   ├── socket.ts          # Socket.io関連型
│   │   └── errors.ts          # エラー型 (GameError, ValidationError, TurnError)
│   │
│   ├── utils/                 # ユーティリティ
│   │   ├── constants.ts       # 定数定義 (MAX_PLAYERS, DEFAULT_CHIPS等)
│   │   └── validation.ts      # 入力バリデーション (XSS対策)
│   │
│   ├── app.ts                 # Express設定
│   └── server.ts              # サーバー起動エントリー
│
├── test/
│   ├── unit/                  # 単体テスト (カバレッジ 80%以上)
│   │   ├── game_engine/
│   │   │   ├── actions.test.ts
│   │   │   ├── betting.test.ts
│   │   │   ├── street.test.ts
│   │   │   ├── showdown.test.ts
│   │   │   ├── hand-evaluator.test.ts
│   │   │   ├── pot-calculator.test.ts
│   │   │   └── deck.test.ts
│   │   ├── room/
│   │   │   ├── RoomManager.test.ts
│   │   │   └── Room.test.ts
│   │   └── services/
│   │       ├── SessionManager.test.ts
│   │       ├── TurnTimerManager.test.ts
│   │       └── LoggerService.test.ts
│   │
│   └── integration/           # 統合テスト (カバレッジ 70%以上)
│       ├── game-flow.test.ts  # 完全ゲームフロー
│       ├── reconnect.test.ts  # 再接続シナリオ
│       └── socketHandler.test.ts # Socket.ioイベント
│
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.js
├── nodemon.json
├── .eslintrc.json
├── .prettierrc.json
├── .env.example
└── .gitignore
```

#### Client (client/)

```
client/
├── src/
│   ├── components/            # Reactコンポーネント
│   │   ├── Lobby.tsx          # ルーム作成・参加画面
│   │   ├── Room.tsx           # ゲームルーム主画面
│   │   ├── Card.tsx           # トランプカード表示 (SVG)
│   │   ├── PlayerInfo.tsx     # プレイヤー情報表示
│   │   └── ActionButtons.tsx  # アクションボタン
│   │
│   ├── contexts/              # Context API
│   │   ├── SocketContext.tsx  # Socket.io接続管理
│   │   └── GameContext.tsx    # ゲーム状態管理 (useReducer)
│   │
│   ├── hooks/                 # カスタムフック
│   │   ├── useOptimisticUpdate.ts # 楽観的更新ロジック
│   │   └── useGameActions.ts  # アクション送信・ロールバック
│   │
│   ├── types/                 # 型定義
│   │   └── game.ts            # ゲーム関連型
│   │
│   ├── utils/                 # ユーティリティ
│   │   └── card-utils.ts      # カード関連ユーティリティ
│   │
│   ├── main.tsx               # Viteエントリー
│   ├── App.tsx                # ルーティング定義
│   └── test-setup.ts          # テストセットアップ
│
├── test/
│   ├── unit/                  # 単体テスト (カバレッジ 70%以上)
│   │   ├── components/
│   │   │   ├── Lobby.test.tsx
│   │   │   ├── Room.test.tsx
│   │   │   ├── Card.test.tsx
│   │   │   └── ActionButtons.test.tsx
│   │   └── hooks/
│   │       ├── useOptimisticUpdate.test.ts
│   │       └── useGameActions.test.ts
│   │
│   ├── integration/           # 統合テスト (カバレッジ 60%以上)
│   │   └── game-flow.test.tsx # Socket通信 + State管理
│   │
│   └── e2e/                   # E2Eテスト (Playwright)
│       └── two-player-game.spec.ts # 2人ゲームシナリオ
│
├── public/                    # 静的ファイル
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
├── .prettierrc.json
├── .env.example
└── .gitignore
```

### 3.2 Room管理設計

#### RoomManager

**責務**: 複数ルームの管理

```typescript
class RoomManager {
  private rooms: Map<string, Room> = new Map();

  // ルーム作成
  createRoom(hostName: string, smallBlind: number, bigBlind: number): {
    roomId: string;
    hostPlayerId: string;
  };

  // ルーム取得
  getRoom(roomId: string): Room | undefined;

  // ルーム削除
  deleteRoom(roomId: string): void;

  // プレイヤー追加
  addPlayer(roomId: string, playerName: string): {
    playerId: string;
    seat: number;
  };
}
```

#### Room

**責務**: 単一ルームの状態管理、game_engineとの橋渡し

```typescript
class Room {
  id: string;
  hostId: string;
  players: PlayerState[];
  state: 'waiting' | 'in_progress' | 'finished';
  smallBlind: number;
  bigBlind: number;
  dealerIndex: number;

  // 現在のゲーム状態(game_engineから返却されたもの)
  currentGameState: GameState | null;

  // プレイヤー追加
  addPlayer(name: string, playerId?: string): PlayerState;

  // ゲーム開始
  startGame(): GameEngineResult;

  // アクション実行(game_engineに委譲)
  executeAction(playerId: string, action: PlayerAction): GameEngineResult;

  // ゲーム状態取得
  getGameState(): GameState | null;

  // ラウンド終了
  endRound(): void;
}
```

**Room.startGame()の実装例**:

```typescript
startGame(): GameEngineResult {
  if (this.players.length < 2) {
    throw new Error('At least 2 players required');
  }

  // game_engineにラウンド開始を依頼
  const result = gameEngine.startRound({
    players: this.players,
    dealerIndex: this.dealerIndex,
    smallBlind: this.smallBlind,
    bigBlind: this.bigBlind,
  });

  // ゲーム状態を保存
  this.currentGameState = result.nextState;
  this.state = 'in_progress';

  return result;
}
```

**Room.executeAction()の実装例**:

```typescript
executeAction(playerId: string, action: PlayerAction): GameEngineResult {
  if (!this.currentGameState) {
    throw new Error('Game not started');
  }

  // game_engineにアクション実行を依頼
  const result = gameEngine.executeAction(
    this.currentGameState,
    playerId,
    action
  );

  // ゲーム状態を更新
  this.currentGameState = result.nextState;

  // ショーダウン終了判定
  if (result.nextState.stage === 'showdown' && /* 終了条件 */) {
    this.endRound();
  }

  return result;
}
```

### 3.3 Socket Handler設計

**責務**: WebSocketイベントの受信・送信、Room/game_engineとの橋渡し

```typescript
// socketHandler.ts
export function setupSocketHandlers(io: Server, roomManager: RoomManager) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ルーム作成
    socket.on('createRoom', (data) => {
      try {
        const { hostName, smallBlind, bigBlind } = validateCreateRoomData(data);

        const { roomId, hostPlayerId } = roomManager.createRoom(
          hostName,
          smallBlind,
          bigBlind
        );

        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerId: hostPlayerId });

        logger.info('Room created', { roomId, hostPlayerId });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // ルーム参加
    socket.on('joinRoom', (data) => {
      try {
        const { roomId, playerName } = validateJoinRoomData(data);

        const { playerId, seat } = roomManager.addPlayer(roomId, playerName);

        socket.join(roomId);
        socket.emit('joinedRoom', { roomId, playerId, seat });

        // 他プレイヤーに通知
        socket.to(roomId).emit('playerJoined', { playerId, playerName, seat });

        logger.info('Player joined', { roomId, playerId });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // ゲーム開始
    socket.on('startGame', (data) => {
      try {
        const { roomId } = data;
        const room = roomManager.getRoom(roomId);

        if (!room) throw new Error('Room not found');

        const result = room.startGame();

        // イベント処理
        processGameEvents(io, roomId, result.events);

        // 手札配布(個別送信)
        dealHandsToPlayers(io, roomId, result.nextState);

        // 全体にstateUpdated送信
        broadcastStateUpdate(io, roomId, result.nextState);

        logger.info('Game started', { roomId });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // プレイヤーアクション
    socket.on('action', (data) => {
      try {
        const { roomId, playerId, action } = validateActionData(data);

        const room = roomManager.getRoom(roomId);
        if (!room) throw new Error('Room not found');

        const result = room.executeAction(playerId, action);

        // アクション実行者にレスポンス
        socket.emit('actionResponse', { success: true });

        // イベント処理
        processGameEvents(io, roomId, result.events);

        // 全体にstateUpdated送信
        broadcastStateUpdate(io, roomId, result.nextState);

        logger.info('Action performed', { roomId, playerId, action });
      } catch (error) {
        socket.emit('actionResponse', { success: false, error: error.message });
      }
    });

    // 切断
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });
}

// イベント処理
function processGameEvents(io: Server, roomId: string, events: GameEvent[]) {
  for (const event of events) {
    switch (event.type) {
      case 'actionPerformed':
        // 必要に応じて個別通知
        break;
      case 'turnChanged':
        // ターンタイマー開始
        turnTimerManager.startTimer(roomId, event.playerId);
        break;
      case 'streetChanged':
        // 特に何もしない(stateUpdatedに含まれる)
        break;
      case 'showdown':
      case 'roundEnded':
        // ターンタイマー停止
        turnTimerManager.stopTimer(roomId);
        break;
    }
  }
}

// 全体への状態更新
function broadcastStateUpdate(io: Server, roomId: string, state: GameState) {
  const publicState = {
    stage: state.stage,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      seat: p.seat,
    })),
    dealerIndex: state.dealerIndex,
    currentBettorId: state.players[state.currentBettorIndex]?.id,
    pot: state.pot,
    communityCards: state.communityCards,
    playerBets: state.playerBets,
    folded: Array.from(state.folded),
    allIn: Array.from(state.allIn),
  };

  io.to(roomId).emit('stateUpdated', publicState);
}

// 手札配布(個別送信)
function dealHandsToPlayers(io: Server, roomId: string, state: GameState) {
  for (const [playerId, hand] of Object.entries(state.playerHands)) {
    const sockets = io.sockets.sockets;
    for (const [socketId, socket] of sockets.entries()) {
      // playerIdとsocketIdのマッピングが必要(SessionManager経由)
      if (sessionManager.getSocketId(playerId) === socketId) {
        socket.emit('dealHand', { playerId, hand });
      }
    }
  }
}
```

---

## 4. Client側設計

### 4.1 ディレクトリ構成

```
client/
├── src/
│   ├── components/       # Reactコンポーネント
│   │   ├── Lobby.tsx
│   │   ├── Room.tsx
│   │   ├── Card.tsx
│   │   ├── PlayerInfo.tsx
│   │   └── ActionButtons.tsx
│   ├── contexts/         # Context API
│   │   ├── SocketContext.tsx
│   │   └── GameContext.tsx
│   ├── hooks/            # カスタムフック
│   │   ├── useOptimisticUpdate.ts
│   │   └── useGameActions.ts
│   ├── types/            # 型定義
│   │   └── game.ts
│   ├── utils/            # ユーティリティ
│   │   └── card-utils.ts
│   ├── main.tsx
│   └── App.tsx
├── test/
│   ├── unit/             # 単体テスト
│   │   ├── components/
│   │   └── hooks/
│   ├── integration/      # 統合テスト(WebSocketモック)
│   │   └── game-flow.test.tsx
│   └── e2e/              # E2Eテスト(Playwright)
│       └── two-player-game.spec.ts
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

### 4.2 GameContext設計

**責務**: ゲーム状態管理、楽観的更新

```typescript
// GameContext.tsx
type GameState = {
  roomId: string | null;
  playerId: string | null;
  players: Player[];
  dealerIndex: number;
  currentBettorId: string | null;
  pot: number;
  communityCards: string[];
  myHand: [string, string] | null;
  stage: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  playerBets: Record<string, number>;
  folded: string[];
  allIn: string[];
  validActions: string[];

  // 楽観的更新用
  pendingAction: PlayerAction | null;
  optimisticState: Partial<GameState> | null;
};

type Player = {
  id: string;
  name: string;
  chips: number;
  seat: number;
};

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}>({} as any);

type GameAction =
  | { type: 'SET_ROOM_ID'; roomId: string }
  | { type: 'SET_PLAYER_ID'; playerId: string }
  | { type: 'STATE_UPDATED'; payload: Partial<GameState> }
  | { type: 'DEAL_HAND'; hand: [string, string] }
  | { type: 'OPTIMISTIC_ACTION'; action: PlayerAction; optimisticState: Partial<GameState> }
  | { type: 'CONFIRM_ACTION' }
  | { type: 'ROLLBACK_ACTION' }
  | { type: 'RESET' };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_ROOM_ID':
      return { ...state, roomId: action.roomId };

    case 'SET_PLAYER_ID':
      return { ...state, playerId: action.playerId };

    case 'STATE_UPDATED':
      return {
        ...state,
        ...action.payload,
        pendingAction: null,
        optimisticState: null,
      };

    case 'DEAL_HAND':
      return { ...state, myHand: action.hand };

    case 'OPTIMISTIC_ACTION':
      return {
        ...state,
        pendingAction: action.action,
        optimisticState: action.optimisticState,
        // 楽観的更新を即座に反映
        ...action.optimisticState,
      };

    case 'CONFIRM_ACTION':
      return {
        ...state,
        pendingAction: null,
        optimisticState: null,
      };

    case 'ROLLBACK_ACTION':
      // optimisticStateを破棄して元に戻す
      if (state.optimisticState) {
        const { pendingAction, optimisticState, ...cleanState } = state;
        return cleanState as GameState;
      }
      return state;

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
```

### 4.3 楽観的更新の実装

```typescript
// useGameActions.ts
export function useGameActions() {
  const { socket } = useSocket();
  const { state, dispatch } = useGame();

  const performAction = useCallback((action: PlayerAction) => {
    if (!socket || !state.roomId || !state.playerId) return;

    // 楽観的更新用の予測状態を計算
    const optimisticState = calculateOptimisticState(state, action);

    // 即座にUI更新
    dispatch({
      type: 'OPTIMISTIC_ACTION',
      action,
      optimisticState,
    });

    // サーバーにアクション送信
    socket.emit('action', {
      roomId: state.roomId,
      playerId: state.playerId,
      action,
    });

    // レスポンス待機(タイムアウト付き)
    socket.once('actionResponse', (response) => {
      if (response.success) {
        dispatch({ type: 'CONFIRM_ACTION' });
      } else {
        // エラー時はロールバック
        dispatch({ type: 'ROLLBACK_ACTION' });
        alert(response.error);
      }
    });
  }, [socket, state, dispatch]);

  return { performAction };
}

// 楽観的更新の予測ロジック
function calculateOptimisticState(
  state: GameState,
  action: PlayerAction
): Partial<GameState> {
  switch (action.type) {
    case 'fold':
      return {
        folded: [...state.folded, state.playerId!],
        currentBettorId: getNextBettorId(state),
      };

    case 'call':
      const callAmount = state.currentBet - (state.playerBets[state.playerId!] || 0);
      return {
        playerBets: {
          ...state.playerBets,
          [state.playerId!]: state.currentBet,
        },
        players: state.players.map(p =>
          p.id === state.playerId
            ? { ...p, chips: p.chips - callAmount }
            : p
        ),
        pot: state.pot + callAmount,
        currentBettorId: getNextBettorId(state),
      };

    // 他のアクションも同様
    default:
      return {};
  }
}
```

### 4.4 Room Component設計

```typescript
// Room.tsx
export function Room() {
  const { socket } = useSocket();
  const { state, dispatch } = useGame();
  const { performAction } = useGameActions();

  // Socket.ioイベントリスナー
  useEffect(() => {
    if (!socket) return;

    // ゲーム状態更新
    socket.on('stateUpdated', (payload) => {
      dispatch({ type: 'STATE_UPDATED', payload });
    });

    // 手札配布
    socket.on('dealHand', ({ hand }) => {
      dispatch({ type: 'DEAL_HAND', hand });
    });

    return () => {
      socket.off('stateUpdated');
      socket.off('dealHand');
    };
  }, [socket, dispatch]);

  // アクション実行
  const handleAction = (action: PlayerAction) => {
    performAction(action);
  };

  return (
    <div className="room">
      <CommunityCards cards={state.communityCards} />
      <Pot amount={state.pot} />

      {state.players.map((player) => (
        <PlayerInfo
          key={player.id}
          player={player}
          isDealer={state.players[state.dealerIndex]?.id === player.id}
          isCurrentBettor={state.currentBettorId === player.id}
          isFolded={state.folded.includes(player.id)}
          bet={state.playerBets[player.id] || 0}
        />
      ))}

      {state.myHand && (
        <Hand cards={state.myHand} />
      )}

      {state.currentBettorId === state.playerId && (
        <ActionButtons
          validActions={state.validActions}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
```

---

## 5. 通信プロトコル

### 5.1 クライアント → サーバー

| イベント名 | ペイロード | 説明 |
|----------|----------|------|
| `createRoom` | `{ hostName: string, smallBlind: number, bigBlind: number }` | ルーム作成 |
| `joinRoom` | `{ roomId: string, playerName: string }` | ルーム参加 |
| `startGame` | `{ roomId: string }` | ゲーム開始 |
| `action` | `{ roomId: string, playerId: string, action: PlayerAction }` | プレイヤーアクション |
| `reconnectRequest` | `{ roomId: string, playerId: string }` | 再接続要求 |

### 5.2 サーバー → クライアント

| イベント名 | ペイロード | 説明 | 送信方法 |
|----------|----------|------|---------|
| `roomCreated` | `{ roomId: string, playerId: string }` | ルーム作成完了 | 個別 |
| `joinedRoom` | `{ roomId: string, playerId: string, seat: number }` | ルーム参加完了 | 個別 |
| `playerJoined` | `{ playerId: string, playerName: string, seat: number }` | 他プレイヤー参加通知 | ルーム全体 |
| `actionResponse` | `{ success: boolean, error?: string }` | アクションレスポンス | 個別 |
| `stateUpdated` | `PublicGameState` | ゲーム状態更新 | ルーム全体 |
| `dealHand` | `{ playerId: string, hand: [string, string] }` | 手札配布 | **個別** |
| `timerUpdate` | `{ playerId: string, remaining: number, warning: boolean }` | タイマー更新 | ルーム全体 |
| `error` | `{ message: string, code?: string }` | エラー通知 | 個別 |

### 5.3 stateUpdated形式

```typescript
type PublicGameState = {
  stage: string;
  players: {
    id: string;
    name: string;
    chips: number;
    seat: number;
  }[];
  dealerIndex: number;
  currentBettorId: string | null;
  pot: number;
  communityCards: string[];
  playerBets: Record<string, number>;
  folded: string[];
  allIn: string[];
};
```

**注意**: 手札情報は含めない(セキュリティ)

---

## 6. データモデル

### 6.1 GameState(game_engine内部)

```typescript
type GameState = {
  roundId: string;
  stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  players: PlayerState[];
  dealerIndex: number;
  currentBettorIndex: number;
  deck: string[];
  communityCards: string[];
  playerHands: Record<string, [string, string]>;
  pot: number;
  playerBets: Record<string, number>;
  cumulativeBets: Record<string, number>;
  currentBet: number;
  minRaiseAmount: number;
  folded: Set<string>;
  allIn: Set<string>;
  hasActed: Set<string>;
  smallBlind: number;
  bigBlind: number;
  smallBlindPlayerId: string;
  bigBlindPlayerId: string;
};
```

### 6.2 PlayerState

```typescript
type PlayerState = {
  id: string;         // UUID
  name: string;       // 1-20文字
  chips: number;      // 残チップ数
  seat: number;       // 座席番号(0-5)
};
```

### 6.3 Room(RoomManager管理)

```typescript
class Room {
  id: string;                  // ルームID(8文字)
  hostId: string;              // ホストプレイヤーID
  players: PlayerState[];      // プレイヤー一覧
  state: 'waiting' | 'in_progress' | 'finished';
  smallBlind: number;
  bigBlind: number;
  dealerIndex: number;
  currentGameState: GameState | null;
}
```

### 6.4 Session(SessionManager管理)

```typescript
type PlayerSession = {
  playerId: string;
  socketId: string;
  roomId: string;
  lastSeen: number;       // Unix timestamp
  createdAt: number;
};
```

---

## 7. テスト戦略

### 7.1 テストレイヤー構成

| レイヤー | 対象 | ツール | カバレッジ目標 |
|---------|------|-------|--------------|
| **Server Unit** | game_engine, Room, services | Jest | 80% |
| **Server Integration** | socketHandler + Room + game_engine | Jest + socket.io-client | 70% |
| **Client Unit** | コンポーネント, フック | Vitest + React Testing Library | 70% |
| **Client Integration** | Socket通信 + State管理 | Vitest + WebSocketモック | 60% |
| **E2E** | 完全なゲームフロー | Playwright | 主要シナリオ網羅 |

### 7.2 Server Unit Test

**対象**: game_engine各関数

```typescript
// server/test/unit/game_engine/betting.test.ts
describe('executeAction', () => {
  it('should execute fold action', () => {
    const state = createMockGameState();
    const result = executeAction(state, 'player1', { type: 'fold' });

    expect(result.nextState.folded).toContain('player1');
    expect(result.events).toHaveLength(2);
    expect(result.events[0].type).toBe('actionPerformed');
    expect(result.events[1].type).toBe('turnChanged');
  });

  it('should reject action if not player turn', () => {
    const state = createMockGameState({ currentBettorIndex: 1 });

    expect(() => {
      executeAction(state, 'player2', { type: 'fold' });
    }).toThrow('Not your turn');
  });

  it('should handle all-in action', () => {
    const state = createMockGameState();
    const player = state.players[0];

    const result = executeAction(state, player.id, { type: 'allin' });

    expect(result.nextState.allIn).toContain(player.id);
    expect(result.nextState.players[0].chips).toBe(0);
  });
});
```

### 7.3 Server Integration Test

**対象**: socketHandler + Room + game_engine

```typescript
// server/test/integration/game-flow.test.ts
import { io as ioClient } from 'socket.io-client';
import { Server } from 'socket.io';

describe('Game Flow Integration', () => {
  let io: Server;
  let client1: any;
  let client2: any;

  beforeAll(async () => {
    io = await startTestServer();
    client1 = ioClient('http://localhost:3001');
    client2 = ioClient('http://localhost:3001');
  });

  it('should complete a full game round', (done) => {
    let roomId: string;
    let player1Id: string;
    let player2Id: string;

    // ルーム作成
    client1.emit('createRoom', {
      hostName: 'Player1',
      smallBlind: 10,
      bigBlind: 20,
    });

    client1.once('roomCreated', (data) => {
      roomId = data.roomId;
      player1Id = data.playerId;

      // プレイヤー2参加
      client2.emit('joinRoom', { roomId, playerName: 'Player2' });
    });

    client2.once('joinedRoom', (data) => {
      player2Id = data.playerId;

      // ゲーム開始
      client1.emit('startGame', { roomId });
    });

    // 状態更新を待機
    client1.once('stateUpdated', (state) => {
      expect(state.stage).toBe('preflop');
      expect(state.pot).toBeGreaterThan(0);

      done();
    });
  });
});
```

### 7.4 Client Unit Test

**対象**: コンポーネント, カスタムフック

```typescript
// client/test/unit/components/ActionButtons.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionButtons } from '@/components/ActionButtons';

describe('ActionButtons', () => {
  it('should render valid actions', () => {
    const onAction = jest.fn();

    render(
      <ActionButtons
        validActions={['fold', 'call', 'raise']}
        onAction={onAction}
      />
    );

    expect(screen.getByText('Fold')).toBeInTheDocument();
    expect(screen.getByText('Call')).toBeInTheDocument();
    expect(screen.getByText('Raise')).toBeInTheDocument();
  });

  it('should call onAction when button clicked', () => {
    const onAction = jest.fn();

    render(
      <ActionButtons
        validActions={['fold']}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText('Fold'));

    expect(onAction).toHaveBeenCalledWith({ type: 'fold' });
  });
});
```

### 7.5 E2E Test

**対象**: ブラウザ操作による完全なゲームフロー

```typescript
// client/test/e2e/two-player-game.spec.ts
import { test, expect } from '@playwright/test';

test('two players can complete a poker round', async ({ page, context }) => {
  // Player 1: ルーム作成
  await page.goto('http://localhost:5173');
  await page.fill('input[name="hostName"]', 'Alice');
  await page.fill('input[name="smallBlind"]', '10');
  await page.fill('input[name="bigBlind"]', '20');
  await page.click('button:has-text("Create Room")');

  // ルームID取得
  const roomId = await page.locator('[data-testid="room-id"]').textContent();

  // Player 2: 別ブラウザで参加
  const page2 = await context.newPage();
  await page2.goto('http://localhost:5173');
  await page2.fill('input[name="roomId"]', roomId!);
  await page2.fill('input[name="playerName"]', 'Bob');
  await page2.click('button:has-text("Join Room")');

  // ゲーム開始
  await page.click('button:has-text("Start Game")');

  // カード配布確認
  await expect(page.locator('.my-hand')).toBeVisible();
  await expect(page2.locator('.my-hand')).toBeVisible();

  // アクション実行
  await page.click('button:has-text("Call")');
  await page2.click('button:has-text("Call")');

  // フロップ表示確認
  await expect(page.locator('.community-cards')).toHaveCount(3);
});
```

---

## 8. セキュリティ設計

### 8.1 入力バリデーション

#### クライアント側

```typescript
// client/src/utils/validation.ts
export function validatePlayerName(name: string): string {
  // HTMLタグ除去
  const cleaned = name.replace(/<[^>]*>/g, '');

  if (cleaned.length < 1 || cleaned.length > 20) {
    throw new Error('Player name must be 1-20 characters');
  }

  return cleaned;
}

export function validateBetAmount(amount: number, maxChips: number): number {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Bet amount must be a positive integer');
  }

  if (amount > maxChips) {
    throw new Error('Insufficient chips');
  }

  return amount;
}
```

#### サーバー側

```typescript
// server/src/utils/validation.ts
export function validateActionData(data: any): {
  roomId: string;
  playerId: string;
  action: PlayerAction;
} {
  if (!data.roomId || typeof data.roomId !== 'string') {
    throw new Error('Invalid roomId');
  }

  if (!/^[a-zA-Z0-9]{8}$/.test(data.roomId)) {
    throw new Error('Invalid roomId format');
  }

  if (!data.playerId || typeof data.playerId !== 'string') {
    throw new Error('Invalid playerId');
  }

  if (!data.action || typeof data.action !== 'object') {
    throw new Error('Invalid action');
  }

  const validActionTypes = ['fold', 'check', 'call', 'bet', 'raise', 'allin'];
  if (!validActionTypes.includes(data.action.type)) {
    throw new Error('Invalid action type');
  }

  if (['bet', 'raise'].includes(data.action.type)) {
    if (!Number.isInteger(data.action.amount) || data.action.amount <= 0) {
      throw new Error('Invalid bet amount');
    }
  }

  return data as { roomId: string; playerId: string; action: PlayerAction };
}
```

### 8.2 カード情報の保護

**手札配布**: 必ず個別送信

```typescript
// socketHandler.ts
function dealHandsToPlayers(io: Server, roomId: string, state: GameState) {
  for (const [playerId, hand] of Object.entries(state.playerHands)) {
    const socketId = sessionManager.getSocketId(playerId);

    if (socketId) {
      io.to(socketId).emit('dealHand', { playerId, hand });
    }
  }
}
```

**stateUpdated**: 手札情報を含めない

```typescript
function broadcastStateUpdate(io: Server, roomId: string, state: GameState) {
  const publicState = {
    stage: state.stage,
    players: state.players,
    // playerHands は含めない
    // ...
  };

  io.to(roomId).emit('stateUpdated', publicState);
}
```

### 8.3 ターン検証

**game_engine内で検証**:

```typescript
// game_engine/actions.ts
export function executeAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): GameEngineResult {
  // ターン検証
  const currentBettorId = state.players[state.currentBettorIndex]?.id;

  if (playerId !== currentBettorId) {
    throw new Error('Not your turn');
  }

  // アクション実行...
}
```

---

## 9. パフォーマンス最適化

### 9.1 楽観的更新

- アクション送信時に即座にUI更新
- サーバー応答を待たずにUX向上
- エラー時は自動ロールバック

### 9.2 WebSocket接続の最適化

- 再接続ロジックの実装
- 接続状態の監視
- タイムアウト処理

### 9.3 メモリ管理

- 使用済みルームの削除
- セッションの定期クリーンアップ(30秒毎)

### 9.4 将来的な拡張: Redis

- マルチサーバー構成に対応
- `@socket.io/redis-adapter` 使用
- セッション・ゲーム状態の永続化

---

## 10. エラーハンドリング

### 10.1 エラー型定義

```typescript
// server/src/types/errors.ts
export class GameError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'GameError';
  }
}

export class ValidationError extends GameError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class TurnError extends GameError {
  constructor(message: string) {
    super(message, 'TURN_ERROR');
  }
}
```

### 10.2 エラーハンドリングフロー

```typescript
// socketHandler.ts
socket.on('action', (data) => {
  try {
    // バリデーション
    const validated = validateActionData(data);

    // アクション実行
    const result = room.executeAction(validated.playerId, validated.action);

    socket.emit('actionResponse', { success: true });
    broadcastStateUpdate(io, roomId, result.nextState);

  } catch (error) {
    if (error instanceof ValidationError) {
      socket.emit('actionResponse', {
        success: false,
        error: error.message,
      });
    } else if (error instanceof TurnError) {
      socket.emit('actionResponse', {
        success: false,
        error: 'It is not your turn',
      });
    } else {
      logger.error('Unexpected error', error);
      socket.emit('error', { message: 'Internal server error' });
    }
  }
});
```

---

## 11. デプロイメント

### 11.1 環境構成

| 環境 | Client | Server |
|-----|--------|--------|
| 開発 | localhost:5173 | localhost:3001 |
| 本番 | Netlify | Render |

### 11.2 環境変数

**Client** (`.env`):
```bash
VITE_SERVER_URL=http://localhost:3001
```

**Server** (`.env`):
```bash
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
LOG_LEVEL=debug
```

### 11.3 デプロイ設定

**netlify.toml** (Client):
```toml
[build]
  base = "client"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**render.yaml** (Server):
```yaml
services:
  - type: web
    name: ff-poker-server
    env: node
    buildCommand: cd server && npm install && npm run build
    startCommand: cd server && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: CLIENT_URL
        sync: false
```

---

## 12. 変更履歴

| バージョン | 日付 | 変更内容 | 担当者 |
|----------|------|---------|--------|
| 1.0 | 2024-11-19 | 初版作成 | - |
| 2.0 | 2025-12-02 | 大規模設計変更に伴う全面改訂 | - |

---

**Document End**
