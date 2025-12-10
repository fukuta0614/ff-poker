# FF Poker - 設計書 (v2.0)

**作成日**: 2025-12-02
**最終更新**: 2025-12-10
**バージョン**: 2.0
**ステータス**: Implementation Complete (server-v2)

> **重要**: このドキュメントは server-v2/ の実装に基づいています。
>
> **サーバー実装状況**:
> - ✅ Pure Functional Engine (fp-ts): 190テスト, 96%カバレッジ
> - ✅ REST API (OpenAPI 3.0): 完全実装
> - ✅ WebSocket Notifications: 実装済み
> - ✅ Acknowledgment System: 全クライアント同期機能
> - ✅ 統合テスト: 48テスト (273/273 全通過)
>
> **クライアント実装状況**:
> - ⏳ 未実装 (server-v2 API に接続する必要あり)
>
> **参照ドキュメント**:
> - [server-v2/README.md](../server-v2/README.md): サーバー概要
> - [server-v2/ACKNOWLEDGMENT_SYNC_DESIGN.md](../server-v2/ACKNOWLEDGMENT_SYNC_DESIGN.md): Acknowledgment設計書
> - [server-v2/GAME_FLOW_SEQUENCE.md](../server-v2/GAME_FLOW_SEQUENCE.md): ゲームフローシーケンス
> - [server-v2/TEST_SCENARIOS.md](../server-v2/TEST_SCENARIOS.md): テストシナリオ一覧
> - [server-v2/openapi.yaml](../server-v2/openapi.yaml): REST API仕様書

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
│  │   UI Layer  │  │ State Layer  │  │  API Client +    │   │
│  │ (Components)│─▶│ (Context API)│─▶│  Socket Client   │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└────────────────────────────────┬────────────────────────────┘
                                 │ REST API (actions)
                                 │ WebSocket (notifications)
┌────────────────────────────────▼────────────────────────────┐
│                    Server (Node.js + Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │   GameService    │  │
│  │ (OpenAPI 3.0)│  │  (Notifier)  │  │   (Business)     │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬────────┘  │
│         │                 │                     │            │
│         └─────────────────┴─────────────────────┘            │
│                           │                                   │
│                  ┌────────▼──────────┐                       │
│                  │  GameManagerV2    │                       │
│                  │   (Room State)    │                       │
│                  └────────┬──────────┘                       │
│                           │                                   │
│                  ┌────────▼──────────┐                       │
│                  │  Pure Engine      │                       │
│                  │  (fp-ts based)    │                       │
│                  └───────────────────┘                       │
└───────────────────────────────────────────────────────────────┘
```

### 1.2 レイヤー責務

| レイヤー | 責務 | Stateful/Stateless | 備考 |
|---------|------|--------------------| -----|
| **Client UI** | ユーザーインタラクション、表示 | Stateful | React Components |
| **Client State** | ゲーム状態管理、acknowledgment処理 | Stateful | Context API |
| **API Client** | REST API呼び出し | Stateless | axios/fetch |
| **Socket Client** | WebSocket通知受信 | Stateless | Socket.io-client |
| **REST API** | HTTPエンドポイント処理 | Stateless | Express Router |
| **WebSocket Notifier** | リアルタイム通知送信 | Stateless | Socket.io |
| **GameService** | ビジネスロジック調整 | Stateless | Service層 |
| **GameManagerV2** | ルーム・プレイヤー状態管理 | Stateful | Singleton |
| **Engine (Pure)** | ゲームロジック(純粋関数) | **Stateless** | fp-ts/Either |

### 1.3 通信パターン

#### アクション実行フロー
```
Client → REST API POST /api/v1/rooms/:roomId/actions
       → GameService.executeAction()
       → GameManager.updateState()
       → Engine.processAction() [純粋関数]
       → WebSocket broadcast 'room:updated' [全クライアント]
       ← Client receives notification
       ← Client sends acknowledge action
       → Engine resolves acknowledgment
       → WebSocket broadcast 'room:updated' [ready for next]
```

#### Acknowledgment-based Synchronization
すべてのアクションとステージ遷移は、全クライアントが acknowledgment を送信するまで次のステップに進みません。これにより、アニメーション表示やネットワーク遅延に対応した同期を実現します。

詳細は [server-v2/ACKNOWLEDGMENT_SYNC_DESIGN.md](../server-v2/ACKNOWLEDGMENT_SYNC_DESIGN.md) を参照してください。

---

## 2. game_engine設計

### 2.1 コンセプト

**game_engine** は、ゲームロジックを司る**純粋関数の集合**として実装済みです。

**実装済みの特徴**:
1. **完全な不変性**: 全ての状態は `readonly`、副作用なし
2. **fp-ts による型安全**: `Either` でエラーハンドリング、`Option` でnull安全性
3. **100% 型安全**: `any`型は一切使用していません
4. **テスト駆動開発**: 190テスト全通過、カバレッジ96%
5. **決定的な乱数生成**: RNG状態もGameStateに含まれ、完全に再現可能

**設計原則**:
1. **Stateless**: 状態を保持しない
2. **Pure Functions**: `(currentState, action) → Either<GameError, nextState>`
3. **Testable**: 副作用がないため、unit testが容易
4. **Deterministic**: 同じ入力は常に同じ出力

### 2.2 game_engineの責務範囲

**実装済み**:
- ✅ ベッティングロジック(fold, check, call, raise, allin)
- ✅ Acknowledgment システム(全クライアント同期)
- ✅ ベッティング完了判定
- ✅ ステージ進行(preflop → flop → turn → river → showdown)
- ✅ 役判定(pokersolver wrapper)
- ✅ ポット・サイドポット計算
- ✅ デッキ管理・シャッフル(Fisher-Yates)
- ✅ 決定的カード配布(RNG state管理)
- ✅ ショーダウン処理と勝者決定

**含まない**(上位層の責務):
- Room管理(プレイヤー追加/削除、ルーム作成) → GameManagerV2
- HTTP/WebSocket通信 → API/Notifier層
- タイマー管理 → 未実装(TODO)
- ロギング → winston
- セッション管理 → 未実装(TODO)

### 2.3 game_engine API設計

> **実装済み**: 以下の型定義と関数は server-v2/src/engine/ に実装済みです。

#### 型定義 (fp-ts based)

```typescript
import { Option } from 'fp-ts/Option';
import { Either } from 'fp-ts/Either';

// 基本型
export type PlayerId = string;
export type Card = string; // "As", "Kh" など
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'acknowledge';
export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

// プレイヤー型
export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly chips: number;
  readonly seat: number;
}

