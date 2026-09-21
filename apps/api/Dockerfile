# syntax=docker/dockerfile:1

# ---- base: pnpm via corepack + OpenSSL (Prisma engine runtime dep) ----
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Pre-fetch the pinned pnpm at build time so nothing is downloaded at runtime.
RUN corepack enable && corepack prepare pnpm@12.4.2 --activate

# ---- deps: install the whole workspace, lockfile-faithful ----
FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ---- build: compile shared + api, generate the Prisma client ----
FROM deps AS build
WORKDIR /repo
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @sickdoc/shared build
RUN pnpm --filter @sickdoc/api prisma:generate
RUN pnpm --filter @sickdoc/api build

# ---- prod: production-only, self-contained deployment (dist + prisma + deps) ----
FROM build AS prod
WORKDIR /repo
RUN pnpm --filter @sickdoc/api deploy --prod /app

# ---- runner: minimal, non-root ----
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    PATH="/app/node_modules/.bin:$PATH"
COPY --from=prod /app /app
USER node
EXPOSE 3001
CMD ["sh", "-c", "prisma migrate deploy && prisma db seed && node dist/main.js"]
