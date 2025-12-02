# FF Poker Client v2 Implementation Plan

## 1. 概要
- **目的**: server-v2 (OpenAPI + REST + Socket.io) を最大限活用する新クライアント `client-v2` を構築し、ルーム管理からゲーム進行までをブラウザ上で完結できるようにする。
- **対象範囲**: ルーム作成/参加、ゲーム状態の可視化、プレイヤーアクション送信、WebSocket を利用したリアルタイム同期、E2E テストまで。
- **前提**:
  - インフラ (Netlify での静的ホスティング + Render での server-v2) は既存設定を踏襲する。Netlify の `base`, `command`, `publish`, 環境変数 (`VITE_SERVER_URL`) を `client-v2` 用に切り替えるだけで済む構成とする。
  - server-v2 は `http://localhost:3001` を開発デフォルトとし、CORS で `http://localhost:5173` を許可済み。
  - 認証は未実装 (Phase6 以降で拡張予定)。現状は `playerName` で識別。

## 2. 成功指標
- UI から以下の一連操作が行える: ルーム作成 → 複数プレイヤー参加 → ゲーム開始 → アクション送信 → ショーダウン。
- WebSocket の `room:updated` 通知を受けて 1 秒以内に最新ゲーム状態へ再描画。
- 主要エラー (`ROOM_NOT_FOUND`, `GAME_NOT_IN_PROGRESS`, `INVALID_ACTION` など) をユーザー向けに分かりやすく表示。
- Playwright による 2 ブラウザ E2E テストで 1 ハンド完走フローを自動確認。
- Netlify/Render の既存デプロイパイプラインを `client-v2` に差し替えるだけで稼働。
- 致命的なクラッシュやハングが発生せず、複数ハンド連続プレイを通じて安定動作することを優先。

## 3. テックスタック
| レイヤー | 採用技術 | メモ |
|---|---|---|
| ビルド/開発 | Vite 7 + TypeScript 5.9 | ネットリファレンスと同一の Node 20 想定。`npm run dev/build/test` スクリプトを定義。 |
| UI | React 19, React Router 7 | ルーティング: `/` (Lobby), `/rooms/:roomId` (RoomView)。 |
| 状態管理 | React Query (server state) + Zustand (UI state) | Query で REST 状態を caching、Zustand でモーダル/UI 設定を保持。 |
| バリデーション | Zod + React Hook Form | ルーム作成/参加フォームの検証。 |
| WebSocket | socket.io-client 4.8.x | 共通 SocketProvider から `room:join/leave` を emit。 |
| 型生成 | `openapi-typescript` | `server-v2/src/api/openapi.yaml` を入力、`src/api/generated` に型を生成。 |
| テスト | Vitest + Testing Library + msw / Playwright | フロント単体/統合/ブラウザテストをカバー。 |

## 4. アーキテクチャ
```
client-v2/
├─ src/
│  ├─ main.tsx / App.tsx         # ルーティング + Provider 初期化
│  ├─ config/                     # 環境変数, API ベースURL, WS URL
│  ├─ providers/
│  │   ├─ QueryProvider.tsx       # React Query client
│  │   └─ SocketProvider.tsx      # socket.io 接続・再接続を管理
│  ├─ api/
│  │   ├─ generated/              # OpenAPI 生成コード
│  │   ├─ client.ts               # fetch wrapper
│  │   └─ rooms.ts / actions.ts   # 高レベル API 関数
│  ├─ features/
│  │   ├─ lobby/                  # ルーム一覧/作成/参加
│  │   └─ room/                   # テーブル表示/アクション/ログ
│  ├─ hooks/                      # useRoomState, usePlayerAction, useRoomSocket
│  ├─ stores/                     # Zustand (UI state, local prefs)
│  ├─ components/                 # 共通 UI
│  └─ styles/                     # Tailwind or CSS Modules
├─ tests/                         # Vitest + msw
├─ e2e/                           # Playwright specs
└─ public/
```
- **データフロー**: REST → React Query で `rooms`, `roomState` を取得 → Hook で view model に整形 → Components が描画。
- **リアルタイム**: SocketProvider で接続/再接続を管理し、`room:updated` 受信時に Query を invalidate。`room:join/leave` は `useRoomSocket` がルート遷移時に emit。
- **永続化**: `localStorage` で `{ roomId, playerId, playerName }` を保持し、自動再接続に利用。

## 5. API / WebSocket 連携
### REST エンドポイント
| Endpoint | 役割 | 主な利用箇所 |
|---|---|---|
| `POST /api/v1/rooms` | ルーム作成 | Lobby の CreateRoom モーダル |
| `GET /api/v1/rooms/:roomId` | ルーム情報取得 | Lobby 詳細表示, 招待リンク共有 |
| `POST /api/v1/rooms/:roomId/join` | ルーム参加 | Join フォーム |
| `POST /api/v1/rooms/:roomId/start` | ゲーム開始 | Host の Start ボタン |
| `POST /api/v1/rooms/:roomId/actions` | プレイヤーアクション | ActionBar (fold/check/call/raise/allin) |
| `GET /api/v1/rooms/:roomId/state?playerId=` | プレイヤー視点の状態 | RoomView 初期ロード, WS 通知後の再フェッチ |

