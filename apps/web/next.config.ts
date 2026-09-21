import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@sickdoc/shared"],
  // Self-contained server for Docker (`.next/standalone`). In a monorepo the
  // standalone output nests the server under apps/web/ — the Dockerfile copies
  // it accordingly.
  output: "standalone",
};

export default nextConfig;
