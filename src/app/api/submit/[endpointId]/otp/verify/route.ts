import { getDb, isDbReady, databaseUnavailableResponse } from "@/db";
import { forms } from "@/db/schema";
import { verifyOtp } from "@/lib/otp";
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
    const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
    const email = body.email?.trim();
    const code = body.code?.trim();

    if (!email || !code) {
      return Response.json({ ok: false, error: "Email and code are required" }, { status: 400 });
    }

    const result = await verifyOtp(db, form.id, email, code);

    if (!result.success) {
      return Response.json({ ok: false, error: result.error || "Verification failed" }, { status: 400 });
    }

    return Response.json({
      ok: true,
      verified: true,
      message: "Email successfully verified via OTP",
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
