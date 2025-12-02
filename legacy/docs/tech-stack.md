# 技術スタック定義

## プロジェクト構成

このプロジェクトはモノレポ構成で、クライアントとサーバーを同一リポジトリで管理します。

```
/ff-poker
  /client     # フロントエンドアプリケーション
  /server     # バックエンドサーバー
  /docs       # ドキュメント
```

## フロントエンド (client/)

### コアフレームワーク
- **React** 18.x - UIフレームワーク
- **TypeScript** 5.x - 型安全な開発
- **Vite** 5.x - 高速ビルドツール

### 状態管理
- **React Context API** - グローバル状態管理
- **useReducer** - 複雑な状態ロジック

### リアルタイム通信
- **socket.io-client** 4.x - WebSocket通信

### UIライブラリ
- **Tailwind CSS** 3.x - ユーティリティファーストCSS
- **framer-motion** 11.x - アニメーション (マイルストーンC)

### ルーティング
- **React Router** 6.x - SPA ルーティング

### 開発ツール
- **ESLint** - 静的解析
- **Prettier** - コードフォーマッター
- **TypeScript ESLint** - TypeScript用ESLintルール

### テスト
- **Vitest** - 高速ユニットテスト (Vite統合)
- **React Testing Library** - Reactコンポーネントテスト
- **Playwright** - E2Eテスト

## バックエンド (server/)

### ランタイム・フレームワーク
- **Node.js** 20.x (LTS) - JavaScriptランタイム
- **TypeScript** 5.x - 型安全な開発
- **Express** 4.x - Webフレームワーク

### リアルタイム通信
- **socket.io** 4.x - WebSocketサーバー

### データストア (オプション)
- **Redis** 7.x - セッション管理、ステート保存 (マイルストーンB以降)
- **PostgreSQL** 16.x - 監査ログ (オプション)

### ゲームロジック
- **pokersolver** 2.x - ポーカー役判定ライブラリ

### ユーティリティ
- **uuid** 9.x - ユニークID生成
- **dotenv** 16.x - 環境変数管理

### ロギング・モニタリング
- **winston** 3.x - ロギングライブラリ (マイルストーンB)
- **Sentry** - エラートラッキング (マイルストーンC)

### 開発ツール
- **ESLint** - 静的解析
- **Prettier** - コードフォーマッター
- **TypeScript ESLint** - TypeScript用ESLintルール
- **nodemon** - 開発時の自動再起動
- **ts-node** - TypeScript直接実行

### テスト
- **Jest** 29.x - ユニットテスト・統合テスト
- **ts-jest** - TypeScript対応
- **@types/jest** - Jest型定義

## インフラ

### 開発環境
- **Docker** - Redis等のローカル開発環境
- **Docker Compose** - 複数コンテナ管理

### CI/CD
- **GitHub Actions** - CI/CDパイプライン

### デプロイ (マイルストーンC)
- **Vercel** - フロントエンドホスティング
- **Render** または **Fly.io** - バックエンドホスティング
- **Upstash Redis** - マネージドRedis

## 開発規約

### コーディングスタイル
- **ESLint + Prettier** による自動フォーマット
- **Conventional Commits** によるコミットメッセージ規約

### ブランチ戦略
```
main (本番)
  └─ develop (開発)
       ├─ feature/xxx
       ├─ fix/xxx
       └─ refactor/xxx
```

### テスト戦略
- **TDD (Test-Driven Development)** - テストファースト開発
- **ユニットテストカバレッジ**: サーバー80%以上、クライアント70%以上
- **統合テスト**: 主要フロー全体をカバー
- **E2Eテスト**: ユーザーシナリオベース

## パッケージマネージャ

- **npm** - 依存関係管理 (デフォルト)

## Node.js バージョン管理

- **.nvmrc** - Node.jsバージョン指定 (20.x LTS)

## エディタ設定

### 推奨拡張機能 (VSCode)
- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense
- Error Lens

### .editorconfig
- インデント: 2スペース
- 改行: LF
- 文字コード: UTF-8
- 末尾空白削除: true

## セキュリティ

### 依存関係
- 定期的な `npm audit` 実行
- Dependabot による自動アップデート

### 環境変数
- `.env` ファイルで管理 (Git管理外)
- `.env.example` でテンプレート提供

## 環境変数

### クライアント (.env)
```
VITE_SERVER_URL=http://localhost:3000
```

### サーバー (.env)
```
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://... (オプション)
CORS_ORIGIN=http://localhost:5173
```

## マイルストーン別の技術導入

### マイルストーンA (プロトタイプ)
- React + Vite + TypeScript
- Express + Socket.io + TypeScript
- Jest (サーバーユニットテスト)
- Vitest (クライアントユニットテスト)

### マイルストーンB (安定化)
- Redis (セッション管理)
- winston (ロギング)
- 再接続ロジック

### マイルストーンC (UX改善)
- framer-motion (アニメーション)
- Sentry (エラートラッキング)
- Vercel/Render (デプロイ)
- Upstash Redis (マネージドRedis)

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-11-19 | 1.0 | 初版作成 (Tsumiki導入に伴う技術スタック明文化) |
