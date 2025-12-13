FROM node:20-slim

WORKDIR /app

# Copy source first (Railwayのビルドコンテキスト差異で package.json が欠ける事故を避ける)
COPY . .

# Install deps
RUN set -eux; \
  echo "== Build context snapshot =="; \
  ls -la; \
  if [ ! -f package.json ]; then \
    echo "ERROR: /app/package.json が見つかりません。Railwayの Settings → Source → Root Directory がリポジトリ直下（空 or '.'）になっているか確認してください。"; \
    echo "package.json candidates:"; \
    find . -maxdepth 4 -name package.json -print || true; \
    exit 1; \
  fi; \
  if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

ENV NODE_ENV=production

# Railway provides PORT at runtime; we keep a default in server.js (3000)
EXPOSE 3000

CMD ["node", "server.js"]


