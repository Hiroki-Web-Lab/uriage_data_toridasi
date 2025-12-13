FROM node:18-slim

WORKDIR /app

# Copy source first (Railwayのビルドコンテキスト差異で package.json が欠ける事故を避ける)
COPY . .

# Install deps
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

ENV NODE_ENV=production

# Railway provides PORT at runtime; we keep a default in server.js (3000)
EXPOSE 3000

CMD ["node", "server.js"]


