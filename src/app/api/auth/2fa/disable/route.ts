import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { jsonError, jsonOk } from "@/lib/http";
import { verifyTotpCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);
  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to manage 2FA.", 401);
  }

  let body: { password?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_REQUEST", "Invalid JSON payload.", 400);
  }

  const userRows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      totpSecret: users.totpSecret,
      totpEnabled: users.totpEnabled,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const fullUser = userRows[0];
  if (!fullUser) {
    return jsonError("NOT_FOUND", "User not found.", 404);
  }

  // Disabling 2FA is a security downgrade, so it always requires the current
  // password and — when 2FA is actually enabled — a valid current code. Accepting
  // "either one" would let a stolen session or a captured code alone turn the
  // second factor off.
  const code = (body.code ?? "").trim();
  const password = body.password ?? "";

  if (!password) {
    return jsonError(
      "CONFIRMATION_FAILED",
      "Enter your current password to disable two-factor authentication.",
      400,
    );
  }

  const passwordOk = await verifyPassword(password, fullUser.passwordHash);
  if (!passwordOk) {
    return jsonError("CONFIRMATION_FAILED", "That password is not correct.", 400);
  }

  if (fullUser.totpEnabled && fullUser.totpSecret) {
    if (!code) {
      return jsonError(
        "CONFIRMATION_FAILED",
        "Enter the current 6-digit authenticator code to disable two-factor authentication.",
        400,
      );
    }
    const codeOk = await verifyTotpCode(fullUser.totpSecret, code, 1);
    if (!codeOk) {
      return jsonError("CONFIRMATION_FAILED", "That authenticator code is not valid.", 400);
    }
  }

  // Deactivate 2FA
  await db
    .update(users)
    .set({
      totpEnabled: false,
      totpSecret: null,
    })
    .where(eq(users.id, user.id));

  return jsonOk({
    success: true,
    message: "Two-factor authentication has been disabled.",
  });
}
