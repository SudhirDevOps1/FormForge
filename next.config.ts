import type { NextConfig } from "next";
import {
  embedHostedFormHeaders,
  SECURITY_HEADERS,
  contentSecurityPolicy,
} from "./src/lib/security-headers";

/**
 * React's development build calls `eval()` to reconstruct component stacks
 * and the dev server needs it for source maps. Neither is used in a
 * production build, so `'unsafe-eval'` is granted in development only —
 * the production Content-Security-Policy stays strict.
 */
const isDevelopment = process.env.NODE_ENV !== "production";

const securityHeaders = SECURITY_HEADERS.map((header) =>
  header.key === "Content-Security-Policy"
    ? { ...header, value: contentSecurityPolicy({ allowEval: isDevelopment }) }
    : header,
);

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/isomorphic-ws",
    "@libsql\\isomorphic-ws",
    "@neondatabase/serverless",
  ],
  // Cache Components and partial prefetching are opt-in Next.js 16 features
  // that are not yet supported by the OpenNext Cloudflare adapter: with them
  // enabled the Worker can hang ("Worker's code had hung") on concurrent
  // renders. They stay off until the adapter supports them.
  cacheComponents: false,
  partialPrefetching: false,
  async headers() {
    return [
      {
        // The hosted form page is designed to be embedded in an iframe on a
        // customer's site, so framing is permitted for this path only.
        // It is declared first so the more specific rule wins for
        // `/f/*` while every other path keeps the strict policy.
        source: "/f/:slug",
        headers: embedHostedFormHeaders({ allowEval: isDevelopment }),
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/docs",
        destination: "/docs.html",
      },
      {
        source: "/guide",
        destination: "/guide.html",
      },
    ];
  },
};

export default nextConfig;
