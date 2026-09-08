import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/crypto";
import { jsonError, jsonOk, normalizeEmail, readJson, readString } from "@/lib/http";
import { verifyPasswordResetOtp } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  // Rate limiting to prevent OTP brute forcing
  const { checkRateLimit, rateLimitResponse, getClientIp } = await import("@/lib/rate-limit");
  const ip = getClientIp(request);
  const limitRes = await checkRateLimit(db, `reset_pw:${ip}`, 10, 900); // 10 attempts per 15 min
  if (!limitRes.allowed) {
    return rateLimitResponse(limitRes.resetAt);
  }

  const body = (await readJson(request)) ?? {};
  const email = normalizeEmail(readString(body.email));
  const code = readString(body.code)?.trim();
  const newPassword = readString(body.newPassword);
  const reset2fa = Boolean(body.reset2fa);

  if (!email || !email.includes("@")) {
    return jsonError("INVALID_EMAIL", "A valid email address is required.", 400);
  }

  if (!code || code.length !== 6) {
    return jsonError("INVALID_CODE", "A valid 6-digit reset code is required.", 400);
  }

  if (!newPassword || newPassword.length < 10) {
    return jsonError("WEAK_PASSWORD", "Password must be at least 10 characters long.", 400);
  }

  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = existing[0];
    if (!user) {
      // Don't disclose user existence but fail verification
      return jsonError("INVALID_CODE", "Invalid reset code or email address.", 400);
    }

    const otpResult = await verifyPasswordResetOtp(db, email, code);
    if (!otpResult.success) {
      return jsonError("INVALID_CODE", otpResult.error || "Invalid or expired reset code.", 400);
    }

    // Hash new password using PBKDF2 (100k iterations, SHA-256)
    const newHash = await hashPassword(newPassword);

    // Update user password and optionally reset 2FA if requested / locked out
    const updateValues: Record<string, unknown> = {
      passwordHash: newHash,
      updatedAt: new Date().toISOString(),
    };

    if (reset2fa) {
      updateValues.totpEnabled = false;
      updateValues.totpSecret = null;
    }

    await db.update(users).set(updateValues).where(eq(users.id, user.id));

    // Revoke all past active sessions for this user
    await db.delete(sessions).where(eq(sessions.userId, user.id));

    return jsonOk({
      ok: true,
      message: reset2fa
        ? "Password reset successfully and 2FA has been disabled. You can now log in."
        : "Password reset successfully. You can now log in with your new password.",
      reset2fa,
    });
  } catch (error) {
    return jsonError("SERVER_ERROR", "Failed to reset password. Please try again.", 500);
  }
}
