import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { jsonError, jsonOk, normalizeEmail, readJson, readString } from "@/lib/http";
import { createMagicLoginToken } from "@/lib/otp";
import { sendMagicLoginEmail } from "@/lib/notifications";
import { verifyAltchaSolution } from "@/lib/altcha";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  // Rate limiting to prevent abuse / email flooding
  const { checkRateLimit, rateLimitResponse, getClientIp } = await import("@/lib/rate-limit");
  const ip = getClientIp(request);
  const limitRes = await checkRateLimit(db, `magic_link_req:${ip}`, 5, 900); // 5 per 15 min
  if (!limitRes.allowed) {
    return rateLimitResponse(limitRes.resetAt);
  }

  const body = (await readJson(request)) ?? {};
  const email = normalizeEmail(readString(body.email));
  const altchaPayload = readString(body.altcha);

  if (!email || !email.includes("@")) {
    return jsonError("INVALID_EMAIL", "A valid email address is required.", 400);
  }

  // Verify anti-bot ALTCHA PoW if provided
  if (altchaPayload) {
    const { getAuthSecret } = await import("@/lib/auth");
    const hmacKey = getAuthSecret() || "formforge_altcha_secret_fallback_key";
    const altchaRes = await verifyAltchaSolution({ rawPayload: altchaPayload, hmacKey, db });
    if (!altchaRes.ok) {
      return jsonError("ALTCHA_FAILED", altchaRes.error || "Captcha verification failed. Please try again.", 400);
    }
  }

  try {
    const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userRows[0];

    // Maintain privacy: Return generic success even if user not found
    if (!user) {
      return jsonOk({
        ok: true,
        sent: true,
        message: "If an account exists with this email, a 1-click magic sign-in link has been sent.",
      });
    }

    const appUrl = new URL(request.url).origin;
    const { token } = await createMagicLoginToken(db, email);
    const magicLink = `${appUrl}/api/auth/magic-login?token=${token}&email=${encodeURIComponent(email)}`;
    const sent = await sendMagicLoginEmail(email, magicLink);

    return jsonOk({
      ok: true,
      sent: true,
      delivered: sent,
      message: "A 1-click magic sign-in link has been sent to your email.",
    });
  } catch (error) {
    return jsonError("SERVER_ERROR", "Failed to process magic link request.", 500);
  }
}
