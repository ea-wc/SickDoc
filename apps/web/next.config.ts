import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@sickdoc/shared"],
  // Self-contained server for Docker (`.next/standalone`). In a monorepo the
  // standalone output nests the server under apps/web/ — the Dockerfile copies
  // it accordingly.
  output: "standalone",
  // Single-container Fly deploy: the browser calls the API same-origin at
  // /api/*, and the Next server proxies those requests to the internal API
  // process on 127.0.0.1:3001. Local dev is unaffected (it calls the API
  // cross-origin directly via NEXT_PUBLIC_API_URL).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
