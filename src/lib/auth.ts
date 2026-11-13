import { and, eq, gt } from "drizzle-orm";
import type { AppDb } from "@/db";
import { getRuntimeEnv } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { hmacSha256, randomId, randomToken } from "./crypto";
import { cacheKey, cached, invalidateCached } from "./kv-cache";

const COOKIE_NAME = "ff_session";
/**
 * `__Host-` prefixed cookie name.
 *
 * The `__Host-` prefix is a browser-enforced guarantee: the cookie is only
 * accepted when it is `Secure`, has `Path=/` and carries **no** `Domain`
 * attribute. That means a sibling subdomain (or an attacker who controls
 * one) can neither set nor overwrite the session cookie — closing off a
 * whole class of session-fixation and cookie-injection attacks.
 *
 * It requires HTTPS, so local development over plain `http://localhost`
 * falls back to the legacy name. Reads accept both names so an existing
 * deployment keeps working across the upgrade.
 */
const HOST_COOKIE_NAME = "__Host-ff_session";
const SESSION_DAYS = 30;

export type AuthenticatedUser = Pick<User, "id" | "email" | "name" | "role" | "createdAt"> & {
  totpEnabled?: boolean;
};

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();

  for (const part of header?.split(";") ?? []) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) {
      continue;
    }
    cookies.set(name, decodeURIComponent(valueParts.join("=")));
  }

  return cookies;
}

export function getAuthSecret(): string | null {
  const secret = getRuntimeEnv().AUTH_SECRET?.trim();
  if (!secret) return null;
  if (secret.length < 24) return null;
  return secret;
}

const authSecret = getAuthSecret;

export const AUTH_SECRET_HELP = `AUTH_SECRET is not set in your Cloudflare Worker. How to fix:
1. Go to Cloudflare Dashboard → Workers & Pages
2. Click your Worker name ("formforge" or whatever you chose)
3. Go to Settings → Variables → Add variable → Select "Encrypt"
4. Variable name: AUTH_SECRET
5. Value: run this in your terminal → openssl rand -hex 32
6. Click "Save" and redeploy the Worker.`;

function isSecureConnection(request: Request): boolean {
  // Always secure on production cloudflare workers, check request URL/headers for local dev
  const url = new URL(request.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return false;
  }
  return true;
}

/**
 * The cookie name to use for the current connection.
 * `__Host-` requires `Secure`, which browsers reject over plain HTTP.
 */
function activeCookieName(request: Request): string {
  return isSecureConnection(request) ? HOST_COOKIE_NAME : COOKIE_NAME;
}

/** Read the session token from either the current or the legacy cookie. */
function readSessionToken(request: Request): string | undefined {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies.get(activeCookieName(request)) ?? cookies.get(COOKIE_NAME);
}

