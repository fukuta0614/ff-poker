# FF Poker v2.0

Fast & Fair Poker - リアルタイムマルチプレイヤーテキサスホールデムポーカーゲーム

## 概要

WebSocketを使用したリアルタイムマルチプレイヤーポーカーゲーム。v2.0では**statelessなgame_engine**を中心とした新しいアーキテクチャで再設計。

**主な特徴**:
- Pure Function Game Engine (stateless)
- 楽観的更新による優れたUX
- 5層テストレイヤー構成

## クイックスタート

### 必要な環境

- Node.js 20.x LTS
- npm

### セットアップ

```bash
# サーバー
cd server
npm install
cp .env.example .env
npm run dev

# クライアント (別ターミナル)
cd client
npm install
cp .env.example .env
npm run dev
```

ブラウザで http://localhost:5173 を開く

### テスト実行

```bash
# サーバー
cd server
npm test
npm run test:coverage

# クライアント
cd client
npm test
npm run test:e2e
```

## ドキュメント

| ドキュメント | 説明 | 対象読者 |
|-------------|------|---------|
| [要件定義書](docs/requirements.md) | 機能要件・非機能要件・開発フェーズ | 全員 |
| [設計書](docs/design.md) | アーキテクチャ・API設計・データモデル | 開発者 |
| [開発ガイドライン](.claude/CLAUDE.md) | コーディング規約・TDD手順・git運用 | 開発者 |

## 開発フロー

### TDD開発 (推奨)

```bash
/tsumiki:tdd-requirements    # 要件整理
/tsumiki:tdd-testcases       # テストケース洗い出し
/tsumiki:tdd-red             # テスト作成
/tsumiki:tdd-green           # 実装
/tsumiki:tdd-refactor        # リファクタリング
/tsumiki:tdd-verify-complete # 完了検証
```

### コミット前

```bash
/review   # コードレビュー
/commit   # コミット作成
```

## プロジェクト構成

```
ff-poker/
├── server/          # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── game_engine/   # ゲームロジック (stateless)
│   │   ├── room/          # Room管理
│   │   └── socket/        # WebSocket通信
│   └── test/
├── client/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   └── hooks/
│   └── test/
├── docs/            # 要件定義書・設計書
└── .claude/         # 開発ガイドライン
```

## 技術スタック

- **Backend**: Node.js 20, Express, Socket.io, TypeScript, Jest
- **Frontend**: React 18, Vite, Vitest, Playwright, TypeScript

詳細は [docs/requirements.md](docs/requirements.md#14-技術スタック) を参照

## ライセンス

MIT

---

**参考**: [Legacy実装](legacy/) - v1.0の実装
