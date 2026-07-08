FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

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
RUN pnpm --filter expense-client deploy --prod --legacy /app/deploy/expense-client

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/expense-client/node_modules ./apps/expense-client/node_modules

# Workspace root markers so pnpm resolves the package + hoisted bins (vite,
# tsc live in the root node_modules/.bin).
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

COPY apps/expense-client/package.json ./apps/expense-client/package.json
COPY apps/expense-client/tsconfig.json ./apps/expense-client/tsconfig.json
COPY apps/expense-client/tsconfig.app.json ./apps/expense-client/tsconfig.app.json
COPY apps/expense-client/tsconfig.node.json ./apps/expense-client/tsconfig.node.json
COPY apps/expense-client/index.html ./apps/expense-client/index.html
COPY apps/expense-client/vite.config.ts ./apps/expense-client/vite.config.ts
COPY apps/expense-client/public ./apps/expense-client/public
COPY apps/expense-client/src ./apps/expense-client/src
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config

# Vite inlines these into the static bundle at build time.
ARG VITE_LR_AUTHORIZE_URL
ARG VITE_LR_CLIENT_ID
ARG VITE_LR_REDIRECT_URI
ARG VITE_REST_RESOURCE_URL
ENV VITE_LR_AUTHORIZE_URL=${VITE_LR_AUTHORIZE_URL}
ENV VITE_LR_CLIENT_ID=${VITE_LR_CLIENT_ID}
ENV VITE_LR_REDIRECT_URI=${VITE_LR_REDIRECT_URI}
ENV VITE_REST_RESOURCE_URL=${VITE_REST_RESOURCE_URL}

RUN pnpm --filter expense-client run build

# Serve the static build with nginx. vite preview is a dev tool and its deps
# are pruned from the prod deploy, so the SPA is served as static files.
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/expense-client/dist /usr/share/nginx/html
COPY apps/expense-client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
