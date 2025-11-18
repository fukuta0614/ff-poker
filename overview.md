Online Poker — プロジェクト概要、実装計画、仕様、設計
目次

プロジェクト概要

MVPゴール（優先機能）

技術選定（スタック）

アーキテクチャ（全体像）

データモデル（簡易）

API設計（REST） & WebSocketイベント（socket.io）

ゲームロジック設計（フロー＆ステートマシン）

セキュリティ・チート対策

クライアント設計（React 構成・重要コンポーネント）

サーバ設計（Node.js + socket.io 構成）

デプロイ / インフラ / ロギング

テスト計画 & QA

開発工程（マイルストーン）と優先順位

リスクと対応策

次のアクション

1. プロジェクト概要

目的: 友達同士で気軽に遊べるオンラインテキサスホールデム（ノーリミット想定）の Web アプリを作る。
対象: モバイルブラウザ（iPhone Safari）とデスクトップを想定。後で React Native に移行可能な構成。
基本方針:

ゲームの公平性と安定性はサーバ側で担保する（王道）。

最初はシンプルな UI でMVPを作り、ゲーム性が安定したらUI改善、演出追加、モバイル最適化を進める。

2. MVP ゴール（最小限で動く機能）

ルーム作成 / ルーム参加（Room ID で入室）

プレイヤー名表示

最大6人テーブル（MVP）でのホールデム対戦

サーバ側でのデッキ生成・シャッフル・配布（ホールカード、コミュニティカード）

ベット（fold / check / call / bet / raise）とポット管理

ターン制の強制進行（タイムアウトでフォールド）

ショーダウンと役判定（勝者決定、ポット配分）

再接続（断線したプレイヤー復帰時にゲーム継続）

基本的なチャット（任意）

ログ出力（サーバサイド基本ログ）

優先度: 安定してゲームが最後まで回ることが最優先。演出やアニメーションは後回し。

3. 技術選定（スタック）

フロントエンド

React + Vite

TypeScript（推奨）

UI: Tailwind CSS or Chakra UI（好みで）

アニメーション: framer-motion（後段で導入）

socket.io-client（リアルタイム）

バックエンド

Node.js（Express or Fastify）

socket.io（リアルタイム）

TypeScript（推奨）

データストア（オプション）: Redis（セッション/ステート保存、再接続用） または Postgres（永続ログ）

インフラ

フロント: Vercel / Netlify

サーバ: Render / Fly.io / Railway / DigitalOcean App Platform

ログ/モニタ: Sentry, Prometheus / Grafana（必要になったら）

その他

CI: GitHub Actions

テスト: Jest（サーバユニット）, Playwright（E2E）

Lint/Format: ESLint, Prettier

4. アーキテクチャ（全体像）
[Browser Client (React)]
    ↕ WebSocket (socket.io)
[Node.js Game Server (socket.io)]
    ↕ Redis (in-memory state, pub/sub for scaling)
    ↕ Postgres (audit logs, user data) - optional
    ↕ Optional: REST endpoints for room listing, health-check


サーバが**唯一の真実（single source of truth）**としてゲーム状態を管理する。

socket.io で双方向イベントをやり取り。

スケールを考えるなら Redis を使って複数の Node インスタンス間でルームを特定インスタンスに固定（sticky session）か、あるいは Redis pub/sub でイベントブローカーとする。

5. データモデル（簡易）

型は TypeScript 想定

User (Session)
type Player = {
  id: string; // socket.id or generated uuid
  name: string;
  chips: number;
  seat: number; // 0..5
  connected: boolean;
  lastSeen: number;
}

Room
type Room = {
  id: string;
  hostId: string;
  players: Player[]; // length <= 6
  state: 'waiting' | 'in_progress' | 'finished'
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  pot: number;
  sidePots?: SidePot[];
  deckState?: string; // serialized deck for recovery
  currentRound?: RoundState;
  createdAt: number;
}

RoundState
type RoundState = {
  stage: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  communityCards: string[]; // ["As","Td",...]
  currentPlayerIndex: number;
  currentBet: number; // amount to call
  bets: Record<playerId, number>;
  folded: Set<playerId>;
}

6. API 設計（REST） & WebSocket イベント（socket.io）
REST（軽め）

GET /health — ヘルスチェック

POST /create-room — ルーム作成（返却: roomId）

GET /room/:id — ルームの公開情報（待機中のルーム一覧に使う）

ゲームの実際の状態同期はWebSocketで行う。

