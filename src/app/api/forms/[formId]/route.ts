import { and, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { auditLogs, forms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson, readString, slugify } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

async function ownedForm(request: Request, formId: string) {
  const db = getDb();
  if (!isDbReady(db)) {
    return { response: databaseUnavailableResponse() } as const;
  }

  try {
    await ensureSchema(db);
  } catch (error) {
    return { response: jsonError("DB_ERROR", "Failed to initialize schema.", 500) } as const;
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return { response: jsonError("UNAUTHENTICATED", "Sign in to manage this form.", 401) } as const;
  }

  try {
    const rows = await db
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
      .limit(1);

    if (!rows[0]) {
      return { response: jsonError("FORM_NOT_FOUND", "Form not found.", 404) } as const;
    }

    return { db, user, form: rows[0] } as const;
  } catch (error) {
    return { response: jsonError("DB_ERROR", "Database query failed.", 500) } as const;
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await ownedForm(request, formId);
  if ("response" in result) {
    return result.response;
  }

  const sanitizedForm = {
    ...result.form,
    smtpPass: result.form.smtpPass ? "__SMTP_PASSWORD_SET__" : null,
  };
  return jsonOk({ form: sanitizedForm, endpointPath: `/api/submit/${result.form.endpointId}` });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await ownedForm(request, formId);
  if ("response" in result) {
    return result.response;
  }

  const body = await readJson(request);
  
  const webhookUrlVal = readString(body.webhookUrl, result.form.webhookUrl ?? "") || null;
  const redirectUrlVal = readString(body.redirectUrl, result.form.redirectUrl ?? "") || null;

  if (webhookUrlVal) {
    const { isPrivateUrl } = await import("@/lib/url-validation");
    if (isPrivateUrl(webhookUrlVal)) {
      return jsonError("INVALID_WEBHOOK_URL", "SSRF Block: Private/Internal IP addresses are not allowed for webhooks.", 400);
    }
  }

  if (redirectUrlVal) {
    const { isSafeRedirectUrl } = await import("@/lib/url-validation");
    if (!isSafeRedirectUrl(redirectUrlVal)) {
      return jsonError("INVALID_REDIRECT_URL", "Only HTTP and HTTPS protocols are allowed for redirect URLs.", 400);
    }
  }

  let smtpPassVal = result.form.smtpPass;
  const rawSmtpPass = readString(body.smtpPass);
  if (rawSmtpPass === "") {
    smtpPassVal = null;
  } else if (rawSmtpPass && rawSmtpPass !== "__SMTP_PASSWORD_SET__") {
    const { encryptText } = await import("@/lib/encryption");
    smtpPassVal = await encryptText(rawSmtpPass);
  }

  const update = {
    name: readString(body.name, result.form.name).slice(0, 120),
    slug: slugify(readString(body.slug, result.form.slug)),
    description: readString(body.description, result.form.description ?? "") || null,
    redirectUrl: redirectUrlVal,
    successMessage: readString(body.successMessage, result.form.successMessage),
    allowedOrigins: readString(body.allowedOrigins, result.form.allowedOrigins),
    honeypotField: readString(body.honeypotField, result.form.honeypotField),
    requireProofOfWork:
      typeof body.requireProofOfWork === "boolean" ? body.requireProofOfWork : result.form.requireProofOfWork,
    notifyEmail: typeof body.notifyEmail === "boolean" ? body.notifyEmail : result.form.notifyEmail,
    emailTo: readString(body.emailTo, result.form.emailTo ?? "") || null,
    webhookUrl: webhookUrlVal,
    isActive: typeof body.isActive === "boolean" ? body.isActive : result.form.isActive,
    altchaEnabled: typeof body.altchaEnabled === "boolean" ? body.altchaEnabled : result.form.altchaEnabled,
    autoresponderSubject: readString(body.autoresponderSubject, result.form.autoresponderSubject ?? "") || null,
    autoresponderBody: readString(body.autoresponderBody, result.form.autoresponderBody ?? "") || null,
    spamBlocklist: readString(body.spamBlocklist, result.form.spamBlocklist ?? "") || null,
    retentionDays: typeof body.retentionDays === "number" ? body.retentionDays : result.form.retentionDays,
    emailVerificationEnabled: typeof body.emailVerificationEnabled === "boolean" ? body.emailVerificationEnabled : result.form.emailVerificationEnabled,
    storeIpHash: typeof body.storeIpHash === "boolean" ? body.storeIpHash : result.form.storeIpHash,
    smtpEnabled: typeof body.smtpEnabled === "boolean" ? body.smtpEnabled : result.form.smtpEnabled,
    smtpHost: readString(body.smtpHost, result.form.smtpHost ?? "") || null,
    smtpPort: typeof body.smtpPort === "number" ? body.smtpPort : (body.smtpPort ? Number(body.smtpPort) : result.form.smtpPort),
    smtpUser: readString(body.smtpUser, result.form.smtpUser ?? "") || null,
    smtpPass: smtpPassVal,
    smtpFrom: readString(body.smtpFrom, result.form.smtpFrom ?? "") || null,
    gasUrl: readString(body.gasUrl, result.form.gasUrl ?? "") || null,
    telegramBotToken: readString(body.telegramBotToken, result.form.telegramBotToken ?? "") || null,
    telegramChatId: readString(body.telegramChatId, result.form.telegramChatId ?? "") || null,
    ntfyTopic: readString(body.ntfyTopic, result.form.ntfyTopic ?? "") || null,
    otpEnabled: typeof body.otpEnabled === "boolean" ? body.otpEnabled : result.form.otpEnabled,
    submissionLimit: typeof body.submissionLimit === "number" ? body.submissionLimit : (body.submissionLimit ? Number(body.submissionLimit) : result.form.submissionLimit ?? 0),
    emailSubjectTemplate: readString(body.emailSubjectTemplate, result.form.emailSubjectTemplate ?? "") || null,
    autoresponderReplyTo: readString(body.autoresponderReplyTo, result.form.autoresponderReplyTo ?? "") || null,
    updatedAt: new Date().toISOString(),
  };

  try {
    await result.db.update(forms).set(update).where(eq(forms.id, formId));
    await result.db.insert(auditLogs).values({
      userId: result.user.id,
      formId,
      action: "form.updated",
      metadata: JSON.stringify(update),
    });

    return jsonOk({ form: { ...result.form, ...update } });
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to update form details.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await ownedForm(request, formId);
  if ("response" in result) {
    return result.response;
  }

  try {
    // Perform a hard delete from the database
    await result.db.delete(forms).where(eq(forms.id, formId));
    await result.db.insert(auditLogs).values({
      userId: result.user.id,
      formId: null,
      action: "form.deleted",
      metadata: JSON.stringify({ formId }),
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to delete form.", 500);
  }
}