export interface PlayerState {
  readonly bet: number; // 現在のストリートのベット額
  readonly cumulativeBet: number; // 累積ベット額（全ストリート）
  readonly isFolded: boolean;
  readonly hasActed: boolean;
  readonly isAllIn: boolean;
  readonly hand: Option<readonly [Card, Card]>; // ホールカード (fp-ts/Option)
}

// Acknowledgment 型 (重要: 全クライアント同期機能)
export interface AcknowledgmentState {
  readonly expectedAcks: ReadonlySet<PlayerId>;
  readonly receivedAcks: ReadonlySet<PlayerId>;
  readonly startedAt: number;
  readonly description: string;
  readonly type: 'action' | 'stage_transition';
}

// ポット型
export interface Pot {
  readonly amount: number;
  readonly eligiblePlayers: ReadonlySet<PlayerId>;
}

// RNG型 (決定的乱数生成)
export interface RNGState {
  readonly seed: number;
}

// ゲーム状態型 (完全に不変)
export interface GameState {
  readonly players: ReadonlyMap<PlayerId, Player>;
  readonly playerStates: ReadonlyMap<PlayerId, PlayerState>;
  readonly stage: Stage;
  readonly dealerIndex: number;
  readonly currentBettorIndex: number;
  readonly deck: readonly Card[];
  readonly communityCards: readonly Card[];
  readonly currentBet: number;
  readonly minRaiseAmount: number;
  readonly lastAggressorId: Option<PlayerId>;
  readonly pots: readonly Pot[];
  readonly totalPot: number;
  readonly rngState: RNGState; // 乱数生成器の状態

  // Acknowledgment 関連 (重要)
  readonly waitingForAck: boolean;
  readonly ackState: Option<AcknowledgmentState>;
}

// アクション定義
export interface PlayerAction {
  readonly playerId: PlayerId;
  readonly type: ActionType;
  readonly amount?: number; // raise時のみ必須
}

// エラー型 (型安全なエラーハンドリング)
export type GameError =
  | { type: 'InvalidTurn'; playerId: PlayerId; expectedPlayerId: PlayerId }
  | { type: 'PlayerNotFound'; playerId: PlayerId }
  | { type: 'PlayerAlreadyFolded'; playerId: PlayerId }
  | { type: 'InvalidAction'; action: ActionType; reason: string }
  | { type: 'InsufficientChips'; required: number; available: number }
  | { type: 'InvalidBetAmount'; amount: number; minimum: number }
  | { type: 'GameNotInProgress'; currentStage: Stage }
  | { type: 'InvalidStage'; expected: Stage; actual: Stage }
  | { type: 'InsufficientCards'; required: number; available: number }
  | { type: 'NoActivePlayers' }
  | { type: 'BettingNotComplete' }
  | { type: 'DuplicateAcknowledgment'; playerId: PlayerId }
  | { type: 'UnexpectedAcknowledgment'; playerId: PlayerId }
  | { type: 'NotWaitingForAck' };

