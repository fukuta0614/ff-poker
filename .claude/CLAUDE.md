# FF Poker - プロジェクトガイドライン

## プロジェクト概要

FF Pokerは、リアルタイムマルチプレイヤーテキサスホールデムポーカーゲームです。
モノレポ構成でReact + TypeScriptフロントエンドとNode.js + Expressバックエンドを開発します。

詳細な技術スタックは [docs/tech-stack.md](../docs/tech-stack.md) を参照してください。

## 開発プロセスの原則

### 1. テスト駆動開発 (TDD) の徹底

**すべての実装は必ずテストから始める**

#### TDDサイクル
1. **Red** - 失敗するテストを先に書く
2. **Green** - テストを通す最小限の実装
3. **Refactor** - コード品質を改善

#### テスト要件
- **サーバーサイド**: Jest を使用、カバレッジ 80% 以上
- **クライアントサイド**: Vitest + React Testing Library、カバレッジ 70% 以上
- **E2E**: Playwright でユーザーシナリオをカバー

#### 実装前のチェックリスト
- [ ] テストケースを洗い出したか？
- [ ] テストコードを先に書いたか？
- [ ] テストが失敗することを確認したか？
- [ ] 最小限の実装でテストを通したか？
- [ ] リファクタリング後もテストが通るか？

### 2. ドキュメント整備の義務

**コードを書いたら必ずドキュメントを更新する**

#### ドキュメント種別
1. **コード内ドキュメント**
   - 複雑なロジックには必ずコメント
   - 公開APIには JSDoc/TSDoc
   - 型定義には説明コメント

2. **機能ドキュメント**
   - 新機能追加時: `docs/features/` にマークダウン追加
   - API変更時: `docs/api/` を更新
   - 設計変更時: `docs/design/` を更新

3. **READMEの更新**
   - 環境構築手順の変更
   - 新しい依存関係の追加
   - 設定ファイルの変更

#### ドキュメント更新のタイミング
- 機能実装と同じPR内で必ず更新
- コミット前に関連ドキュメントをレビュー
- 古くなったドキュメントは削除または更新

### 3. コードレビューの実施

**自己レビューを含む多段階レビュー**

#### レビュー段階
1. **実装中レビュー** - リファクタリング時
2. **実装後レビュー** - 完成時にエージェントによる自動レビュー
3. **コミット前レビュー** - 最終確認

#### レビュー観点
- [ ] テストは十分か？（カバレッジ、境界値、エラーケース）
- [ ] セキュリティ脆弱性はないか？（XSS, SQL Injection, 環境変数漏洩）
- [ ] パフォーマンス問題はないか？
- [ ] TypeScript型定義は適切か？（any禁止）
- [ ] エラーハンドリングは適切か？
- [ ] コードの可読性は高いか？
- [ ] ドキュメントは更新されているか？

### 4. Git運用規約

#### ブランチ戦略
```
main (本番)
  └─ develop (開発)
       ├─ feature/機能名
       ├─ fix/バグ名
       └─ refactor/対象
```

#### コミットメッセージ規約
**Conventional Commits** を使用

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type一覧:**
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードフォーマット（機能に影響しない）
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: ビルド、ツール設定など

**例:**
```
feat(game): プレイヤーのベット機能を実装

- ベット額の入力バリデーション追加
- ベットアクションのサーバー連携
- 残高チェック機能

Closes #123
```

## コーディング規約

### TypeScript

- `any` 型は原則禁止（やむを得ない場合は `unknown` を使用）
- すべての関数に戻り値の型を明示
- `interface` よりも `type` を優先（Union型が使いやすい）
- Null安全性を保つ（Optional Chaining `?.` を活用）

### React

- 関数コンポーネントを使用（クラスコンポーネント禁止）
- カスタムフックで状態ロジックを分離
- PropTypesは使わず TypeScript の型定義を使用
- `useEffect` の依存配列は必ず指定

### 命名規則

