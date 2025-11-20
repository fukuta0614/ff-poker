# Node.js 20 LTS Alpine image
FROM node:20-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係をインストール（本番用のみ）
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# TypeScriptをビルド
RUN npm run build

# ポート3000を公開
EXPOSE 3000

# 本番サーバーを起動
CMD ["npm", "start"]