### WebSocket イベント
| イベント | 方向 | データ | 備考 |
|---|---|---|---|
| `room:join` | client → server | `{ roomId, playerId }` | RoomView マウント時に送信。サーバーがプレイヤー検証を行う前提。 |
| `room:leave` | client → server | `{ roomId, playerId }` | ページ離脱・タブ閉じ時に呼び出し。 |
| `room:updated` | server → client | `{ roomId, updateType, timestamp }` | 受信後に `GET /state` を再フェッチ。`updateType` で UI 演出。 |
| `error` | server → client | `{ code, message }` | トースト/ダイアログで表示。 |

## 6. 主な機能モジュール
1. **Lobby**
   - ルーム作成フォーム (hostName, smallBlind, bigBlind)。入力チェックと API エラー表示。
   - ルーム参加フォーム (roomId, playerName)。成功時に localStorage 保存。
   - 最近参加したルームのリスト / 招待リンク共有。
2. **RoomView**
   - プレイヤー一覧 (seat順、chips、アクション状況)。
   - コミュニティカード、ポット、現在のベット額表示。
   - ActionBar (利用可能アクションを `gameState.players[n].hand` や `minRaiseAmount` から算出)。
   - イベントフィード (`updateType` + API 応答を整形)。
   - Socket 接続状態のバナー表示。
3. **Session 管理**
   - `SessionStore` が `roomId`, `playerId` を保持。再訪時は自動で Room に遷移し、`room:join` を送信。
   - セッションが無効な場合は Lobby へ誘導。

## 7. 実装フェーズ
| フェーズ | ゴール | 主タスク |
|---|---|---|
| Phase 0: Project Setup | `client-v2` の土台作成 | Vite + React + TS 設定、ESLint/Vitest/Playwright 導入、Netlify/Render 用 scripts 定義。 |
| Phase 1: API/Socket 基盤 | server-v2 依存のインフラコード | OpenAPI 型生成、API クライアント、SocketProvider、環境変数設定 (`VITE_SERVER_URL`)。 |
| Phase 2: Lobby 機能 | ルーム作成/参加 UI | フォーム実装、localStorage 保存、API 連携、バリデーション。 |
| Phase 3: RoomView UI | ゲーム状態の可視化 | PlayersPanel, TableStage, ActionBar, EventFeed のレイアウトと view model を構築。 |
| Phase 4: サーバー連携 | 実ゲームフローの動作 | React Query + WebSocket で状態同期、ActionBar → `/actions`, Stage 進行演出。 |
| Phase 5: UX & テレメトリ | 体験向上 | ローディング/エラー表示、アニメーション、ログ保存、アクセス解析 (optional)。 |
| Phase 6: QA & リリース | 品質保証とデプロイ | Vitest + Playwright + msw でテスト、Netlify base を `client-v2` に更新、文書化。 |

## 8. テスト戦略
- **ユニット**: hooks (useRoomState/usePlayerAction), stores, API クライアントを Vitest + msw で検証。
- **統合**: React Testing Library で Lobby/RoomView のフォーム送信・エラー処理を再現。
- **E2E**: Playwright で 2 コンテキスト (Host/Guest) を開き、server-v2 に接続して 1 ハンドを進行。CI では `NODE_ENV=test` で server-v2 を起動して実行。
- **パフォーマンス**: Lighthouse or Web Vitals で初期描画/インタラクションを計測。目標: 初期ロード 2s 未満、操作応答 100ms 未満。
- **CI/CD**: GitHub Actions で `npm ci`, `npm run build`, `npm run test`, Playwright を実行。Netlify Preview で UI 確認。

## 9. リスクと対策
| リスク | 影響 | 対策 |
|---|---|---|
| OpenAPI ファイルがビルドに含まれない | 型生成/本番配信で不整合 | `npm run generate:api` を事前に実行し生成物をリポジトリ管理、または CI で server-v2 リポジトリから参照。 |
| WebSocket leave の不正リクエスト | 他プレイヤーの通知が止まる | client 側で `room:leave` を現在セッションの情報のみ送信し、サーバーでも検証 (別タスクで修正)。 |
| server-v2 のショーダウンでディーラー更新がされない | UI とバックエンドの状態ズレ | server-v2 側で dealerIndex 更新タスクを優先的に実装 (別Issue参照)。 |
| CORS/環境変数の不整合 | 接続失敗 | Netlify/Render の env 管理手順書を Phase 6 で整備し、 `.env.example` を提供。 |

## 10. 非機能方針 (安定性 > 最適化)
- **安定性最優先**: まずは server-v2 が提供するルールどおりにゲームを進行できることを重視。UI が応答遅延しても、例外や整合性崩壊が起きない設計とする。
- **早期最適化の回避**: レンダリングやステート計算のマイクロ最適化は後回し。複雑なメモ化や並列処理よりも、読みやすくデバッグしやすい実装を優先する。
- **UI ブロッキングの許容**: 相手ターン待ち中に UI スレッドがブロックされる簡易実装でも構わない。後続フェーズで必要に応じてスムーズな体験へ改善する。
- **可観測性の確保**: ログ/テレメトリを早期に導入し、安定性問題を検出しやすくする。

---
server-v2 の API/Socket 仕様を前提としたこの計画に沿って `client-v2` を構築することで、既存インフラを維持しながら新しい UI/UX を迅速に提供できる。
