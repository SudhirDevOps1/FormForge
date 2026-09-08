import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { AUTH_SECRET_HELP, createSession, isAuthConfigured } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { jsonError, jsonOk, normalizeEmail, readJson, readString } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  if (!isAuthConfigured()) {
    return jsonError("AUTH_SECRET_MISSING", AUTH_SECRET_HELP, 503);
  }

  // Import rate limiting helpers dynamically
  const { checkRateLimit, rateLimitResponse, getClientIp } = await import("@/lib/rate-limit");
  const ip = getClientIp(request);
  const limitRes = await checkRateLimit(db, `login:${ip}`, 5, 900); // 5 attempts per 15 min
  if (!limitRes.allowed) {
    return rateLimitResponse(limitRes.resetAt);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = readString(body.password);

  if (!email || !password) {
    return jsonError("INVALID_CREDENTIALS", "Email and password are required.", 401);
  }

  // Account-level brute force protection against distributed attacks
  const emailLimitRes = await checkRateLimit(db, `login:acc:${email}`, 5, 900);
  if (!emailLimitRes.allowed) {
    return rateLimitResponse(emailLimitRes.resetAt);
  }

  if (password.length > 128) {
    return jsonError("INVALID_CREDENTIALS", "Invalid request parameters.", 400);
  }

  const totpCode = readString(body.totpCode ?? body.code);
  const altchaPayload = readString(body.altcha);
  
  // Only verify ALTCHA on initial password check, NOT when submitting the 2FA TOTP code!
  if (altchaPayload && !totpCode) {
    const { verifyAltchaSolution } = await import("@/lib/altcha");
    const { getAuthSecret } = await import("@/lib/auth");
    const hmacKey = getAuthSecret() || "formforge_altcha_secret_fallback_key";
    const altchaRes = await verifyAltchaSolution({ rawPayload: altchaPayload, hmacKey, db });
    if (!altchaRes.ok) {
      return jsonError("ALTCHA_FAILED", altchaRes.error || "Captcha verification failed. Please try again.", 400);
    }
  }

  try {
    const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = row[0];

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return jsonError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }

    // Check if Two-Factor Authentication (2FA) is enabled for this account
    if (user.totpEnabled && user.totpSecret) {
      if (!totpCode) {
        return jsonOk({
          requires2fa: true,
          email: user.email,
          message: "Two-factor authentication code required.",
        });
      }

      const { verifyTotpCode } = await import("@/lib/totp");
      const isValidTotp = await verifyTotpCode(user.totpSecret, totpCode, 1);
      if (!isValidTotp) {
        return jsonError("INVALID_2FA_CODE", "Invalid two-factor authentication code. Please check your authenticator app and try again.", 401);
      }
    }

    const session = await createSession(db, user.id, request);
    if (!session) {
      return jsonError("AUTH_SECRET_MISSING", "Set AUTH_SECRET before creating sessions.", 503);
    }

    // Dispatch Universal Admin Login Alert
    try {
      const { sendLoginAlert } = await import("@/lib/notifications");
      const userAgent = request.headers.get("user-agent") || "Unknown Browser";
      void sendLoginAlert(user, ip, userAgent);
    } catch (e) {
      console.warn("Failed to dispatch login alert:", e);
    }

    return jsonOk(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          totpEnabled: Boolean(user.totpEnabled),
        },
      },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    return jsonError("DB_ERROR", "An error occurred during authentication.", 500);
  }
}
