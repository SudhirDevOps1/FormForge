import { and, desc, eq, gt } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { sessions } from "@/db/schema";
import { getCurrentUser, hashSessionToken } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { cacheKey, invalidateCached } from "@/lib/kv-cache";

export const dynamic = "force-dynamic";

/**
 * Session management.
 *
 * GET    → every active session for the signed-in user
 * DELETE → revoke one session by id (`?id=`)
 * POST   → revoke every session (optionally keeping the current one)
 *
 * Revoking a session deletes the row, which makes the stored token hash
 * unmatchable — the session is dead immediately, not at expiry.
 */
export async function GET(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to manage sessions.", 401);
  }

  try {
    const now = new Date().toISOString();
    const rows = await db
      .select({
        id: sessions.id,
        ipHash: sessions.ipHash,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
        tokenHash: sessions.tokenHash,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, now)))
      .orderBy(desc(sessions.lastSeenAt));

    // Identify the current session by comparing token hashes — the raw token
    // is never exposed to the client.
    const cookies = request.headers.get("cookie") || "";
    const currentTokenHash = await hashSessionToken(
      decodeURIComponent(
        (cookies.split(";").find((part) => part.includes("ff_session")) || "=").split("=").slice(1).join("=") || "",
      ),
    );

    const list = rows.map((row) => ({
      id: row.id,
      device: describeDevice(row.userAgent),
      userAgent: row.userAgent ?? null,
      ipHash: row.ipHash ?? null,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      current: Boolean(currentTokenHash && row.tokenHash === currentTokenHash),
    }));

    return jsonOk({ sessions: list });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while loading sessions.", 500);
  }
}

export async function DELETE(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to manage sessions.", 401);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("id");
  if (!sessionId) {
    return jsonError("BAD_REQUEST", "Provide the session id to revoke.", 400);
  }

  try {
    const deleted = await db
      .delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
      .returning({ id: sessions.id, tokenHash: sessions.tokenHash });

    if (!deleted.length) {
      return jsonError("NOT_FOUND", "Session not found.", 404);
    }

    // Drop the cached session lookup so the revoked device loses access now
    // rather than up to a minute later.
    await invalidateCached(deleted.map((row) => cacheKey("session", row.tokenHash)));

    return jsonOk({ revoked: true, id: sessionId });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while revoking the session.", 500);
  }
}

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to manage sessions.", 401);
  }

  let keepCurrent = true;
  try {
    const body = (await request.json()) as { keepCurrent?: boolean };
    if (typeof body?.keepCurrent === "boolean") keepCurrent = body.keepCurrent;
  } catch {
    // an empty body means "keep the current session"
  }

  try {
    const cookies = request.headers.get("cookie") || "";
    const rawToken = decodeURIComponent(
      (cookies.split(";").find((part) => part.includes("ff_session")) || "=").split("=").slice(1).join("=") || "",
    );
    const currentTokenHash = rawToken ? await hashSessionToken(rawToken) : null;

    const rows = await db
      .select({ id: sessions.id, tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.userId, user.id));

    const doomed = rows
      .filter((row) => (keepCurrent ? row.tokenHash !== currentTokenHash : true));

    if (doomed.length) {
      await db.delete(sessions).where(eq(sessions.userId, user.id));
      // Every revoked token must stop working immediately, not when its cache
      // entry expires.
      await invalidateCached(
        doomed.map((row) => cacheKey("session", row.tokenHash)),
      );
      // Re-insert the session we want to keep, if any.
      if (keepCurrent && currentTokenHash) {
        const keep = rows.find((row) => row.tokenHash === currentTokenHash);
        if (keep) {
          const now = new Date().toISOString();
          await db.insert(sessions).values({
            id: keep.id,
            userId: user.id,
            tokenHash: keep.tokenHash,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: now,
            lastSeenAt: now,
          });
        }
      }
    }

    return jsonOk({ revoked: doomed.length, keepCurrent });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while revoking sessions.", 500);
  }
}

/**
 * Turn a raw user-agent into a short human-readable device label.
 */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";

  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown OS";

  return `${browser} on ${platform}`;
}
