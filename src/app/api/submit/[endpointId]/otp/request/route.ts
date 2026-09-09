import { getDb, isDbReady, databaseUnavailableResponse } from "@/db";
import { forms } from "@/db/schema";
import { createOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/notifications";
import { eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ endpointId: string }> }
) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  const { endpointId } = await params;

  try {
    const formRows = await db
      .select()
      .from(forms)
      .where(eq(forms.endpointId, endpointId))
      .limit(1);

    if (!formRows.length) {
      return Response.json({ ok: false, error: "Form not found" }, { status: 404 });
    }

    const form = formRows[0];
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = body.email?.trim()?.toLowerCase();

    if (!email || !email.includes("@")) {
      return Response.json({ ok: false, error: "Valid email address is required" }, { status: 400 });
    }

    // Rate Limiting: Prevent email bombing & provider abuse (by IP & target email)
    const { checkRateLimit, rateLimitResponse, getClientIp } = await import("@/lib/rate-limit");
    const ip = getClientIp(request);
    const ipLimit = await checkRateLimit(db, `otp_req_ip:${ip}`, 5, 600); // 5 per 10 min
    if (!ipLimit.allowed) {
      return rateLimitResponse(ipLimit.resetAt);
    }
    const emailLimit = await checkRateLimit(db, `otp_req_mail:${form.id}:${email}`, 3, 600); // 3 per 10 min
    if (!emailLimit.allowed) {
      return rateLimitResponse(emailLimit.resetAt);
    }

    const { code } = await createOtp(db, form.id, email);
    const sent = await sendOtpEmail(form, email, code);

    if (!sent) {
      return Response.json({
        ok: false,
        error: "Failed to send verification code. Email delivery is not configured on this form. Please ask the form owner to set up Google Apps Script (GAS) or SMTP in their FormForge settings.",
      }, { status: 503 });
    }

    return Response.json({
      ok: true,
      message: "Verification code sent to your email address",
      sentViaProvider: true,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate OTP" },
      { status: 500 }
    );
  }
}
