/**
 * FormForge centralized security utilities.
 *
 * Dependency-free and Cloudflare Workers-safe (Web Crypto API only, no Node
 * built-ins) so the same module runs inside Workers, inside Next.js route
 * handlers, and alongside the standalone Node security suite at
 * `tests/run-all-security-tests.mjs`.
 *
 * Covered pillars:
 *  1. Constant-time HMAC / token comparison + buffer zeroization.
 *  2. Allowlist HTML sanitization (XSS / SVG / event-handler defense).
 *  3. SSRF-safe outbound URL checks (canonical validator re-export).
 *  4. Disposable-email blocking, brute-force throttles, session-version
 *     revocation, in-memory rate limiting.
 *  5. PII hashing / anonymization + CWE-209 generic error envelopes.
 */

import { hmacSha256, sha256 } from "./crypto";
import { isPrivateUrl } from "./url-validation";

/* ------------------------------------------------------------------ */
/* 1. Constant-time comparison + zeroization                           */
/* ------------------------------------------------------------------ */

const HEX_PATTERN = /^[0-9a-f]+$/;

/**
 * Constant-time comparison of two hex digests (HMAC signatures,
 * session-token hashes). Returns `false` — without throwing — for empty,
 * length-mismatched, or non-hex input so callers can treat any `false` as
 * "untrusted" without leaking *why* verification failed.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.length === 0 || x.length !== y.length) {
    return false;
  }
  if (!HEX_PATTERN.test(x) || !HEX_PATTERN.test(y)) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < x.length; index += 1) {
    difference |= x.charCodeAt(index) ^ y.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Verify an HMAC-SHA256 signature with a constant-time comparison so that
 * webhook / session-token verification is not vulnerable to timing oracles.
 */
export async function verifyHmacSignature(
  value: string,
  secret: string,
  signatureHex: string,
): Promise<boolean> {
  const expected = await hmacSha256(value, secret);
  return timingSafeEqualHex(expected, signatureHex);
}

/**
 * Overwrite a sensitive buffer (raw key material, decrypted secrets) with
 * zeros after use. Null-safe so `finally { zeroize(buf); }` never throws.
 */
export function zeroize(buffer: Uint8Array | null | undefined): void {
  if (!buffer) {
    return;
  }
  buffer.fill(0);
}

/* ------------------------------------------------------------------ */
/* 2. Allowlist HTML sanitization + field-key safety                    */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "br",
  "code",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "ul",
]);

const DANGEROUS_ELEMENTS =
  /<(script|style|iframe|object|embed|link|meta|base|svg|math|form|input|button|textarea|select|option|img|video|audio|source|track|canvas|template|slot|frame|frameset|applet)[^>]*>[\s\S]*?(<\/\1\s*>|$)/gi;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Allowlist HTML sanitizer for user-controlled strings rendered in emails
 * and dashboard views. Strips script/SVG/iframe payloads, event-handler
 * attributes (`onerror`, `onload`, ...), `style` attributes, and dangerous
 * URI schemes (`javascript:`, `data:`, `vbscript:`). Only a minimal set of
 * formatting tags survives, and `<a>` keeps an `href` solely when it is an
 * absolute `http(s)` URL.
 */
