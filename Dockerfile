FROM node:24.14.0-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN addgroup -S sasha && adduser -S -G sasha sasha \
  && mkdir -p /app/.data \
  && chown -R sasha:sasha /app

USER sasha
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4173/api/health >/dev/null || exit 1

CMD ["node", "server.mjs"]
