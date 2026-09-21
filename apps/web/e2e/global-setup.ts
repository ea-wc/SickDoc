import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Runs before the web servers start: apply migrations and re-seed so every run
 * begins from a known, deterministic dataset. Both commands are idempotent, so
 * the database is safe to reuse across repeated local runs.
 */
function findWorkspaceRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("Could not locate the pnpm workspace root");
}

export default function globalSetup(): void {
  const root = findWorkspaceRoot(process.cwd());
  execSync("pnpm --filter @sickdoc/api prisma:deploy", { cwd: root, stdio: "inherit" });
  execSync("pnpm --filter @sickdoc/api db:seed", { cwd: root, stdio: "inherit" });
}
