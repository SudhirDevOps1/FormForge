/**
 * FormForge security header policy.
 *
 * One authoritative definition, consumed by both `next.config.ts` (static
 * headers for the whole app) and by route handlers that need to relax a
 * single header for a specific path.
 *
 * Why a module and not inline strings: header drift is a real risk. When the
 * dashboard and the API each carry their own copy of a CSP, a fix applied to
 * one is silently missing from the other. This module is the single source.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Next.js injects inline bootstrap/hydration scripts. Without a per-request
  // nonce (which is not possible on every edge runtime FormForge targets)
  // `'unsafe-inline'` is required for scripts; the trade-off is documented in
  // docs/SECURITY.md.
  "script-src 'self' 'unsafe-inline'",
  // Inline styles are used by the design system and by the Google Font import.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Build the CSP for the current environment.
 *
 * React's **development** build calls `eval()` to reconstruct component
 * stacks, and the dev server needs it for source maps. Neither is used in a
 * production build, so `'unsafe-eval'` is granted in development only —
 * the production policy stays strict.
 */
export function contentSecurityPolicy(options?: { allowEval?: boolean }): string {
  if (!options?.allowEval) {
    return CONTENT_SECURITY_POLICY;
  }
  return CONTENT_SECURITY_POLICY.replace(
    "script-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  );
}

export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), " +
      "display-capture=(), document-domain=(), encrypted-media=(), fullscreen=(self), " +
      "geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), " +
      "payment=(), picture-in-picture=(), publickey-credentials-get=(self), " +
      "screen-wake-lock=(), usb=(), xr-spatial-tracking=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  // The app ships no third-party analytics, but the header documents the
  // intent and blocks a future accidental tag.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

/**
 * Headers for the hosted form page.
 *
 * The hosted page is explicitly designed to be embedded in an iframe on a
 * customer's site, so framing is allowed here while it stays blocked
 * everywhere else (the dashboard, the API and every authenticated surface).
 */
export function embedHostedFormHeaders(options?: { allowEval?: boolean }): Array<{ key: string; value: string }> {
  return [
    { key: "X-Frame-Options", value: "ALLOWALL" },
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(options).replace("frame-ancestors 'none'", "frame-ancestors *"),
    },
  ];
}

/** Build a `Headers` object from the policy. */
export function securityHeaders(extra?: ReadonlyArray<{ key: string; value: string }>): Headers {
  const headers = new Headers();
  for (const { key, value } of SECURITY_HEADERS) {
    headers.set(key, value);
  }
  for (const { key, value } of extra ?? []) {
    headers.set(key, value);
  }
  return headers;
}
