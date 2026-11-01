# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl su-exec
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=1400
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/data/voz-torres-vedras.db
ENV SNAPSHOT_DIR=/app/snapshot

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Prisma CLI, tsx, recolha de dados e cópia inicial: usados no arranque e nas atualizações.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/lib ./src/lib
COPY --from=build /app/ingestion ./ingestion
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/data/snapshot ./snapshot
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/data && chown -R app:app /app/data
VOLUME /app/data
EXPOSE 1400

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -qO- http://127.0.0.1:1400/api/health || exit 1

# Arranca como root só para ajustar a pasta montada; depois passa para o utilizador app.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