function cookieHeader(request: Request, token: string, expiresAt: Date): string {
  const secure = isSecureConnection(request);
  const name = secure ? HOST_COOKIE_NAME : COOKIE_NAME;
  const attributes = secure
    ? `Path=/; HttpOnly; SameSite=Lax; Secure`
    : `Path=/; HttpOnly; SameSite=Lax`;
  return `${name}=${encodeURIComponent(token)}; ${attributes}; Expires=${expiresAt.toUTCString()}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = isSecureConnection(request);
  const attributes = secure ? `Path=/; HttpOnly; SameSite=Lax; Secure` : `Path=/; HttpOnly; SameSite=Lax`;
  // Clear both the current and the legacy cookie so an upgrade does not
  // leave a stale session behind.
  return [
    `${secure ? HOST_COOKIE_NAME : COOKIE_NAME}=; ${attributes}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`,
    `${COOKIE_NAME}=; ${attributes}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`,
  ].join(", ");
}

export function isAuthConfigured(): boolean {
  return authSecret() !== null;
}

export async function hashSessionToken(token: string): Promise<string | null> {
  const secret = authSecret();
  return secret ? hmacSha256(token, secret) : null;
}

export async function createSession(db: AppDb, userId: string, request?: Request): Promise<{ token: string; cookie: string; expiresAt: Date } | null> {
  const token = randomToken(40);
  const tokenHash = await hashSessionToken(token);

  if (!tokenHash) {
    return null;
  }

  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  // Record a *hashed* IP so the dashboard can show where a session was
  // created without ever storing the raw address. The salt rotates daily,
  // which is enough to spot a suspicious sign-in but not enough to build a
  // long-term location history.
  let ipHash: string | undefined;
  let userAgent: string | undefined;
  if (request) {
    try {
      const { getClientIp } = await import("./rate-limit");
      const ip = getClientIp(request);
      if (ip && ip !== "127.0.0.1") {
        const { sha256 } = await import("./crypto");
        ipHash = await sha256(`session:${ip}:${new Date().toISOString().slice(0, 10)}`);
      }
    } catch {
      // best-effort metadata only
    }
    userAgent = request.headers.get("user-agent") ?? undefined;
  }

  await db.insert(sessions).values({
    id: randomId("sess"),
    userId,
    tokenHash,
    ipHash: ipHash ?? null,
    userAgent: userAgent ?? null,
    expiresAt: expiresAt.toISOString(),
  });

  // Fallback if request is not provided
  const dummyRequest = request || new Request("https://formforge.dev/");
  return { token, cookie: cookieHeader(dummyRequest, token, expiresAt), expiresAt };
}

export async function getCurrentUser(request: Request, db: AppDb): Promise<AuthenticatedUser | null> {
  // Try Session Cookie Auth First
  const token = readSessionToken(request);
  if (!token) {
    // API key auth fallback
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ff_")) {
      const { validateApiKey } = await import("./api-key-auth");
      const apiUser = await validateApiKey(db, authHeader);
      if (apiUser) {
        return {
          id: apiUser.id,
          email: apiUser.email,
          name: apiUser.name,
          role: apiUser.role,
          createdAt: apiUser.createdAt,
        };
      }
    }
    return null;
  }

  const tokenHash = await hashSessionToken(token);
  if (!tokenHash) {
    return null;
  }

  /**
   * Session lookup cache.
   *
   * Every authenticated API call (the dashboard fires a dozen on load) used to
   * run a `sessions ⋈ users` join against D1. The lookup is cached for 60
   * seconds under the *HMAC* of the token — never the raw cookie — so the KV
   * key cannot be replayed as a credential even if the namespace is read.
   *
   * Logout and explicit session revocation delete the key, so a signed-out
   * browser stops working immediately; everything else expires within a
   * minute. That bound is the trade-off for removing a D1 read per request.
   */
  const sessionCacheKey = cacheKey("session", tokenHash);
  const now = new Date().toISOString();

  const session = await cached<{ user: AuthenticatedUser | null }>(
    sessionCacheKey,
    60,
    async () => {
      const rows = await db
        .select({
          sessionId: sessions.id,
          userId: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          totpEnabled: users.totpEnabled,
          createdAt: users.createdAt,
          lastSeenAt: sessions.lastSeenAt,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .limit(1);

      const row = rows[0];
      if (!row) {
        return { user: null };
      }

      // Throttle writes: only touch the row when activity is > 5 minutes old,
      // so a cached session costs zero D1 writes as well.
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      if (row.lastSeenAt < fiveMinutesAgo) {
        await db
          .update(sessions)
          .set({ lastSeenAt: now })
          .where(eq(sessions.id, row.sessionId))
          .catch(() => {});
      }

      return {
        user: {
          id: row.userId,
          email: row.email,
          name: row.name,
          role: row.role,
          createdAt: row.createdAt,
          totpEnabled: Boolean(row.totpEnabled),
        },
      };
    },
  );

  return session.user;
}

export async function deleteCurrentSession(request: Request, db: AppDb): Promise<void> {
  const token = readSessionToken(request);
  if (!token) {
    return;
  }

  const tokenHash = await hashSessionToken(token);
  if (!tokenHash) {
    return;
  }

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  // A signed-out browser must not be able to use the cached session for the
  // rest of its TTL.
  await invalidateCached(cacheKey("session", tokenHash));
}
