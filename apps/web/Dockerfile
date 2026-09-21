# syntax=docker/dockerfile:1

# ---- base: pnpm via corepack ----
FROM node:22-alpine AS base
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

# ---- build: compile shared, then the Next.js standalone server ----
FROM deps AS build
WORKDIR /repo
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @sickdoc/shared build

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter @sickdoc/web build

# ---- runner: minimal, non-root (Next.js standalone) ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Monorepo standalone output nests the server under apps/web/.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

# The app directory (incl. the writable image-optimisation cache) is owned by
# the runtime user.
RUN mkdir -p apps/web/.next/cache && chown -R nextjs:nodejs apps/web

WORKDIR /app/apps/web
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
