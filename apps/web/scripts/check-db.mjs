#!/usr/bin/env node
/**
 * Preflight for the e2e suites.
 *
 * The API's /api/health returns 503 whenever Postgres is unreachable, and
 * Playwright's webServer only treats 2xx–4xx as "ready" — so a down database
 * manifests as a cryptic 60s "Timed out waiting from config.webServer" error.
 *
 * This script reads the same DATABASE_URL the API uses (apps/api/.env) and
 * checks the database is reachable before Playwright starts, failing fast with
 * an actionable message instead.
 */
import { createConnection } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "api", ".env");
let databaseUrl;
try {
  const match = readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.+)$/m);
  databaseUrl = match?.[1]?.trim();
} catch {
  // handled below
}

if (!databaseUrl) {
  console.error("✗ apps/api/.env is missing DATABASE_URL. Copy apps/api/.env.example and set it.");
  process.exit(1);
}

const url = new URL(databaseUrl);
const host = url.hostname;
const port = Number(url.port || 5432);
const database = url.pathname.replace(/^\//, "") || "(default)";

const socket = createConnection({ host, port, timeout: 2500 });

const hint = () => {
  console.error("  Start it, then re-run:");
  console.error("    docker compose up -d db              # Docker Postgres 16");
  console.error("    brew services start postgresql@14     # local Homebrew Postgres");
};

socket.on("connect", () => {
  console.log(`✓ Postgres reachable at ${host}:${port} (database: ${database})`);
  socket.end();
  process.exit(0);
});

socket.on("timeout", () => {
  console.error(`✗ No Postgres responding at ${host}:${port} (from apps/api/.env).`);
  hint();
  socket.destroy();
  process.exit(1);
});

socket.on("error", (err) => {
  console.error(`✗ Cannot reach Postgres at ${host}:${port}: ${err.code ?? err.message}`);
  hint();
  process.exit(1);
});
