---
description: レビュー完了後に適切なコミットメッセージでコミットを作成する
allowed-tools: Bash, Read, Grep, Glob
---

レビュー完了後、Conventional Commits形式でコミットを作成します。

実行内容：
1. git statusで変更ファイルを確認
2. git diffで変更内容を確認
3. git logで最近のコミットメッセージスタイルを確認
4. 適切なコミットメッセージを生成（type, scope, subject, body, footer）
5. 変更をステージング
6. コミット作成

コミットメッセージ形式:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Type一覧:
- feat: 新機能
- fix: バグ修正
- docs: ドキュメント
- style: フォーマット
- refactor: リファクタリング
- test: テスト
- chore: ビルド・設定

コミット後にgit statusで成功を確認します。
