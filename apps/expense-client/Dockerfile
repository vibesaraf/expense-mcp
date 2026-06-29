FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

FROM base AS deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/expenses-server/package.json ./apps/expenses-server/package.json
COPY apps/expenses-client/package.json ./apps/expenses-client/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN pnpm install --frozen-lockfile
RUN pnpm --filter expenses-server deploy --prod --legacy /app/deploy/expenses-server

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/expenses-client/node_modules ./apps/expenses-client/node_modules

COPY apps/expenses-client/package.json ./apps/expenses-client/package.json
COPY apps/expenses-client/tsconfig.json ./apps/expenses-client/tsconfig.json
COPY apps/expenses-client/tsconfig.app.json ./apps/expenses-client/tsconfig.app.json
COPY apps/expenses-client/tsconfig.node.json ./apps/expenses-client/tsconfig.node.json
COPY apps/expenses-client/src ./apps/expenses-client/src
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

WORKDIR /app/apps/expenses-client
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/deploy/expenses-client/node_modules ./node_modules
COPY --from=builder /app/apps/expenses-client/dist ./dist
COPY --from=builder /app/apps/expenses-client/package.json ./package.json

ARG VITE_LR_AUTHORIZE_URL
ARG VITE_LR_CLIENT_ID
ARG VITE_LR_REDIRECT_URI
ARG VITE_REST_RESOURCE_URL

ENV VITE_LR_AUTHORIZE_URL=${VITE_LR_AUTHORIZE_URL}
ENV VITE_LR_CLIENT_ID=${VITE_LR_CLIENT_ID}
ENV VITE_LR_REDIRECT_URI=${VITE_LR_REDIRECT_URI}
ENV VITE_REST_RESOURCE_URL=${VITE_REST_RESOURCE_URL}


EXPOSE 4173

CMD ["pnpm", "preview"]
