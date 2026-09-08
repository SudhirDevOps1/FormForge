import { and, eq, gt } from "drizzle-orm";
import type { AppDb } from "@/db";
import { getRuntimeEnv } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { hmacSha256, randomId, randomToken } from "./crypto";

const COOKIE_NAME = "ff_session";
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
  if (host === "localhost" || host === "127.0.0.1") {
    return false;
  }
  return true;
}

function cookieHeader(request: Request, token: string, expiresAt: Date): string {
  const secure = isSecureConnection(request) ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${expiresAt.toUTCString()}; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = isSecureConnection(request) ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
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
  await db.insert(sessions).values({
    id: randomId("sess"),
    userId,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
  });

  // Fallback if request is not provided
  const dummyRequest = request || new Request("https://formforge.dev/");
  return { token, cookie: cookieHeader(dummyRequest, token, expiresAt), expiresAt };
}

export async function getCurrentUser(request: Request, db: AppDb): Promise<AuthenticatedUser | null> {
  // Try Session Cookie Auth First
  const token = parseCookies(request.headers.get("cookie")).get(COOKIE_NAME);
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

  const now = new Date().toISOString();
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
    return null;
  }

  // Throttle updates: Only update if the last activity was > 5 minutes (300,000 ms) ago
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  if (row.lastSeenAt < fiveMinutesAgo) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.sessionId)).catch(() => {});
  }

  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.createdAt,
    totpEnabled: Boolean(row.totpEnabled),
  };
}

export async function deleteCurrentSession(request: Request, db: AppDb): Promise<void> {
  const token = parseCookies(request.headers.get("cookie")).get(COOKIE_NAME);
  if (!token) {
    return;
  }

  const tokenHash = await hashSessionToken(token);
  if (!tokenHash) {
    return;
  }

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