- **コンポーネント**: PascalCase（例: `GameTable`, `PlayerCard`）
- **関数/変数**: camelCase（例: `handleBet`, `playerList`）
- **定数**: UPPER_SNAKE_CASE（例: `MAX_PLAYERS`, `DEFAULT_CHIPS`）
- **ファイル名**: kebab-case（例: `game-table.tsx`, `player-card.tsx`）
- **型定義**: PascalCase（例: `Player`, `GameState`）

### ファイル構成

#### クライアント (client/)
```
src/
  components/     # Reactコンポーネント
  hooks/          # カスタムフック
  contexts/       # Context API
  services/       # APIクライアント、WebSocket
  utils/          # ユーティリティ関数
  types/          # 共通型定義
  __tests__/      # テストファイル
```

#### サーバー (server/)
```
src/
  routes/         # Expressルート
  controllers/    # コントローラー
  services/       # ビジネスロジック
  models/         # データモデル
  utils/          # ユーティリティ関数
  types/          # 共通型定義
  __tests__/      # テストファイル
```

## セキュリティガイドライン

### 環境変数管理
- `.env` ファイルは **絶対に** Git管理しない
- `.env.example` でテンプレートを提供
- 環境変数は必ず `process.env` から読み込み、デフォルト値を設定

### 入力バリデーション
- クライアントとサーバー両方で検証
- Socket.io イベントの全入力を検証
- 型ガードを使用して実行時型チェック

### XSS対策
- ユーザー入力は常にサニタイズ
- dangerouslySetInnerHTML は原則禁止
- Content-Security-Policy ヘッダーを設定

## エージェントとコマンドの活用

### Tsumikiプラグイン活用

このプロジェクトでは Tsumiki プラグインを活用した開発フローを推奨します。

#### 大規模機能開発時: Kairoフロー
```bash
/tsumiki:kairo-requirements  # 要件定義
/tsumiki:kairo-design        # 技術設計
/tsumiki:kairo-tasks         # タスク分割
/tsumiki:kairo-implement     # TDD実装
```

#### 個別機能開発時: TDDコマンド
```bash
/tsumiki:tdd-requirements    # 要件整理
/tsumiki:tdd-testcases      # テストケース洗い出し
/tsumiki:tdd-red            # Redフェーズ（テスト作成）
/tsumiki:tdd-green          # Greenフェーズ（実装）
/tsumiki:tdd-refactor       # Refactorフェーズ
/tsumiki:tdd-verify-complete # 完了検証
```

### カスタムエージェント

- **code-reviewer**: 実装後の自動コードレビュー
- **test-writer**: テストケース作成支援
- **doc-generator**: ドキュメント生成・更新

### カスタムコマンド

- **/review**: コードレビュー実行
- **/commit**: レビュー済みコードのコミット作成

## マイルストーン

### マイルストーンA (プロトタイプ)
- 基本的なゲームフロー実装
- ローカル動作確認
- ユニットテスト整備

### マイルストーンB (安定化)
- Redis セッション管理
- 再接続ロジック
- ロギング機能

### マイルストーンC (UX改善・本番リリース)
- アニメーション
- エラートラッキング
- 本番デプロイ

## 開発環境

### 必須ツール
- Node.js 20.x LTS
- npm
- Docker & Docker Compose（Redis用）

### 推奨VSCode拡張機能
- ESLint
- Prettier
- TypeScript
- Tailwind CSS IntelliSense
- Error Lens

## トラブルシューティング

### よくある問題
1. **型エラー**: `npm run type-check` で確認
2. **テスト失敗**: モックの設定を確認
3. **WebSocket接続エラー**: CORSとポート設定を確認

### 質問・相談
- 実装方針の相談: まず設計ドキュメントを参照
- エラー解決: スタックトレース全体を共有
- 新機能提案: 要件定義から開始

---

## 重要な心構え

1. **テストなしのコードは負債** - 必ずテストを書く
2. **ドキュメントは未来の自分への手紙** - 丁寧に書く
3. **レビューは学びの機会** - 建設的にフィードバック
4. **セキュリティは後回しにしない** - 設計段階から考慮
5. **完璧を目指すより動くものを作る** - イテレーティブに改善

このガイドラインに従って、高品質で保守性の高いコードを書きましょう！
