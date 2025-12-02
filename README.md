# FF Poker v2.0

Fast & Fair Poker - リアルタイムマルチプレイヤーテキサスホールデムポーカーゲーム

## プロジェクト概要

FF Pokerは、WebSocketを使用したリアルタイムマルチプレイヤーポーカーゲームです。
v2.0では、**statelessなgame_engine**を中心とした新しいアーキテクチャで再設計されています。

### 主な特徴

- **Pure Function Game Engine**: statelessな純粋関数でゲームロジックを実装
- **シンプルな通信設計**: action/response + stateUpdated broadcast方式
- **楽観的更新**: 即座のUI反映による優れたUX
- **5層テストレイヤー**: server/client unit/integration + e2e

## ドキュメント

- [要件定義書](docs/requirements.md) - 機能要件・非機能要件
- [設計書](docs/design.md) - アーキテクチャ・詳細設計
- [開発ガイドライン](.claude/CLAUDE.md) - コーディング規約・開発フロー

## プロジェクト構成

```
ff-poker/
├── server/                 # Node.js + Express + Socket.io
│   ├── src/
│   │   ├── game_engine/   # ゲームロジック (stateless)
│   │   ├── room/          # Room管理 (stateful)
│   │   ├── socket/        # WebSocket通信層
│   │   ├── services/      # SessionManager, TurnTimer等
│   │   └── types/         # 型定義
│   └── test/
│       ├── unit/          # 単体テスト
│       └── integration/   # 統合テスト
│
├── client/                # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # Reactコンポーネント
│   │   ├── contexts/     # Context API (State管理)
│   │   ├── hooks/        # カスタムフック
│   │   └── types/        # 型定義
│   └── test/
│       ├── unit/         # 単体テスト
│       ├── integration/  # 統合テスト
│       └── e2e/          # E2Eテスト (Playwright)
│
├── docs/                 # ドキュメント
├── legacy/               # 旧実装 (参考用)
└── .claude/              # Claude Code設定

```

## セットアップ

### 必要な環境

- Node.js 20.x LTS
- npm

### サーバー側

```bash
cd server
npm install
cp .env.example .env

# 開発サーバー起動
npm run dev

# テスト実行
npm test

# カバレッジ確認
npm run test:coverage
```

### クライアント側

```bash
cd client
npm install
cp .env.example .env

# 開発サーバー起動
npm run dev

# テスト実行
npm test

# E2Eテスト
npm run test:e2e
```

## 開発フロー

### TDD開発

すべての実装はテスト駆動開発(TDD)で進めます。

```bash
# 要件整理
/tsumiki:tdd-requirements

# テストケース洗い出し
/tsumiki:tdd-testcases

# Redフェーズ (テスト作成)
/tsumiki:tdd-red

# Greenフェーズ (実装)
/tsumiki:tdd-green

# Refactorフェーズ
/tsumiki:tdd-refactor

# 完了検証
/tsumiki:tdd-verify-complete
```

### コミット前

```bash
# コードレビュー
/review

# コミット作成
/commit
```

## テスト

### Server

```bash
cd server

# 全テスト実行
npm test

# unit testのみ
npm test -- test/unit

# integration testのみ
npm test -- test/integration

# カバレッジ確認
npm run test:coverage
```

### Client

```bash
cd client

# unit test
npm run test

# E2E test
npm run test:e2e

# E2E test (UI mode)
npm run test:e2e:ui
```

## 開発フェーズ

### Phase 1: コア実装 (現在)

- [ ] game_engine モジュールの実装
- [ ] Room管理モジュールの実装
- [ ] WebSocket通信層の実装
- [ ] 基本UI実装

### Phase 2: UX改善

- [ ] 楽観的更新の実装
- [ ] 再接続機能
- [ ] ターンタイムアウト

### Phase 3: 本番対応

- [ ] Redis統合
- [ ] ロギング・監視
- [ ] デプロイ設定

## 技術スタック

### Backend

- Node.js 20.x
- Express
- Socket.io
- TypeScript
- Jest

### Frontend

- React 18
- TypeScript
- Vite
- Vitest
- Playwright

## ライセンス

MIT

## 参考

- [Legacy実装](legacy/) - v1.0の実装 (参考用)
