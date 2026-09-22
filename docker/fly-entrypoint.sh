#!/bin/sh
set -e

# --- runtime defaults (override with `fly secrets set`) ---
export JWT_SECRET="${JWT_SECRET:-dev-secret-change-me}"
export JWT_ACCESS_TTL="${JWT_ACCESS_TTL:-900}"
export JWT_REFRESH_TTL="${JWT_REFRESH_TTL:-604800}"
export CORS_ORIGIN="${CORS_ORIGIN:-https://sickdoc.fly.dev}"
export DATABASE_URL="${DATABASE_URL:-postgresql://sickdoc@127.0.0.1:5432/sickdoc?schema=public}"

PGDATA="${PGDATA:-/var/lib/postgresql/data/pg}"

# --- 1. Initialize the cluster on first boot (volume may be empty) ---
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA" /run/postgresql
  chown -R postgres:postgres "$PGDATA" /run/postgresql
  su-exec postgres initdb -D "$PGDATA" -U sickdoc --auth=trust --encoding=UTF8 --no-locale
fi

# --- 2. Start Postgres (loopback only — never exposed) ---
su-exec postgres pg_ctl -D "$PGDATA" \
  -o "-c listen_addresses=127.0.0.1 -c unix_socket_directories=/run/postgresql" \
  -w start

# --- 3. Create the app database if missing ---
if ! su-exec postgres psql -h 127.0.0.1 -U sickdoc -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='sickdoc'" | grep -q 1; then
  su-exec postgres createdb -h 127.0.0.1 -U sickdoc sickdoc
fi

# --- 4. Migrate + seed (both idempotent) ---
cd /app/api
prisma migrate deploy
prisma db seed

# --- 5. Start the API on 3001 (internal only) ---
cd /app/api
env PORT=3001 node dist/main.js &
API_PID=$!

# --- 6. Start the web on 3000 (foreground = the container's main process) ---
cd /app/web/apps/web
env PORT=3000 node server.js
