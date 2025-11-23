# FF Poker ドキュメント

このディレクトリには、FF Pokerプロジェクトの各種ドキュメントが含まれています。

## ディレクトリ構成

```
docs/
├── README.md                    # このファイル
├── tech-stack.md                # 技術スタック定義
├── texas-holdem-rules.md        # テキサスホールデムルール
├── testing-guide.md             # テストガイド（ユニット/統合/E2E）
├── deployment.md                # デプロイメント手順
├── dev-notes.md                 # 開発メモ（技術的な問題と解決策）
├── design/                      # 設計文書
│   ├── README.md                # 設計文書の概要
│   ├── requirements.md          # 要件定義書
│   ├── architecture.md          # 技術設計書
│   ├── implementation-plan.md   # 実装計画・マイルストーン
│   └── milestone-b/             # マイルストーンB設計文書
│       ├── architecture.md      # マイルストーンB アーキテクチャ
│       ├── dataflow.md          # データフロー図
│       └── api-endpoints.md     # Socket.io API仕様
├── spec/                        # 要件仕様書
│   ├── milestone-b-requirements.md         # マイルストーンB 要件定義（EARS記法）
│   ├── milestone-b-user-stories.md         # マイルストーンB ユーザーストーリー
│   └── milestone-b-acceptance-criteria.md  # マイルストーンB 受入基準
└── archive/                     # 古いドキュメント（参照用）
    ├── README.md
    ├── fix-plan.md              # 旧：ゲームロジック修正計画
    ├── bug-report.md            # 旧：バグレポート
    └── test-design.md           # 旧：テスト設計書
```

## 📚 ドキュメント一覧

### プロジェクト基本情報

- **[技術スタック](./tech-stack.md)** - 使用技術とツールの一覧
- **[テキサスホールデムルール](./texas-holdem-rules.md)** - ゲームルール解説
- **[テストガイド](./testing-guide.md)** - ユニット/統合/E2Eテストの説明と実践方法
- **[デプロイメント](./deployment.md)** - Netlify/Renderへのデプロイ手順
- **[開発メモ](./dev-notes.md)** - 開発中の技術的問題と解決策

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

#### マイルストーンB設計文書 (design/milestone-b/)

- **[architecture.md](./design/milestone-b/architecture.md)** - マイルストーンB アーキテクチャ
  - RAM管理セッション
  - ターンタイマー管理
  - ロギング機能

- **[dataflow.md](./design/milestone-b/dataflow.md)** - データフロー図
  - 再接続フロー
  - タイムアウトフロー
  - エラーハンドリングフロー

- **[api-endpoints.md](./design/milestone-b/api-endpoints.md)** - Socket.io API仕様
  - 新規イベント定義
  - エラーコード一覧

### 要件仕様書 (spec/)

マイルストーンBの詳細仕様

- **[milestone-b-requirements.md](./spec/milestone-b-requirements.md)** - 要件定義（EARS記法）
  - 123の詳細要件
  - セッション管理、再接続、タイムアウト、エラーハンドリング、ロギング

- **[milestone-b-user-stories.md](./spec/milestone-b-user-stories.md)** - ユーザーストーリー
  - ペルソナ定義
  - 利用シナリオ

- **[milestone-b-acceptance-criteria.md](./spec/milestone-b-acceptance-criteria.md)** - 受入基準
  - テストシナリオ
  - パフォーマンス基準

### アーカイブ (archive/)

古いドキュメント（参照用、更新されません）

- **fix-plan.md** - 旧：ゲームロジック修正計画（マイルストーンA完了により不要）
- **bug-report.md** - 旧：バグレポート（修正完了により不要）
- **test-design.md** - 旧：テスト設計書（統合テスト実装完了により不要）

## ドキュメント作成ルール

1. **Markdown形式**: すべてのドキュメントは `.md` 形式で作成
2. **命名規則**: kebab-case（例: `player-management.md`）
3. **更新日記載**: ドキュメント末尾に最終更新日を記載
4. **相互リンク**: 関連ドキュメントへのリンクを積極的に追加
5. **コード例**: 可能な限り具体的なコード例を含める

## ドキュメント更新のタイミング

- **新機能追加時**: spec/ に要件を、design/ に設計を追加
- **API変更時**: design/milestone-*/api-endpoints.md を更新
- **アーキテクチャ変更時**: design/ のドキュメント更新
- **環境構築手順変更時**: README.md または deployment.md を更新
- **問題解決時**: dev-notes.md に記録

## 現在の開発状況

- ✅ **マイルストーンA**: プロトタイプ完了
- 🚧 **マイルストーンB**: 安定化（実装完了、テスト中）
- ⏳ **マイルストーンC**: UX改善（未着手）

---

最終更新: 2025-11-23
