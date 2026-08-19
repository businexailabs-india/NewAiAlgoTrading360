# Backend image — run with transpile-only (matches local nodemon/ts-node workflow).
# Full `tsc` currently has pre-existing type errors; Docker uses runtime transpile.

FROM node:20-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

RUN npx prisma generate

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=8 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

CMD ["sh", "-c", "if [ \"$PRISMA_SCHEMA_PUSH\" = \"true\" ]; then npx prisma db push --accept-data-loss; else npx prisma migrate deploy; fi; npx ts-node --transpile-only src/server.ts"]
