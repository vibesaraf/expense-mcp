FROM oven/bun:1.3.6-alpine AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/expenses-server/package.json ./apps/expenses-server/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

RUN bun install

FROM oven/bun:1.3.6-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build --filter=expenses-server

FROM oven/bun:1.3.6-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/expenses-server/dist ./dist
COPY --from=deps /app/apps/expenses-server/node_modules ./node_modules
COPY --from=builder /app/apps/expenses-server/package.json ./package.json

RUN mkdir -p data

EXPOSE 3001

CMD ["node", "dist/index.js"]