// 役評価結果
export interface HandEvaluation {
  readonly rank: number;
  readonly name: string;
  readonly cards: readonly Card[];
}

// ショーダウン結果
export interface WinnerInfo {
  readonly playerId: PlayerId;
  readonly potIndex: number;
  readonly amount: number;
  readonly evaluation: HandEvaluation;
}

export interface ShowdownResult {
  readonly winners: readonly WinnerInfo[];
  readonly finalState: GameState;
}
```

#### 主要関数 (すべて実装済み)

```typescript
// ラウンド開始 (初期化)
function initializeRound(
  players: readonly Player[],
  dealerIndex: number,
  smallBlind: number,
  bigBlind: number,
  rngState: RNGState
): Either<GameError, GameState>;

// アクション実行 (純粋関数、副作用なし)
function processAction(
  action: PlayerAction,
  state: GameState
): Either<GameError, GameState>;

// ベッティング完了判定
function isBettingComplete(state: GameState): boolean;

// ステージ進行 (Acknowledgment付き)
function advanceStageWithAck(state: GameState): Either<GameError, GameState>;

// ステージ進行 (通常版)
function advanceStage(state: GameState): Either<GameError, GameState>;

// ショーダウン実行
function performShowdown(state: GameState): Either<GameError, ShowdownResult>;

// 有効なアクション取得
function getValidActions(
  playerId: PlayerId,
  state: GameState
): readonly ActionType[];

// ポット計算
function calculatePots(state: GameState): readonly Pot[];

// 役評価
function evaluateHand(
  holeCards: readonly [Card, Card],
  communityCards: readonly Card[]
): Either<GameError, HandEvaluation>;

// 役比較
function compareHands(hand1: HandEvaluation, hand2: HandEvaluation): number;

// RNG関連
function createRNGState(seed: number): RNGState;
function createRandomRNGState(): RNGState; // 非純粋（Date.now()使用）
function shuffleDeck(
  deck: readonly Card[],
  rngState: RNGState
): { shuffledDeck: readonly Card[]; nextRngState: RNGState };
```

詳細な使用方法は [server-v2/src/engine/README.md](../server-v2/src/engine/README.md) を参照してください。

### 2.4 game_engineの実装構成 (実装済み)

```
server/src/engine/                  # ← "game_engine" ではなく "engine"
├── index.ts                        # 主要関数のエクスポート
├── types.ts                        # GameState, Player, GameError等の型定義
├── constants.ts                    # 定数定義
├── acknowledgment.ts               # Acknowledgment システム (NEW)
├── actions.ts                      # processAction実装 (36テスト)
├── deck.ts                         # デッキ管理・シャッフル (23テスト)
├── game-init.ts                    # initializeRound実装 (15テスト)
├── hand-evaluator.ts               # 役判定 (pokersolver wrapper) (22テスト)
├── pot.ts                          # ポット・サイドポット計算 (9テスト)
├── showdown.ts                     # ショーダウン処理 (10テスト)
├── stage.ts                        # ステージ進行 (27テスト)
├── utils.ts                        # ユーティリティ関数 (31テスト)
└── README.md                       # エンジンの詳細ドキュメント

合計: 190テスト, 96%カバレッジ
```

**主な特徴**:
- ✅ **fp-ts/Either**: 全関数が `Either<GameError, Result>` を返す
- ✅ **fp-ts/Option**: `Option<T>` でnull安全性を保証
- ✅ **完全な不変性**: すべてのプロパティが `readonly`
- ✅ **Acknowledgment**: 全クライアント同期システム組み込み
- ✅ **決定的RNG**: ゲームの完全な再現性

---

## 3. Server側設計

> **実装済み**: server-v2/ として完全実装済み (273テスト全通過)

### 3.1 アーキテクチャ概要

**通信方式**:
- **REST API** (OpenAPI 3.0準拠): アクション実行、状態取得
- **WebSocket** (Socket.io): リアルタイム通知のみ (room:updated イベント)

**レイヤー構成**:
```
HTTP Request → Express Router → GameService → GameManager → Engine
                                      ↓
                                  Notifier → WebSocket broadcast
