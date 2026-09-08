import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { normalizeEmail } from "@/lib/http";
import { verifyMagicLoginToken } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const url = new URL(request.url);
  const appUrl = url.origin;
  const token = url.searchParams.get("token")?.trim();
  const rawEmail = url.searchParams.get("email");
  const email = rawEmail ? normalizeEmail(rawEmail) : "";

  if (!token || !email || !email.includes("@")) {
    return Response.redirect(
      `${appUrl}/dashboard?auth_error=${encodeURIComponent("Invalid or incomplete magic sign-in link.")}`,
      303
    );
  }

  try {
    const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userRows[0];

    if (!user) {
      return Response.redirect(
        `${appUrl}/dashboard?auth_error=${encodeURIComponent("No account found matching this magic link.")}`,
        303
      );
    }

    const verification = await verifyMagicLoginToken(db, email, token);
    if (!verification.success) {
      return Response.redirect(
        `${appUrl}/dashboard?auth_error=${encodeURIComponent(verification.error || "Magic link is invalid or has expired.")}`,
        303
      );
    }

    // If user has 2FA enabled, redirect to 2FA entry step
    if (user.totpEnabled) {
      return Response.redirect(
        `${appUrl}/dashboard?magic_2fa=1&email=${encodeURIComponent(email)}`,
        303
      );
    }

    // Create session cookie and redirect directly to dashboard
    const session = await createSession(db, user.id, request);
    if (!session) {
      return Response.redirect(
        `${appUrl}/dashboard?auth_error=${encodeURIComponent("Could not create session. Please check AUTH_SECRET.")}`,
        303
      );
    }

    // Dispatch Universal Admin Login Alert
    try {
      const { sendLoginAlert } = await import("@/lib/notifications");
      const { getClientIp } = await import("@/lib/rate-limit");
      const ip = getClientIp(request);
      const userAgent = request.headers.get("user-agent") || "Magic Link Auth";
      void sendLoginAlert(user, ip, userAgent);
    } catch (e) {
      console.warn("Failed to dispatch magic login alert:", e);
    }

    return new Response(null, {
      status: 303,
      headers: {
        Location: `${appUrl}/dashboard`,
        "Set-Cookie": session.cookie,
      },
    });
  } catch (error) {
    return Response.redirect(
      `${appUrl}/dashboard?auth_error=${encodeURIComponent("An error occurred while signing in with magic link.")}`,
      303
    );
  }
}
