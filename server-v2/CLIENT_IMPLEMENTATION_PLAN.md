# FF Poker Client v2 Implementation Plan

## 1. 概要
- **目的**: `server-v2` (REST + Socket.io) と連携する新クライアント (`client-v2`) を `client/` の設計思想・インフラを踏襲しつつ、ゲームフロー可視化/操作をフルサポートできる形で構築する。
- **対象**: テキサスホールデムのルーム作成〜ショーダウンまでを扱う Web クライアント (React + TypeScript, Vite ベース)。
- **方針**:
  - 既存 `client/` のプロジェクト構成 (Vite, React 19, Vitest, Playwright, SocketContext 等) を参照し、UI/状態管理/CI/CD のベースラインを共有。
  - インフラ (Netlify デプロイ: `netlify.toml` base=client, Node20 / Render API) は同じ想定。カットオーバー時に `base = "client-v2"` へ差し替えるだけで済むよう、同等の npm scripts・ビルド成果物 (`dist/`) を維持。
  - 完成後に `client-v2` へ入れ替える (既存 `client` は段階的廃止)。

## 2. 既存クライアントの参照ポイント
| 項目 | 現状 (`client/`) | v2 での扱い |
|---|---|---|
| ビルド/実行 | `npm run dev/build/test` (Vite, Node20) | 同一スクリプト名を `client-v2/package.json` で再現。CI/CD (Netlify, Playwright) が変更不要。
| Socket 接続 | `src/contexts/SocketContext.tsx` で `import.meta.env.VITE_SERVER_URL` を使用 | v2 でも `VITE_SERVER_URL` + `http://localhost:3001` fall back。`room:join/leave` の送信をこの層へ実装。
| 依存関係 | React 19, React Router 7, socket.io-client 4.8, Vitest/Playwright | 同バージョン or 上位互換を採用。React Query / Zustand などを追加拡張。
| インフラ | `netlify.toml` base=client, publish=dist | `client-v2` 完了後 base パスを差し替えるだけでOKな構造にする。
| テスト | `tests/`, Playwright, Vitest, `happy-dom` | `client-v2/tests` にテンプレをコピーし、WS/REST フローE2Eを追加。

## 3. ゴール & 成功指標
- ルーム作成/参加/開始/アクション/状態取得を UI 経由で実行。REST・WS 双方向の動作を再現できる。
- `room:updated` 通知で React Query キャッシュを再取得し、UI が 1秒未満で最新状態になる。
- ヘッズアップ～9人のシート表示、ステージ (preflop〜showdown) を視覚化。
- 「ルーム作成→2プレイヤー参加→1ハンド完走」を Playwright で自動化。
- Netlify/Render の既存パイプライン (Node20, `npm run build`) をそのまま流用できる。

## 4. ターゲットプラットフォーム & テックスタック
| 層 | 採用技術 | メモ |
|---|---|---|
| ビルド | Vite 7 + TypeScript 5.9 (既存 client と同設定) | `tsconfig.app/node.json`, `vitest.config.ts`, `playwright.config.ts` を client からコピーして調整。
| UI | React 19 + React Router 7 | ルーティング `/` (Lobby), `/rooms/:roomId` (RoomView)。
| 状態管理 | React Query (server state) + Zustand or Context (UI state) | `server-v2` 状態は Query キャッシュに集約。ローカル UI/モーダルは zustand。
| スタイル | Tailwind CSS (推奨) or CSS Modules | 既存 client の軽量CSSを参考にユーティリティベースで構築。
| WebSocket | socket.io-client 4.8.x | `SocketProvider` を client から進化させ、`room:join/leave` を標準化。
| API 型 | `openapi-typescript` で `server-v2/src/api/openapi.yaml` から生成 | `npm run generate:api` スクリプト追加。

## 5. アーキテクチャ & モジュール構成
```
client-v2/
├─ src/
│  ├─ main.tsx / App.tsx (Router, Providers)
│  ├─ providers/
│  │  ├─ QueryClientProvider
│  │  └─ SocketProvider (client/src/contexts 参考, server-v2専用拡張)
│  ├─ api/
│  │  ├─ openapi-generated/
│  │  └─ rooms.ts / actions.ts (fetch ラッパ)
│  ├─ features/
│  │  ├─ lobby/
│  │  └─ room/
│  ├─ components/
│  ├─ hooks/ (useRoomState, usePlayerAction 等)
│  └─ stores/ (Zustand: UI モーダル, ローカル設定)
├─ tests/ (Vitest + msw, Playwright)
└─ public/
```
- **API Layer**: OpenAPI 生成型 + `fetchJson` wrapper (client/utils を再利用)。
- **Socket Layer**: `useRoomSocket(roomId, playerId)` が `room:join/leave` を送受信し、`room:updated` を受けたら Query `invalidateQueries(['roomState', roomId])` を実行。
- **Game State Mapper**: REST 応答 (`serializeGameState`) を `RoomViewModel` へ変換（UI 向け sorted players, stage labels, pot summary）。

## 6. API / WebSocket 連携詳細
### REST (`server-v2/src/api/routes/*.ts`)
| Endpoint | 用途 | UI アクション | 型ソース |
|---|---|---|---|
| `POST /api/v1/rooms` | ルーム作成 | Lobby: CreateRoom モーダル | OpenAPI: `CreateRoomRequest` |
| `GET /api/v1/rooms/:roomId` | ルーム情報 | Lobby: ルーム状況 | `RoomResponse` |
| `POST /api/v1/rooms/:roomId/join` | プレイヤー参加 | Join フォーム | `JoinRoomRequest` |
| `POST /rooms/:roomId/start` | ゲーム開始 | Host Start ボタン | `StartGameResponse` |
| `POST /rooms/:roomId/actions` | プレイヤーアクション | ActionBar (fold/call/raise/allin) | `PlayerActionRequest` |
| `GET /rooms/:roomId/state?playerId=` | プレイヤー視点の状態 | RoomView 初期ロード + WS 更新後 | `GameStateResponse` |

