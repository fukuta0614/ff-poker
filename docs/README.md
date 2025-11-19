# FF Poker ドキュメント

このディレクトリには、FF Pokerプロジェクトの各種ドキュメントが含まれています。

## ディレクトリ構成

```
docs/
├── README.md          # このファイル
├── tech-stack.md      # 技術スタック定義
├── api/               # API仕様書（今後追加）
├── features/          # 機能説明（今後追加）
├── design/            # 設計文書・計画
│   ├── requirements.md         # 要件定義書（旧 specification.md）
│   ├── architecture.md         # 技術設計書（旧 design.md）
│   └── implementation-plan.md  # 実装計画・マイルストーン
└── guides/            # 使い方ガイド（今後追加）
```

## ドキュメント一覧

### プロジェクト基本情報
- [技術スタック](./tech-stack.md) - 使用技術とツールの一覧

### 設計文書 (design/)
プロジェクトの要件定義から実装計画まで

- **[requirements.md](./design/requirements.md)** - 要件定義書
  - プロジェクト概要、MVP機能要件、技術要件
  - データモデル仕様、API仕様
  - セキュリティ要件、非機能要件

- **[architecture.md](./design/architecture.md)** - 技術設計書
  - システムアーキテクチャ
  - フロントエンド/バックエンド設計
  - ゲームロジック設計、通信設計
  - データフロー、インフラ設計
  - セキュリティ・チート対策

- **[implementation-plan.md](./design/implementation-plan.md)** - 実装計画
  - 開発マイルストーン（A/B/C）
  - タスク分割とチェックリスト
  - テスト計画、リスクと対応策

### API仕様書 (api/)
WebSocket イベントや REST API の詳細仕様（実装時に追加）

### 機能説明 (features/)
実装された各機能の詳細な説明（実装時に追加）

### ガイド (guides/)
開発環境構築、デプロイ手順などの実践的なガイド（今後追加）

## ドキュメント作成ルール

1. **Markdown形式**: すべてのドキュメントは `.md` 形式で作成
2. **命名規則**: kebab-case（例: `player-management.md`）
3. **更新日記載**: ドキュメント末尾に最終更新日を記載
4. **相互リンク**: 関連ドキュメントへのリンクを積極的に追加
5. **コード例**: 可能な限り具体的なコード例を含める

## ドキュメント更新のタイミング

- **新機能追加時**: features/ にドキュメント追加
- **API変更時**: api/ のドキュメント更新
- **アーキテクチャ変更時**: design/ のドキュメント更新
- **環境構築手順変更時**: guides/ のドキュメント更新

---

最終更新: 2025-11-19
