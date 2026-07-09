import { and, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson, readString } from "@/lib/http";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  try {
    await ensureSchema(db);
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to initialize schema.", 500);
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to test SMTP settings.", 401);
  }

  const rows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
    .limit(1);

  const form = rows[0];
  if (!form) {
    return jsonError("FORM_NOT_FOUND", "Form not found.", 404);
  }

  const body = await readJson(request);
  const smtpHost = readString(body.smtpHost);
  const smtpPort = body.smtpPort ? Number(body.smtpPort) : 587;
  const smtpUser = readString(body.smtpUser);
  let smtpPass = readString(body.smtpPass);
  const smtpFrom = readString(body.smtpFrom);

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return jsonError("MISSING_PARAMS", "All SMTP configuration parameters (host, port, username, password, from) are required.", 400);
  }

  // If password is the placeholder, decrypt the saved one
  if (smtpPass === "__SMTP_PASSWORD_SET__") {
    if (!form.smtpPass) {
      return jsonError("NO_SAVED_PASSWORD", "No saved password found.", 400);
    }
    const { decryptText } = await import("@/lib/encryption");
    smtpPass = await decryptText(form.smtpPass);
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10000,
    });

    const info = await transporter.sendMail({
      from: smtpFrom,
      to: smtpUser, // Send the test email to the user themselves
      subject: `FormForge - Test Email for ${form.name}`,
      text: `Hello!\n\nThis is a test email sent from your FormForge form settings.\n\nIf you received this email, your custom SMTP configurations are working perfectly!\n\nForm Name: ${form.name}\nSMTP Host: ${smtpHost}\nSMTP Username: ${smtpUser}`,
    });

    return jsonOk({ ok: true, messageId: info.messageId });
  } catch (error) {
    return jsonError("SMTP_TEST_FAILED", error instanceof Error ? error.message : String(error), 500);
  }
}