### WebSocket (`server-v2/src/websocket/*`)
- 接続: `SocketProvider` で `io(VITE_SERVER_URL || http://localhost:3001)`。
- イベント:
  - emit `room:join {roomId, playerId}` (Route 入室時)。
  - emit `room:leave` (Route 離脱 or unmount)。
  - on `room:updated {roomId, updateType}` → `rooms/:roomId/state` を再フェッチ。
  - on `error` → Toast/Alert。
- `client/src/contexts/SocketContext.tsx` の再接続ロジックを流用し、playerId/roomId の整合チェックを追加 (サーバー指摘課題に合わせる)。

## 7. 主要ユーザーフロー
1. **Lobby**
   - 既存 client のレイアウトを踏襲しつつ、`server-v2` のルーム情報 API に差し替え。
   - Create/Join フォーム (React Hook Form + zod) で入力バリデーション。
2. **Join + 永続化**
   - `localStorage` に `{roomId, playerId, playerName}` を保存 (既存 client と同様)。
   - 再訪時は自動で Room に遷移。
3. **RoomView Sync**
   - 初回: `rooms/:roomId/state` をフェッチ → Query キャッシュ。
   - Socket 接続→`room:join`→`room:updated` 毎に再フェッチ。
4. **Game Start / Actions**
   - Host の Start ボタンで `POST /start`。
   - ActionBar で行動ボタンを押し `/actions` を呼び UI をロック → 成功で Query invalidate。
5. **Showdown 表示**
   - `stage` に応じてボード/ポット/勝者を表示。`GameService` の stage 進行に追従。
6. **再接続**
   - Socket 切断時: 指数バックオフで再接続 → `room:join` を再送 → `playerId` 不一致時は Join 画面へ誘導。

## 8. 実装フェーズ & タスク
| フェーズ | 目的 | 主タスク | 成果物 |
|---|---|---|---|
| Phase 0: プロジェクト作成 | `client-v2` 雛形 & インフラ互換 | `client/` から Vite 設定/tsconfig/eslint/vitest/playwright をコピー。`package.json` scripts を同一にし、Netlify/Render 変数 (`VITE_SERVER_URL`) を共有。 | `client-v2` 初期コミット |
| Phase 1: API/型基盤 | OpenAPI 型生成 & API ラッパ | `openapi-typescript` 導入、`npm run generate:api`、`fetcher.ts` 実装、msw handlers 追加。 | 型生成+APIユーティリティ |
| Phase 2: ロビーフロー | ルーム作成/参加 UI | Lobby ページ、Create/Join フォーム、ルーム一覧表示。既存 client の UI 部品を流用/改善。 | ルーム作成→参加が可能 |
| Phase 3: ルームビュー骨格 | プレイヤー/テーブル UI | PlayersPanel, TableStage, ActionBar, EventFeed を静的データで構築。Zustand ストア整備。 | UI モック |
| Phase 4: サーバー連携 | REST/WS 同期 & アクション | React Query で状態同期、`useRoomSocket` で `room:join/leave`、ActionBar→`POST /actions`、エラー処理。 | エンドツーエンドで一連操作が可能 |
| Phase 5: UX/履歴 | 体験向上 | アニメーション、ログ、ポット分配 UI、ホットキー等。 | 改善版 UI |
| Phase 6: QA/デプロイ | 品質保証 & 切替準備 | Vitest 追加 (hooks, components)、Playwright 2セッションテスト、Netlify base を `client-v2` に更新する手順書。 | リリース候補 & 切替準備完了 |

## 9. テスト / QA 戦略
- **ユニット (Vitest)**: hooks (useRoomSocket, usePlayerAction), stores, API クライアント (msw) を検証。
- **統合 (RTL + msw)**: Lobby フロー, RoomView アクション送信, エラーハンドリング。
- **E2E (Playwright)**: 2ブラウザ (Host/Guest) を立ち上げ `server-v2` と接続 → 1ハンド完走を検証。
- **パフォーマンス**: React Profiler & Lighthouse で初期表示 < 2s, インタラクション < 100ms を目安。
- **CI**: 既存 client と同一ワークフロー (npm install → npm run build/test) を `client-v2` へ適用。Netlify Preview で自動デプロイ。

## 10. リスク & 対応
| リスク | 影響 | 対策 |
|---|---|---|
| OpenAPI ファイルの配置 | 型生成や本番ビルドで参照不可 | `server-v2/src/api/openapi.yaml` を client-v2 にコピー or `pnpm dlx openapi-typescript ../server-v2/src/api/openapi.yaml` を CI で実行。サーバー側で dist へ同梱タスクも検討。 |
| Socket `room:leave` 検証不足 | 他プレイヤーへの影響 | `useRoomSocket` 内で `socket.data.playerId` と一致しない leave を送出しない、サーバー修正と併走。 |
| 既存 client との共存 | Netlify base の競合 | 切替まで `client/` を残し、`client-v2` は Preview branch で動作確認。カットオーバー手順を Phase 6 で定義。 |
| 認証導入時の再開発 | 将来の Auth 追加で大規模変更 | `AuthContext` のプレースホルダと API Hook の拡張ポイントを用意 (token header 挿入を一箇所に集約)。 |

---
この計画に従い、`client/` の実装・インフラ基盤を再活用しつつ `client-v2` を段階的に構築すれば、`server-v2` に適合したフロントエンドへ安全に移行できる。
