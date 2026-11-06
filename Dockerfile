# שרת משווה: API + בדיקת התראות מחיר. הנתונים (מטמון, היסטוריה, מעקבים) נשמרים ב-/data – כדאי לחבר אליו דיסק קבוע.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=3000 CACHE_DIR=/data/cache LEARNED_FILE=/data/learned-products.json \
    HISTORY_FILE=/data/price-history.json WATCHES_FILE=/data/watches.json ALERTS_INTERVAL_HOURS=6
VOLUME /data
EXPOSE 3000
CMD ["node", "server/index.js"]