socket.io イベント（概要）

クライアント ⇄ サーバ通信は主に socket.io のイベントで行う。

クライアント → サーバ

joinRoom { roomId, playerName }

leaveRoom { roomId }

startGame { roomId } （ホストのみ）

action { roomId, playerId, type: 'fold'|'check'|'call'|'bet'|'raise', amount? }

chatMessage { roomId, playerId, text }

reconnectRequest { roomId, playerId }

サーバ → クライアント

roomState { room } — ルームの公開状態（プレイヤー一覧、座席）

gameState { roundState, playersPublic } — 公開部分のゲーム状態

privateHand { playerId, cards: [..] } — 各プレイヤーに1対1で送る（直送）

playerActionRequest { playerIndex, allowedActions }

actionResult { action, nextPlayerIndex, updatedState }

gameOver { winners, payouts }

error { message }

注意: privateHand は socket.to(playerSocketId).emit(...) のように個別送信し、他に漏れないようにする。

7. ゲームロジック設計（フロー & ステートマシン）
基本フロー

ルーム作成、参加（待機）

ホストがゲーム開始 → サーバが新しいRound作成

ディーラー決定（回転） → ブラインドを自動徴収

デッキ生成・シャッフル（サーバ）

各プレイヤーにホールカードを個別送信（privateHand）

プリフロップのベッティングラウンド（ターン制）

フロップ（3枚コミュニティカード）→ ベッティングラウンド

ターン → ベッティングラウンド

リバー → ベッティングラウンド

ショーダウン → 役判定 → ポット配分

結果通知 → 次のRound（ディーラ移動）

ステートマシン（ラフ）

Room.state: waiting → in_progress

Round.stage: preflop → flop → turn → river → showdown → end

ターン制とタイムアウト

currentPlayerIndex を管理

各プレイヤーにタイムバンク（例: デフォルトは N 秒）を付与（MVPでは固定短め）

タイムアウト時に自動 fold（またはチェック/コールの選択肢に応じて自動処理）

役判定

サーバ側で判定ライブラリを使う（自作も可能だが既存実装推奨）

役の比較ロジックは厳密に（複数勝者、サイドポット対応）

8. セキュリティ・チート対策（基本）

ゲームロジックはサーバ側のみで評価（クライアントは信頼しない）

カード配布の正当性：デッキはサーバ側で一意に生成し、配布もサーバが管理。クライアントにデッキ情報を保持させない。

privateHand は socket の個別送信のみ（他のクライアントには送らない）

再接続時はトークン or sessionId を使って本人認証

チート・改造対策としてはログ監査と不正検知（例: 同一IPから複数アカウント、ありえないアクション等を検出）

HTTPS / WSS を必須にする

DB に保存する際は出力ログに個人情報、カード情報を残さない（もしくは暗号化/マスク）

9. クライアント設計（React 構成・重要コンポーネント）
ディレクトリ案
/src
  /components
    Table.tsx
    PlayerSeat.tsx
    Card.tsx
    ActionPanel.tsx
    Chat.tsx
    Lobby.tsx
  /hooks
    useSocket.ts
    useRoomState.ts
  /pages
    /Lobby
    /Room/[id]
  /utils
    card.ts
    handEvaluator.ts
  App.tsx

主要コンポーネント

Lobby — ルーム作成/参加画面

Room — テーブルとプレイヤー一覧を表示。socket 接続を管理。

Table — コミュニティカード、ポット、タイマーを表示

PlayerSeat — 各プレイヤーのチップ量、ステータス（folded/active）

ActionPanel — プレイヤーの操作（fold/call/check/bet/raise）

Chat — チャットログ表示・送信

ReconnectModal — 切断時の再接続UI

状態管理

小規模なら React Context + useReducer（roomState）で十分

大規模 or 複雑なら Zustand / Redux 検討

UI UX 注意点

アクションのボタンはサーバの playerActionRequest を受け取ってから活性化する（サーバ主導）

ボタン連打防止のため一時的なローカルロックを入れる

タイムアウトの残りを可視化（タイムバンク）

ホールカードは個別に受け取り、DOM に直接表示するのではなく state を通じて表示（他プレイヤーに漏れないように）

10. サーバ設計（Node.js + socket.io 構成）
基本構成

app.ts — Express サーバ、socket.io 初期化

gameManager.ts — ルームの生成、削除、状態管理

room.ts — Room オブジェクト、Round 状態遷移を実装

deck.ts — デッキ管理、シャッフル、シリアライズ