```

### 3.2 ディレクトリ構成 (実装済み)

```
server/                             # ← server-v2 を server にリネーム予定
├── src/
│   ├── engine/                     # 純粋関数型ゲームエンジン (190テスト)
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── acknowledgment.ts       # ✨ Acknowledgment システム
│   │   ├── actions.ts              # プレイヤーアクション処理
│   │   ├── deck.ts                 # デッキ・RNG管理
│   │   ├── game-init.ts            # ラウンド初期化
│   │   ├── hand-evaluator.ts       # 役判定
│   │   ├── pot.ts                  # ポット計算
│   │   ├── showdown.ts             # ショーダウン
│   │   ├── stage.ts                # ステージ遷移
│   │   ├── utils.ts                # ユーティリティ
│   │   └── README.md
│   │
│   ├── api/                        # REST API層
│   │   ├── routes/
│   │   │   ├── rooms.ts            # ルーム関連エンドポイント
│   │   │   └── health.ts           # ヘルスチェック
│   │   └── middleware/
│   │       ├── errorHandler.ts     # エラーハンドリング
│   │       └── validator.ts        # リクエストバリデーション
│   │
│   ├── websocket/                  # WebSocket通知層
│   │   ├── Notifier.ts             # room:updated イベント送信
│   │   └── setupWebSocket.ts       # Socket.io設定
│   │
│   ├── services/                   # ビジネスロジック層
│   │   └── GameService.ts          # ゲーム操作サービス (35テスト)
│   │
│   ├── managers/                   # 状態管理層
│   │   └── GameManager.ts          # ルーム・状態管理 (17テスト)
│   │
│   ├── types/                      # 共通型定義
│   │   ├── api.ts                  # API リクエスト/レスポンス型
│   │   └── room.ts                 # Room関連型
│   │
│   ├── utils/                      # ユーティリティ
│   │   └── logger.ts               # winston ロガー
│   │
│   ├── app.ts                      # Express + Socket.io アプリケーション
│   └── server.ts                   # サーバー起動エントリー
│
├── tests/                          # テストスイート (273テスト)
│   ├── engine/                     # エンジン層テスト (190)
│   ├── managers/                   # マネージャーテスト (17)
│   ├── services/                   # サービステスト (10)
│   ├── websocket/                  # WebSocket層テスト (8)
│   └── integration/                # 統合テスト (48)
│       ├── api-game-flow.test.ts
│       ├── api-game-flow-heads-up.test.ts
│       └── api-websocket-integration.test.ts
│
├── docs/                           # ドキュメント
│   ├── README.md                   # プロジェクト概要 (v2.2.0)
│   ├── ACKNOWLEDGMENT_SYNC_DESIGN.md  # Acknowledgment設計書
│   ├── GAME_FLOW_SEQUENCE.md       # ゲームフローシーケンス
│   └── TEST_SCENARIOS.md           # テストシナリオ一覧
│
├── openapi.yaml                    # OpenAPI 3.0 仕様書
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env.example
```

**テスト状況**: 273/273 passing (100%)

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

> **実装済み**: OpenAPI 3.0準拠の REST API + Socket.io WebSocket

### 5.1 REST API エンドポイント (実装済み)

**仕様書**: [server-v2/openapi.yaml](../server-v2/openapi.yaml)

#### ルーム操作

| Method | Endpoint | 説明 | Request Body | Response |
|--------|----------|------|--------------|----------|
| `POST` | `/api/v1/rooms` | ルーム作成 | `{ hostName, smallBlind?, bigBlind? }` | `{ roomId, playerId }` |
| `GET` | `/api/v1/rooms/:roomId` | ルーム情報取得 | - | `{ id, status, players, ... }` |
| `POST` | `/api/v1/rooms/:roomId/join` | ルーム参加 | `{ playerName }` | `{ playerId, seat }` |
| `POST` | `/api/v1/rooms/:roomId/start` | ゲーム開始 | - | `201 Created` |
| `GET` | `/api/v1/rooms/:roomId/state` | ゲーム状態取得 | `?playerId=xxx` | `GameState` (プレイヤー視点) |
| `POST` | `/api/v1/rooms/:roomId/actions` | アクション実行 | `{ playerId, type, amount? }` | `201 Created` |

#### ステータスコード

- `200 OK`: 成功
- `201 Created`: リソース作成成功
- `400 Bad Request`: 不正なリクエスト
- `404 Not Found`: リソースが見つからない
- `500 Internal Server Error`: サーバーエラー

### 5.2 WebSocket 通知 (実装済み)

**用途**: リアルタイム状態更新通知のみ (アクション実行はREST API)

#### Socket.io イベント

| イベント名 | ペイロード | 説明 | タイミング |
|----------|----------|------|-----------|
| `room:updated` | `{ roomId, updateType, room }` | ルーム状態更新 | 全ての状態変更時 |

#### `updateType` の種類

- `game_started`: ゲーム開始
- `action`: プレイヤーアクション実行
- `stage_advanced`: ステージ遷移
- `showdown`: ショーダウン
- `player_joined`: プレイヤー参加
- `player_left`: プレイヤー退出

### 5.3 Acknowledgment プロトコル (重要)

**全クライアント同期システム**

```
1. Client A → REST API POST /actions (call)
2. Server → WebSocket broadcast 'room:updated' (waitingForAck: true)
3. All Clients → REST API POST /actions (acknowledge)
4. Server → WebSocket broadcast 'room:updated' (waitingForAck: false)
```

**GameState 内の Acknowledgment フィールド**:

```typescript
{
  waitingForAck: boolean;
  ackState: Option<{
    type: 'action' | 'stage_transition';
    expectedAcks: Set<PlayerId>;
    receivedAcks: Set<PlayerId>;
  }>;
}
```

詳細は [server-v2/ACKNOWLEDGMENT_SYNC_DESIGN.md](../server-v2/ACKNOWLEDGMENT_SYNC_DESIGN.md) を参照。

### 5.4 プレイヤー視点のGameState

**セキュリティ**: `GET /api/v1/rooms/:roomId/state?playerId=xxx` では、該当プレイヤーの手札のみ含まれます。

```typescript
interface PlayerGameState {
  stage: Stage;
  players: Player[]; // チップ情報のみ
  dealerIndex: number;
  currentBettorIndex: number;
  communityCards: Card[];
  currentBet: number;
  minRaiseAmount: number;
  totalPot: number;
  myHand: Option<[Card, Card]>; // 自分の手札のみ
  waitingForAck: boolean;
  // 他プレイヤーの手札は含まない
}
```

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

> **実装済み**: server-v2 で 273/273 テスト全通過

### 7.1 テストレイヤー構成

| レイヤー | 対象 | ツール | カバレッジ目標 | 実績 |
|---------|------|-------|--------------|------|
| **Engine Unit** | 純粋関数型エンジン | Jest | 80% | ✅ 190テスト, 96% |
| **Service Unit** | GameService, GameManager | Jest | 80% | ✅ 27テスト, 100% |
| **WebSocket Unit** | Notifier | Jest | 80% | ✅ 8テスト, 100% |
| **Server Integration** | REST API + WebSocket + フルゲームフロー | Jest + supertest + socket.io-client | 70% | ✅ 48テスト, 100% |
| **Client Unit** | コンポーネント, フック | Vitest + React Testing Library | 70% | ⏳ 未実装 |
| **Client Integration** | API通信 + WebSocket | Vitest + モック | 60% | ⏳ 未実装 |
| **E2E** | 完全なゲームフロー | Playwright | 主要シナリオ網羅 | ⏳ 未実装 |

### 7.2 テストカバレッジ詳細 (server-v2)

#### エンジン層ユニットテスト (190テスト)

| モジュール | テスト数 | カバレッジ | 主な検証内容 |
|----------|--------|----------|-------------|
| actions.ts | 36 | 94.02% | 全アクションタイプ、バリデーション、ターン管理 |
| utils.ts | 31 | 100% | プレイヤー検索、ベット計算、バリデーション |
| stage.ts | 27 | 93.75% | ステージ遷移、カード配布、ベットリセット |
| deck.ts | 23 | 100% | デッキ生成、シャッフル、RNG |
| hand-evaluator.ts | 22 | 94.59% | 全役判定、役比較、タイブレーク |
| game-init.ts | 15 | 96% | ラウンド初期化、ブラインド配置 |
| showdown.ts | 10 | 94.33% | 勝者決定、ポット配分、チョップ |
| pot.ts | 9 | 97.5% | メインポット、サイドポット計算 |
| acknowledgment.ts | 9 | 100% | Ack設定、受信、完了判定 |
| game-flow-integration.ts | 8 | - | 完全ゲームフロー統合テスト |

#### 統合テスト (48テスト)

| テストファイル | テスト数 | 検証内容 |
|--------------|--------|---------|
| api-game-flow-heads-up.test.ts | 33 | ヘッズアップ全シナリオ |
| api-game-flow.test.ts | 13 | 3人プレイヤー基本フロー |
| api-websocket-integration.test.ts | 2 | WebSocket通知統合 |

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