export function sanitizeHtml(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) {
    return "";
  }
  // Drop dangerous elements together with their inner content first.
  let output = input.replace(DANGEROUS_ELEMENTS, "");
  // Drop any leftover dangerous opening tags without a closer.
  output = output.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|svg|math|form|input|button|textarea|select|option|img|video|audio|source|track|canvas|template|slot|frame|frameset|applet)[^>]*\/?>/gi,
    "",
  );
  // Walk the remaining tags: keep allowlisted ones, escape everything else.
  output = output.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (match: string, rawTag: string, rawAttrs: string) => {
      const tag = String(rawTag).toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        return escapeHtml(match);
      }
      if (tag === "br") {
        return "<br>";
      }
      if (match.startsWith("</")) {
        return `</${tag}>`;
      }
      if (tag === "a") {
        const hrefMatch =
          /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`>]+))/i.exec(rawAttrs ?? "");
        const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "").trim();
        if (/^https?:\/\/[^<>\s]+$/i.test(href)) {
          return `<a href="${escapeHtml(href)}">`;
        }
        return "<a>";
      }
      // Allowlisted formatting tag: drop ALL attributes (kills on*, style, id).
      return `<${tag}>`;
    },
  );
  return output;
}

const FORBIDDEN_FIELD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const FIELD_KEY_PATTERN = /^[a-zA-Z0-9 _.\-]+$/;

/** Reject prototype-pollution / NoSQL-operator field keys from submissions. */
export function isSafeFieldKey(key: string): boolean {
  if (!key || key.length > 128) {
    return false;
  }
  if (FORBIDDEN_FIELD_KEYS.has(key)) {
    return false;
  }
  return FIELD_KEY_PATTERN.test(key);
}

/** Drop unsafe keys from an untrusted payload object (NoSQL-injection defense). */
export function sanitizePayload<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (isSafeFieldKey(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

/* ------------------------------------------------------------------ */
/* 3. SSRF-safe outbound URL checks                                    */
/* ------------------------------------------------------------------ */

/** Canonical SSRF guard: true when a URL targets private/internal space. */
export { isPrivateUrl };

/**
 * Outbound allow-check for webhooks / redirects: only absolute `https:` URLs
 * that do NOT resolve to private, loopback, or cloud-metadata space.
 */
export function isOutboundUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return !isPrivateUrl(url);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 4. Disposable email, throttles, session versions, rate limiting      */
/* ------------------------------------------------------------------ */

export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
  "10minutemail.com",
  "20minutemail.com",
  "33mail.com",
  "anonbox.net",
  "binkmail.com",
  "bobmail.info",
  "cock.li",
  "dispostable.com",
  "dropmail.me",
  "fakeinbox.com",
  "fakemailgenerator.com",
  "getnada.com",
  "gorillaswithclaws.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "harakirimail.com",
  "inboxbear.com",
  "incognitomail.org",
  "jetable.org",
  "koszmail.pl",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mailsac.com",
  "mailsucker.net",
  "mailtemp.net",
  "mailundink.com",
  "mintemail.com",
  "mytemp.email",
  "mytrashmail.com",
  "nada.ltd",
  "pookmail.com",
  "sharklasers.com",
  "spam4.me",
  "spambox.us",
  "spambog.com",
  "spamgourmet.com",
  "spamhole.com",
  "temp-mail.io",
  "temp-mail.org",
  "tempmail.com",
  "tempmailaddress.com",
  "tempmailo.com",
  "tempinbox.com",
  "trashmail.com",
  "trashmail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "zomg.info",
];

/** True when an address uses a disposable / temporary-mail domain. */
export function isDisposableEmail(email: unknown): boolean {
  if (typeof email !== "string") {
    return true;
  }
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) {
    return true;
  }
  const domain = normalized.slice(at + 1);
  if (!domain || !domain.includes(".")) {
    return true;
  }
  return (DISPOSABLE_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Sliding-window in-memory rate limiter (edge-local complement to the
 * D1-backed `checkRateLimit`). `now` is injectable so lockout behavior is
 * deterministically testable without sleeping.
 */
export function createMemoryRateLimiter(maxAttempts: number, windowSeconds: number) {
  const hits = new Map<string, number[]>();
  const windowMs = windowSeconds * 1000;

  function check(key: string, now: number = Date.now()): RateLimitDecision {
    const cutoff = now - windowMs;
    const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= maxAttempts) {
      return { allowed: false, remaining: 0, resetAt: recent[0] + windowMs };
    }
    recent.push(now);
    hits.set(key, recent);
    return { allowed: true, remaining: maxAttempts - recent.length, resetAt: now + windowMs };
  }

  function reset(key: string): void {
    hits.delete(key);
  }

  return { check, reset };
}

/** 5 login attempts per 15 minutes — mirrors `api/auth/login` (5, 900). */
export function createLoginThrottle() {
  return createMemoryRateLimiter(5, 900);
}

/** 60 submissions per minute — mirrors `api/submit/[endpointId]` (60, 60). */
export function createSubmitThrottle() {
  return createMemoryRateLimiter(60, 60);
}

export interface SessionTicket {
  userId: string;
  version: number;
}

/**
 * Session-version store: bumping a user's version (password change,
 * "sign out everywhere", revocation) invalidates every previously issued
 * ticket, including tokens on other devices.
 */
export function createSessionVersionStore() {
  const versions = new Map<string, number>();

  function currentVersion(userId: string): number {
    return versions.get(userId) ?? 0;
  }

  function issue(userId: string): SessionTicket {
    return { userId, version: currentVersion(userId) };
  }

  function verify(ticket: SessionTicket, userId: string): boolean {
    return ticket.userId === userId && ticket.version === currentVersion(userId);
  }

  function revokeAll(userId: string): number {
    const next = currentVersion(userId) + 1;
    versions.set(userId, next);
    return next;
  }

  return { currentVersion, issue, verify, revokeAll };
}

/* ------------------------------------------------------------------ */
/* 5. PII privacy + CWE-209 generic errors                             */
/* ------------------------------------------------------------------ */

/** Generic client-facing message — never carries SQL, paths, or stacks. */
export const GENERIC_CLIENT_ERROR = "Request failed. Please retry.";

export interface PublicErrorBody {
  ok: false;
  code: string;
  message: string;
}

/** Build a CWE-209-safe public error envelope from any internal failure. */
export function toPublicError(code = "REQUEST_FAILED"): PublicErrorBody {
  return { ok: false, code, message: GENERIC_CLIENT_ERROR };
}

const INTERNAL_LEAK_PATTERNS: RegExp[] = [
  /\bselect\b[\s\S]+\bfrom\b/i,
  /\binsert\b[\s\S]+\binto\b/i,
  /\bupdate\b[\s\S]+\bset\b/i,
  /\bdelete\b[\s\S]+\bfrom\b/i,
  /\bsqlite\b/i,
  /\bdrizzle\b/i,
  /\bD1_ERROR\b/,
  /\bsyntax error\b/i,
  /\bstack trace\b/i,
  /\s+at\s+\S+\s*\(/,
  /\.ts:\d+/,
  /\.js:\d+/,
  /ReferenceError|TypeError|SyntaxError/,
];

/** True when a string destined for API callers leaks internals (CWE-209). */
export function containsInternalLeak(text: unknown): boolean {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }
  return INTERNAL_LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * One-way PII pseudonymization: SHA-256 over `scope:value` so the same
 * email/IP hashes differently per form (mirrors submit-route IP hashing).
 */
export async function hashPii(value: string, scope: string): Promise<string> {
  return sha256(`${scope}:${value.trim().toLowerCase()}`);
}

/** Per-form IP anonymization (`form:<id>:ip` scope, like the submit route). */
export async function anonymizeIpAddress(ip: string, formId: string): Promise<string> {
  return hashPii(ip, `form:${formId}:ip`);
}
