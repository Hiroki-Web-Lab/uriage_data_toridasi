FROM node:18-slim

WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy source
COPY . .

ENV NODE_ENV=production

# Railway provides PORT at runtime; we keep a default in server.js (3000)
EXPOSE 3000

CMD ["node", "server.js"]


