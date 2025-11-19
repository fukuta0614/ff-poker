# FF Poker

リアルタイムマルチプレイヤー対応のテキサスホールデムポーカーゲーム

## 特徴

- リアルタイム対戦（WebSocket通信）
- 最大6人同時プレイ
- モダンなReact + TypeScript フロントエンド
- スケーラブルなNode.js + Express バックエンド

## 技術スタック

詳細は [docs/tech-stack.md](./docs/tech-stack.md) を参照

- **フロントエンド**: React 18, TypeScript, Vite, Tailwind CSS
- **バックエンド**: Node.js 20, Express, Socket.io, TypeScript
- **テスト**: Jest, Vitest, React Testing Library, Playwright
- **開発**: TDD (Test-Driven Development)

## プロジェクト構成

```
/ff-poker
  /client     # フロントエンドアプリケーション
  /server     # バックエンドサーバー
  /docs       # ドキュメント
  /.claude    # Claude Code設定
```

## 環境構築

### 必要な環境

- Node.js 20.x LTS
- npm
- Docker & Docker Compose (Redis用、マイルストーンB以降)

### インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd ff-poker

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env ファイルを編集
```

### 開発サーバー起動

```bash
# 開発サーバー起動（フロントエンドとバックエンド）
npm run dev

# または個別に起動
npm run dev:client  # http://localhost:5173
npm run dev:server  # http://localhost:3000
```

### テスト実行

```bash
# すべてのテスト実行
npm test

# クライアントのテスト
npm run test:client

# サーバーのテスト
npm run test:server

# E2Eテスト
npm run test:e2e

# カバレッジ確認
npm run test:coverage
```

## 開発フロー

このプロジェクトは **テスト駆動開発（TDD）** で進めます。

### 基本フロー

1. **要件定義**: `/tsumiki:tdd-requirements`
2. **テストケース作成**: `/tsumiki:tdd-testcases`
3. **Red**: `/tsumiki:tdd-red` - 失敗するテストを書く
4. **Green**: `/tsumiki:tdd-green` - テストを通す最小実装
5. **Refactor**: `/tsumiki:tdd-refactor` - コード改善
6. **レビュー**: `/review` - 自動コードレビュー
7. **ドキュメント**: `/doc` - ドキュメント生成
8. **コミット**: `/commit` - Conventional Commits形式

### 大規模機能開発

Kairoフローを使用:

```bash
/tsumiki:kairo-requirements  # 要件定義
/tsumiki:kairo-design        # 技術設計
/tsumiki:kairo-tasks         # タスク分割
/tsumiki:kairo-implement     # 実装
```

## コーディング規約

詳細は [.claude/CLAUDE.md](./.claude/CLAUDE.md) を参照

- TypeScript: `any`型禁止、明示的な型定義
- React: 関数コンポーネント、カスタムフック活用
- 命名: PascalCase (コンポーネント)、camelCase (関数/変数)
- コミット: Conventional Commits

## ブランチ戦略

```
main (本番)
  └─ develop (開発)
       ├─ feature/機能名
       ├─ fix/バグ名
       └─ refactor/対象
```

## マイルストーン

### マイルストーンA (プロトタイプ) - 現在
- 基本的なゲームフロー
- ローカル動作
- ユニットテスト整備

### マイルストーンB (安定化)
- Redisセッション管理
- 再接続ロジック
- ロギング

### マイルストーンC (本番リリース)
- アニメーション
- エラートラッキング
- デプロイ

## ドキュメント

- [技術スタック](./docs/tech-stack.md)
- [API仕様](./docs/api/)
- [機能説明](./docs/features/)
- [設計文書](./docs/design/)
- [開発ガイド](./docs/guides/)

## ライセンス

MIT

---

最終更新: 2025-11-19
