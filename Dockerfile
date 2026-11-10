FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache tzdata

# Full dependencies for build/compile only (skip native postinstall scripts like esbuild/tsx)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# Production-only dependencies (includes argon2 prebuild/install, excludes tsx/esbuild/eslint)
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM deps AS builder
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN npx tsc -p tsconfig.tasks.json && npx tsc-alias -p tsconfig.tasks.json

FROM base AS app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

FROM base AS tasks
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist-tasks ./dist-tasks
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations

USER worker
