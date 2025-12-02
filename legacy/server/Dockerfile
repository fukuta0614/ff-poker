# Node.js 20 LTS Alpine image
FROM node:20-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 全依存関係をインストール（ビルドに必要）
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# 本番用依存関係のみを再インストール（軽量化）
RUN npm prune --production

# ポート3000を公開
EXPOSE 3000

# 本番サーバーを起動
CMD ["npm", "start"]
