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
    const email = body.email?.trim();

    if (!email || !email.includes("@")) {
      return Response.json({ ok: false, error: "Valid email address is required" }, { status: 400 });
    }

    const { code } = await createOtp(db, form.id, email);
    const sent = await sendOtpEmail(form, email, code);

    return Response.json({
      ok: true,
      message: "OTP sent to your email address",
      sentViaProvider: sent,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate OTP" },
      { status: 500 }
    );
  }
}
