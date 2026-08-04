FROM node:22-alpine AS base
# Must match the root package.json "packageManager" field, otherwise corepack
# ignores this pin and downloads that version mid-build.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

FROM base AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/expenses-server/package.json ./apps/expenses-server/package.json
COPY apps/expense-client/package.json ./apps/expense-client/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN pnpm install --frozen-lockfile
RUN pnpm --filter expenses-server deploy --prod --legacy /app/deploy/expenses-server

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/expenses-server/node_modules ./apps/expenses-server/node_modules

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/expenses-server/package.json ./apps/expenses-server/package.json
COPY apps/expenses-server/tsconfig.json ./apps/expenses-server/tsconfig.json
COPY apps/expenses-server/src ./apps/expenses-server/src
COPY packages/typescript-config ./packages/typescript-config

WORKDIR /app/apps/expenses-server
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/deploy/expenses-server/node_modules ./node_modules
COPY --from=builder /app/apps/expenses-server/dist ./dist
COPY --from=builder /app/apps/expenses-server/package.json ./package.json
COPY apps/expenses-server/data ./data

EXPOSE 3001

CMD ["node", "dist/index.js"]
