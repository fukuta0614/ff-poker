# Online Poker - 仕様書

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [MVP機能要件](#mvp機能要件)
3. [技術要件](#技術要件)
4. [データモデル仕様](#データモデル仕様)
5. [API仕様](#api仕様)
6. [セキュリティ要件](#セキュリティ要件)
7. [非機能要件](#非機能要件)

---

## プロジェクト概要

### 目的
友達同士で気軽に遊べるオンラインテキサスホールデム（ノーリミット）のWebアプリケーションを開発する。

### 対象ユーザー
- モバイルブラウザ（主にiPhone Safari）
- デスクトップブラウザ

### 基本方針
1. ゲームの公平性と安定性はサーバ側で担保する
2. 最初はシンプルなUIでMVPを作成
3. ゲーム性が安定した後、UI改善・演出追加・モバイル最適化を実施
4. 将来的にReact Nativeへの移行が可能な構成

---

## MVP機能要件

### 必須機能

#### 1. ルーム管理
- **ルーム作成**: ホストがRoom IDを生成して新規ルームを作成
- **ルーム参加**: Room IDを使用してルームに入室
- **プレイヤー名表示**: 各プレイヤーの名前を表示

#### 2. ゲーム機能
- **対応人数**: 最大6人テーブル
- **カード配布**:
  - サーバ側でのデッキ生成・シャッフル・配布
  - ホールカード（各プレイヤー2枚）
  - コミュニティカード（フロップ3枚、ターン1枚、リバー1枚）
- **ベット機能**:
  - Fold（降りる）
  - Check（チェック）
  - Call（コール）
  - Bet（ベット）
  - Raise（レイズ）
- **ポット管理**:
  - メインポット
  - サイドポット対応

#### 3. ゲームフロー制御
- **ターン制**: プレイヤーが順番にアクションを実行
- **タイムアウト**: 一定時間内にアクションがない場合、自動フォールド
- **ショーダウン**: 役判定と勝者決定
- **ポット配分**: 勝者へのチップ分配

#### 4. 再接続機能
- 断線したプレイヤーが復帰時にゲーム継続可能
- 一定時間内の再接続をサポート

#### 5. コミュニケーション（任意）
- 基本的なチャット機能

#### 6. ロギング
- サーバサイドでの基本ログ出力
- 重要イベント（配布、ベット、勝者決定）の記録

### 優先度
安定してゲームが最後まで完走することが最優先。演出やアニメーションは後回し。

---

## 技術要件

### 技術スタック

#### フロントエンド
- **フレームワーク**: React + Vite
- **言語**: TypeScript（推奨）
- **UIライブラリ**: Tailwind CSS または Chakra UI
- **アニメーション**: framer-motion（後段で導入）
- **リアルタイム通信**: socket.io-client

#### バックエンド
- **ランタイム**: Node.js
- **フレームワーク**: Express または Fastify
- **リアルタイム通信**: socket.io
- **言語**: TypeScript（推奨）
- **データストア**:
  - Redis（セッション/ステート保存、再接続用）- オプション
  - PostgreSQL（永続ログ）- オプション

#### インフラ
- **フロントエンド**: Vercel / Netlify
- **バックエンド**: Render / Fly.io / Railway / DigitalOcean App Platform
- **監視**: Sentry, Prometheus / Grafana（必要に応じて）

#### 開発・テスト
- **CI/CD**: GitHub Actions
- **テスト**: Jest（サーバユニットテスト）、Playwright（E2E）
- **Lint/Format**: ESLint, Prettier

### 対応ブラウザ
- iPhone Safari（最新版）
- Chrome（最新版）
- Firefox（最新版）
- Edge（最新版）

---

## データモデル仕様

### Player（プレイヤー）

```typescript
type Player = {
  id: string;           // socket.id または生成されたUUID
  name: string;         // プレイヤー名
  chips: number;        // 保有チップ数
  seat: number;         // 座席番号（0〜5）
  connected: boolean;   // 接続状態
  lastSeen: number;     // 最終接続時刻（タイムスタンプ）
}
```

### Room（ルーム）

```typescript
type Room = {
  id: string;                    // ルームID
  hostId: string;                // ホストプレイヤーのID
  players: Player[];             // プレイヤー配列（最大6人）
  state: 'waiting' | 'in_progress' | 'finished';  // ルーム状態
  dealerIndex: number;           // ディーラーの位置
  smallBlind: number;            // スモールブラインド額
  bigBlind: number;              // ビッグブラインド額
  pot: number;                   // 現在のポット総額
  sidePots?: SidePot[];          // サイドポット配列
  deckState?: string;            // デッキのシリアライズ状態（復元用）
  currentRound?: RoundState;     // 現在のラウンド状態
  createdAt: number;             // ルーム作成時刻
}
```

### RoundState（ラウンド状態）

```typescript
type RoundState = {
  stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';  // ラウンドステージ
  communityCards: string[];      // コミュニティカード（例: ["As", "Td", ...]）
  currentPlayerIndex: number;    // 現在のターンのプレイヤーインデックス
  currentBet: number;            // 現在のコール額
  bets: Record<playerId, number>; // 各プレイヤーのベット額
  folded: Set<playerId>;         // フォールドしたプレイヤーのセット
}
```

### SidePot（サイドポット）

```typescript
type SidePot = {
  amount: number;                // ポット額
  eligiblePlayers: string[];     // このポットに参加できるプレイヤーID配列
}
```

---

## API仕様

### REST API

サーバ状態の基本的な確認とルーム作成に使用。ゲームの実際の状態同期はWebSocketで実施。

#### `GET /health`
- **概要**: ヘルスチェック
- **レスポンス**:
  ```json
  {
    "status": "ok",
    "timestamp": 1234567890
  }
  ```

#### `POST /create-room`
- **概要**: 新規ルーム作成
- **リクエストボディ**:
  ```json
  {
    "hostName": "Player1",
    "smallBlind": 10,
    "bigBlind": 20
  }
  ```
- **レスポンス**:
  ```json
  {
    "roomId": "abc123",
    "hostId": "player-uuid"
  }
  ```

#### `GET /room/:id`
- **概要**: ルームの公開情報取得（待機中のルーム一覧用）
- **レスポンス**:
  ```json
  {
    "roomId": "abc123",
    "playerCount": 3,
    "state": "waiting",
    "smallBlind": 10,
    "bigBlind": 20
  }
  ```

---

### WebSocket API（socket.io）

ゲームの実際の状態同期とリアルタイム通信に使用。

#### クライアント → サーバ

##### `joinRoom`
```typescript
{
  roomId: string;
  playerName: string;
}
```
- **概要**: ルームに参加

##### `leaveRoom`
```typescript
{
  roomId: string;
}
```
- **概要**: ルームから退出

##### `startGame`
```typescript
{
  roomId: string;
}
```
- **概要**: ゲーム開始（ホストのみ実行可能）

##### `action`
```typescript
{
  roomId: string;
  playerId: string;
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  amount?: number;  // bet/raiseの場合に必須
}
```
- **概要**: プレイヤーのアクション実行

##### `chatMessage`
```typescript
{
  roomId: string;
  playerId: string;
  text: string;
}
```
- **概要**: チャットメッセージ送信

##### `reconnectRequest`
```typescript
{
  roomId: string;
  playerId: string;
}
```
- **概要**: 再接続リクエスト

#### サーバ → クライアント

##### `roomState`
```typescript
{
  room: {
    id: string;
    players: Player[];
    state: string;
    // その他のルーム公開情報
  }
}
```
- **概要**: ルームの公開状態をブロードキャスト

##### `gameState`
```typescript
{
  roundState: RoundState;
  playersPublic: PublicPlayerInfo[];
}
```
- **概要**: ゲームの公開状態をブロードキャスト

##### `privateHand`
```typescript
{
  playerId: string;
  cards: string[];  // 例: ["Ah", "Kd"]
}
```
- **概要**: プレイヤーのホールカードを個別送信（1対1通信）

##### `playerActionRequest`
```typescript
{
  playerIndex: number;
  allowedActions: ('fold' | 'check' | 'call' | 'bet' | 'raise')[];
  minBet?: number;
  maxBet?: number;
}
```
- **概要**: プレイヤーにアクション要求

##### `actionResult`
```typescript
{
  action: {
    playerId: string;
    type: string;
    amount?: number;
  };
  nextPlayerIndex: number;
  updatedState: Partial<RoundState>;
}
```
- **概要**: アクション実行結果をブロードキャスト

##### `gameOver`
```typescript
{
  winners: {
    playerId: string;
    hand: string;
    payout: number;
  }[];
  payouts: Record<playerId, number>;
}
```
- **概要**: ゲーム終了と勝者発表

##### `error`
```typescript
{
  message: string;
  code?: string;
}
```
- **概要**: エラーメッセージ

---

## セキュリティ要件

### 基本原則
1. **サーバ側検証**: ゲームロジックはサーバ側のみで評価。クライアントは信頼しない。
2. **通信の暗号化**: HTTPS / WSS を必須とする。

### 具体的な対策

#### 1. カード配布の正当性
- デッキはサーバ側で一意に生成し、シャッフルもサーバが管理
- クライアントにデッキ情報を保持させない
- `privateHand`はsocketの個別送信のみ（他クライアントに送信しない）

#### 2. 認証・セッション管理
- 再接続時はトークンまたはsessionIdで本人認証
- プレイヤーIDをUUIDで管理し、推測不可能にする

#### 3. チート対策
- ログ監査機能の実装
- 不正検知（同一IPから複数アカウント、ありえないアクション等）
- アクションのバリデーション（サーバ側で実施）

#### 4. データ保護
- DBに保存する際、個人情報やカード情報をマスクまたは暗号化
- 出力ログに機密情報を含めない

---

## 非機能要件

### パフォーマンス
- **レスポンスタイム**: アクション実行から結果反映まで1秒以内
- **同時接続**: 初期は10ルーム（最大60ユーザー）を想定

### 可用性
- **稼働率**: 95%以上（MVP段階）
- **再接続**: 切断後30秒以内の再接続を保証

### スケーラビリティ
- 水平スケール可能な設計（Redis adapter使用）
- 将来的に100ルーム以上に対応可能

### メンテナンス性
- TypeScriptによる型安全性
- ESLint/Prettierによるコード品質管理
- ログによる監査証跡

### ユーザビリティ
- モバイルでタップしやすいボタンサイズ（最小44x44px）
- 接続状態の可視化
- タイムアウト残り時間の表示

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-18 | 1.0 | 初版作成 |
