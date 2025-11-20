# FF Poker デプロイ手順書

このドキュメントでは、FF Pokerを本番環境（Netlify + Render）にデプロイする手順を説明します。

## 概要

- **フロントエンド**: Netlify（無料プラン）
- **バックエンド**: Render（無料プラン）
- **自動デプロイ**: GitHubのmainブランチにpushすると自動的にデプロイ

## 前提条件

- GitHubアカウント
- Netlifyアカウント
- Renderアカウント
- GitHubにリポジトリがpushされていること

---

## 1. バックエンドのデプロイ（Render）

### 1.1 Renderアカウント作成

1. [Render](https://render.com/)にアクセス
2. GitHubアカウントでサインアップ

### 1.2 新しいWebサービスを作成

1. Renderダッシュボードで「New +」→「Web Service」をクリック
2. GitHubリポジトリを接続（初回は認証が必要）
3. `ff-poker`リポジトリを選択

### 1.3 ビルド設定

以下の設定を入力：

| 項目 | 値 |
|------|-----|
| **Name** | `ff-poker-server`（任意の名前） |
| **Region** | `Oregon (US West)` または最寄りのリージョン |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Docker` |
| **Instance Type** | `Free` |

### 1.4 環境変数の設定

「Environment」タブで以下の環境変数を設定：

| Key | Value | 説明 |
|-----|-------|------|
| `NODE_ENV` | `production` | 本番環境 |
| `PORT` | `3000` | ポート番号（自動設定される場合あり） |
| `CORS_ORIGIN` | `https://your-app.netlify.app` | ※後で更新 |
| `LOG_LEVEL` | `info` | ログレベル |

**注意**: `CORS_ORIGIN`はNetlifyのデプロイ後に正しいURLに更新してください。

### 1.5 デプロイ実行

1. 「Create Web Service」をクリック
2. ビルドが開始され、数分で完了します
3. デプロイ完了後、URLが表示されます（例: `https://ff-poker-server.onrender.com`）
4. **このURLをメモしておく**（Netlifyの環境変数で使用）

---

## 2. フロントエンドのデプロイ（Netlify）

### 2.1 Netlifyにログイン

1. [Netlify](https://www.netlify.com/)にログイン

### 2.2 新しいサイトを作成

1. 「Add new site」→「Import an existing project」をクリック
2. 「GitHub」を選択
3. `ff-poker`リポジトリを選択

### 2.3 ビルド設定

以下の設定を確認（`netlify.toml`が自動的に読み込まれます）：

| 項目 | 値 |
|------|-----|
| **Branch to deploy** | `main` |
| **Base directory** | `client` |
| **Build command** | `npm run build` |
| **Publish directory** | `client/dist` |

### 2.4 環境変数の設定

「Site settings」→「Environment variables」で以下を追加：

| Key | Value | 説明 |
|-----|-------|------|
| `VITE_SERVER_URL` | `https://ff-poker-server.onrender.com` | RenderのURL |

**重要**: RenderでメモしたURLをここに設定してください。

### 2.5 デプロイ実行

1. 「Deploy site」をクリック
2. ビルドが開始され、1-2分で完了
3. デプロイ完了後、URLが表示されます（例: `https://ff-poker-xxxxx.netlify.app`）

### 2.6 Renderの環境変数を更新

1. Renderダッシュボードに戻る
2. `ff-poker-server`サービスを選択
3. 「Environment」タブで`CORS_ORIGIN`を更新：
   - 値: NetlifyのURL（例: `https://ff-poker-xxxxx.netlify.app`）
4. 「Save Changes」をクリック（自動的に再デプロイされます）

---

## 3. 自動デプロイの確認

### 3.1 自動デプロイの仕組み

```
git push origin main
  ↓
GitHub
  ↓
├─→ Netlify が検知 → client ビルド → デプロイ (1-2分)
└─→ Render が検知 → server ビルド → デプロイ (3-5分)
```

### 3.2 動作確認

1. コードを変更してコミット：
   ```bash
   git add .
   git commit -m "test: deployment test"
   git push origin main
   ```

2. Netlifyダッシュボードで「Deploys」タブを確認
3. Renderダッシュボードで「Events」タブを確認
4. 両方のビルドが成功することを確認

---

## 4. トラブルシューティング

### 問題: Renderのビルドが失敗する

**原因**: Dockerfileの設定ミスまたは依存関係の問題

**解決方法**:
1. Renderのログを確認
2. ローカルでDockerビルドを試す：
   ```bash
   cd server
   docker build -t ff-poker-server .
   docker run -p 3000:3000 ff-poker-server
   ```

### 問題: Netlifyのビルドが失敗する

**原因**: ビルドコマンドまたは環境変数の設定ミス

**解決方法**:
1. Netlifyのビルドログを確認
2. ローカルで本番ビルドを試す：
   ```bash
   cd client
   npm run build
   ```

### 問題: フロントエンドからバックエンドに接続できない

**原因**: CORSまたは環境変数の設定ミス

**解決方法**:
1. Renderの`CORS_ORIGIN`がNetlifyのURLと一致するか確認
2. Netlifyの`VITE_SERVER_URL`がRenderのURLと一致するか確認
3. ブラウザのコンソールでエラーを確認

### 問題: Renderのサーバーがスリープしている

**原因**: Renderの無料プランは15分アクセスがないとスリープします

**解決方法**:
1. 初回アクセスは10-30秒待つ
2. ローディング画面を実装（推奨）
3. 外部サービスで定期的にpingする（例: UptimeRobot）
4. 有料プラン（$7/月）にアップグレード

---

## 5. カスタムドメインの設定（オプション）

### Netlifyでカスタムドメイン設定

1. Netlifyダッシュボードで「Domain settings」をクリック
2. 「Add custom domain」で独自ドメインを追加
3. DNS設定を更新（Netlify DNSまたは既存のDNS）
4. SSL証明書が自動的に発行されます

### Renderでカスタムドメイン設定

1. Renderダッシュボードで「Settings」→「Custom Domain」をクリック
2. ドメインを追加
3. DNS設定を更新
4. SSL証明書が自動的に発行されます

---

## 6. 本番環境の監視

### ログの確認

- **Render**: ダッシュボードの「Logs」タブ
- **Netlify**: ダッシュボードの「Functions」→「Logs」

### パフォーマンス監視

- Netlify Analytics（有料）
- Google Analytics
- Sentry（エラートラッキング）

---

## 7. 環境変数一覧

### バックエンド（Render）

| 変数名 | 開発環境 | 本番環境 | 説明 |
|--------|----------|----------|------|
| `NODE_ENV` | `development` | `production` | 実行環境 |
| `PORT` | `3000` | `3000` | ポート番号 |
| `CORS_ORIGIN` | `http://localhost:5173` | `https://your-app.netlify.app` | 許可するオリジン |
| `LOG_LEVEL` | `debug` | `info` | ログレベル |

### フロントエンド（Netlify）

| 変数名 | 開発環境 | 本番環境 | 説明 |
|--------|----------|----------|------|
| `VITE_SERVER_URL` | `http://localhost:3000` | `https://your-api.onrender.com` | バックエンドURL |

---

## 8. デプロイチェックリスト

デプロイ前に以下を確認してください：

- [ ] すべてのテストが通る（`npm test`）
- [ ] ビルドが成功する（`npm run build`）
- [ ] 環境変数が正しく設定されている
- [ ] `.env`ファイルがGitに含まれていない
- [ ] `README.md`が最新である
- [ ] セキュリティ脆弱性がない（`npm audit`）

---

## 9. コスト試算

### 無料プラン（現在）

| サービス | プラン | 月額コスト | 制限事項 |
|----------|--------|------------|----------|
| Netlify | Free | $0 | 100GB帯域、300分ビルド |
| Render | Free | $0 | 15分でスリープ、750時間/月 |
| **合計** | - | **$0** | - |

### 有料プラン（本番運用推奨）

| サービス | プラン | 月額コスト | メリット |
|----------|--------|------------|----------|
| Netlify | Pro | $0-19 | 必要に応じて |
| Render | Starter | $7 | スリープなし、常時起動 |
| **合計** | - | **$7-26** | - |

---

## 10. 次のステップ

デプロイが完了したら：

1. カスタムドメインの設定
2. Google Analyticsの導入
3. Sentryでエラートラッキング
4. CI/CDの改善（GitHub Actions）
5. パフォーマンス最適化

---

## 参考リンク

- [Netlify Documentation](https://docs.netlify.com/)
- [Render Documentation](https://render.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [Socket.io Documentation](https://socket.io/docs/)

---

最終更新: 2025-11-20
