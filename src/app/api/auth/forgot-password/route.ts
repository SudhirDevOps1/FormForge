import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { jsonError, jsonOk, normalizeEmail, readJson } from "@/lib/http";
import { createPasswordResetOtp } from "@/lib/otp";
import { sendPasswordResetEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  // Rate limiting to prevent email bombing / abuse
  const { checkRateLimit, rateLimitResponse, getClientIp } = await import("@/lib/rate-limit");
  const ip = getClientIp(request);
  const limitRes = await checkRateLimit(db, `forgot_pw:${ip}`, 5, 900); // 5 attempts per 15 min
  if (!limitRes.allowed) {
    return rateLimitResponse(limitRes.resetAt);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);

  if (!email || !email.includes("@")) {
    return jsonError("INVALID_EMAIL", "A valid email address is required.", 400);
  }

  try {
    const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userRows[0];

    // For privacy, return success message even if email doesn't exist
    if (!user) {
      return jsonOk({
        sent: true,
        message: "If an account with that email exists, a 6-digit password reset code has been sent.",
      });
    }

    const appUrl = new URL(request.url).origin;
    const { code, token } = await createPasswordResetOtp(db, email);
    const magicLink = `${appUrl}/dashboard?reset_token=${token}&email=${encodeURIComponent(email)}`;
    const sent = await sendPasswordResetEmail(email, code, magicLink);

    return jsonOk({
      sent: true,
      delivered: sent,
      message: "A 6-digit password reset code and 1-click magic link have been sent to your email.",
    });
  } catch (error) {
    return jsonError("SERVER_ERROR", "Failed to process password reset request.", 500);
  }
}
