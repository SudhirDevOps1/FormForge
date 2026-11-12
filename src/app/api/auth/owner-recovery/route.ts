import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, getRuntimeEnv, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { auditLogs, sessions, users } from "@/db/schema";
import { hashPassword, sha256 } from "@/lib/crypto";
import { jsonError, jsonOk, normalizeEmail, readJson, readString } from "@/lib/http";
import { passwordPolicyError } from "@/lib/password-policy";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { timingSafeEqualHex } from "@/lib/security";

export const dynamic = "force-dynamic";

const MIN_TOKEN_LENGTH = 32;

export const RECOVERY_TOKEN_HELP = `OWNER RECOVERY IS DISABLED.

Set a Worker secret named RECOVERY_TOKEN with at least ${MIN_TOKEN_LENGTH} characters:

  npx wrangler secret put RECOVERY_TOKEN

Use a random value (for example: openssl rand -hex 32). Then POST
{"token":"<value>","newPassword":"<new password>"} to this endpoint once,
sign in, and delete the secret again with:

  npx wrangler secret delete RECOVERY_TOKEN

While the secret exists it is a full account-recovery key, so keep it out of
git history and out of any client bundle.`;

/**
 * Operator-only owner recovery.
 *
 * Purpose: an existing installation whose only owner account can no longer sign
 * in (lost password, lost authenticator, a bad rotation) has **no** other way
 * back in — registration is closed as soon as a user row exists. This route
 * restores access to the data that is already in D1 instead of asking the owner
 * to reset the database and lose it.
 *
 * Safety properties:
 *  • Disabled by default. It only answers when the Worker has a `RECOVERY_TOKEN`
 *    secret of at least 32 characters, and the token is compared in constant
 *    time over SHA-256 digests so neither content nor length leaks.
 *  • Rate limited per IP, so a token cannot be brute forced.
 *  • Resets only an account that already exists; it never creates one, and the
 *    new password must pass the normal password policy.
 *  • Clearing 2FA and deleting every session is deliberate: recovery implies the
 *    previous factors may be compromised.
 *  • Every attempt outcome is written to `audit_logs` (IP is hashed, never
 *    stored raw).
 */
export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const env = getRuntimeEnv();
  const configuredToken = (env?.RECOVERY_TOKEN ?? "").trim();
  if (configuredToken.length < MIN_TOKEN_LENGTH) {
    return jsonError("RECOVERY_DISABLED", RECOVERY_TOKEN_HELP, 503);
  }

  const ip = getClientIp(request);
  const limit = await checkRateLimit(db, `owner-recovery:${ip}`, 5, 3600);
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetAt);
  }

  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return jsonError("INVALID_REQUEST", "Send a JSON body.", 400);
  }

  const token = readString(body.token).trim();
  const newPassword = readString(body.newPassword);
  const requestedEmail = normalizeEmail(body.email);

  const tokenOk = timingSafeEqualHex(await sha256(token), await sha256(configuredToken));
  if (!token || !tokenOk) {
    await recordAttempt(db, null, "auth.owner_recovery.denied", ip, { reason: "bad_token" });
    return jsonError("RECOVERY_FORBIDDEN", "That recovery token is not valid.", 403);
  }

  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    return jsonError("WEAK_PASSWORD", policyError, 400);
  }

  let target: { id: string; email: string } | undefined;
  if (requestedEmail) {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, requestedEmail))
      .limit(1);
    target = rows[0];
  } else {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.role, "owner"))
      .limit(1);
    target = rows[0];
  }

  if (!target) {
    await recordAttempt(db, null, "auth.owner_recovery.denied", ip, { reason: "no_account" });
    return jsonError(
      "ACCOUNT_NOT_FOUND",
      "No matching account exists. Recovery never creates accounts.",
      404,
    );
  }

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      totpSecret: null,
      totpEnabled: false,
      updatedAt: now,
    })
    .where(eq(users.id, target.id));

  // A recovery means the old session material is no longer trustworthy.
  await db.delete(sessions).where(eq(sessions.userId, target.id));

  await recordAttempt(db, target.id, "auth.owner_recovery.completed", ip, {
    email: target.email,
    totpCleared: true,
    sessionsRevoked: true,
  });

  return jsonOk({
    ok: true,
    email: target.email,
    totpDisabled: true,
    sessionsRevoked: true,
    message: "Password reset. Sign in with the new password, then delete RECOVERY_TOKEN.",
  });
}

/**
 * Best-effort audit trail. A failure here must never turn a successful recovery
 * into an error response, so it swallows its own exceptions.
 */
async function recordAttempt(
  db: ReturnType<typeof getDb>,
  userId: string | null,
  action: string,
  ip: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (!db) {
    return;
  }
  try {
    const ipHash = await sha256(`owner-recovery:${ip}`);
    await db.insert(auditLogs).values({
      userId,
      action,
      metadata: JSON.stringify({ ...metadata, ipHash }),
    });
  } catch {
    // Auditing is observability, not a precondition.
  }
}
