import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import {
  embedHostedFormHeaders,
  SECURITY_HEADERS,
  contentSecurityPolicy,
} from "./src/lib/security-headers";

/**
 * The version is read from `package.json` once, when the config is evaluated,
 * and inlined into the bundle as `NEXT_PUBLIC_APP_VERSION`.
 *
 * This keeps one source of truth without shipping the manifest to the browser:
 * a client component that imported `package.json` would bundle every
 * dependency, script and description into the client payload just to render
 * three numbers. A missing file must not break the build, so the fallback is a
 * visible `0.0.0` rather than a crash.
 */
const appVersion = (() => {
  try {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };
    return manifest.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

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
  env: {
    // Single version source (package.json) surfaced to client components.
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
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