handEvaluator.ts — 役判定ロジック（既存 lib を使用推奨）

persistence.ts — Redis 接続（セッション保存、ルーム復元）

auth.ts — セッション / トークン管理（簡易）

logger.ts — ログ出力（重要イベント：配布、ベット、勝者）

イベント処理の流れ（概略）

joinRoom → バリデーション、seat割当、broadcast roomState

startGame → gameManager.startRound(roomId)（サーバがデッキシャッフル・配布）

action → room.handleAction(...) → 判断 → actionResult broadcast

Round end → gameOver broadcast → 次Round処理 or end

再接続

socket disconnect: set player.connected = false; start grace period timer

within grace period, reconnectRequest with playerId → restore socket association

beyond grace period, treat as folded/out

11. デプロイ / インフラ / ロギング

HTTPS/WSS を必須に（証明書はホスティング側で扱う）

本番: Node インスタンス + Redis（session/state）構成が現実的

ログは重要イベント（配布、全インスタンスのアクション）だけを取り、個人情報やカード全履歴は保存ポリシーに注意

モニタ: Sentry（例外）、Prometheus（メトリクス）

スケール: socket.io のスケールは sticky session か Redis adapter（socket.io-redis）

12. テスト計画 & QA

ユニットテスト: deck, shuffle, handEvaluator, pot分割

サーバ統合テスト: 複数ソケットを立ち上げてフローベースでテスト

E2E: Playwright でブラウザ越しに複数クライアントのシナリオを実行

負荷試験（任意）: ローカルやクラウドで同時接続 100 〜 を想定した負荷テスト

手動QA: 再接続、重複アクション、タイムアウト、サイドポットが絡む複雑ケース

13. 開発工程（マイルストーン）と優先順位

各マイルストーンは「達成条件」を示す。具体的な作業はこの順で進めるのが合理的。

マイルストーン A — プロトタイプ（最低限動く状態）

ルーム作成／参加

サーバが1テーブルを管理して、カード配布・簡単なベッティングが動く

ショーダウンで勝者決定まで行える

達成条件: ブラウザ2つでゲームが最後まで回ること

マイルストーン B — 安定化（プレイしやすくする）

再接続の実装

タイムアウト実装

ベットの不正入力ハンドリング

チャット

達成条件: 切断→再接続してゲームが中断なく続行できる

マイルストーン C — UX改善

UI/アニメーション追加

モバイルレイアウト最適化

ログ/監視導入

達成条件: プレイ体験が快適で、友達に「遊べる」と言わせられること

14. リスクと対応策

ブラウザの WebSocket 切断が多い → 再接続ロジックと短めのタイムアウト設定／バックグラウンド対策の説明をUIに表示

チート（クライアント改造） → 重要な決定はサーバ側で行い、クライアントは表示のみ

TURN が必要な場合 → WebRTC を使うケースよりは少ないが、P2P を選ぶ場合は TURN が必要になる

スケール → 初期は単一インスタンスでOK。必要なら Redis adapter で socket.io を水平スケール

ゲームルールの境界ケース（サイドポット等） → まずは基本ケースで安定させ、複雑ケースはユニットテストを追加

15. 次のアクション（推奨）

プロジェクトリポジトリ作成（GitHub）と CI 初期設定

開発用ブランチを切り、マイルストーンA に集中

サーバーの最小実装（Node + socket.io）から着手

joinRoom / startGame / action / roomState の骨格を作る

クライアントの Lobby と Room の最小UIを作る（サーバとの接続確認）

Deck/Shuffle/Deal/HandEvaluator のユニットテストを作成

内輪でテストプレイ → 不具合修正 → UX改善サイクル

付録：具体的な小さめの設計メモ（コード化しやすいポイント）
Deck シャッフル（サンプル考え方）

52枚配列を Fisher–Yates でシャッフル

シャッフル直後に deckSeed をサーバ内部でログ（監査用）として保存（ただし保存ポリシーは慎重に）

Pot の計算（サイドポット対応）

各プレイヤーのベット額を集め、最小ベット毎に分割して複数サイドポットを算出するアルゴリズムを用意

Hand Evaluator

既存ライブラリを利用（node-poker-evaluator 等）か自作

マルチウィナー、5枚/7枚評価に対応

再接続設計（セッション）

Player に playerId（長い UUID）を割り当て、ローカルストレージに保存しておく

再接続時は reconnectRequest と playerId を送信し、サーバで socket を紐付け直す