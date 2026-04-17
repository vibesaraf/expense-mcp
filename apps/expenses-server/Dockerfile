FROM node:22-alpine AS base
RUN corepack enable

FROM base AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/expenses-server/package.json ./apps/expenses-server/
# Copy full workspace packages so symlinked node_modules entries have all source files
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/eslint-config/ ./packages/eslint-config/

RUN corepack prepare pnpm@10.11.0 --activate && pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

RUN pnpm --filter expenses-server run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/expenses-server/dist ./dist
COPY --from=builder /app/apps/expenses-server/package.json ./package.json

RUN mkdir -p data

EXPOSE 3001

CMD ["node", "dist/index.js"]
