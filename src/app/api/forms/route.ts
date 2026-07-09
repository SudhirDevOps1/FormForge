import { desc, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { auditLogs, forms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { endpointId, jsonError, jsonOk, readJson, readString, slugify } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to list forms.", 401);
  }

  const rows = await db.select().from(forms).where(eq(forms.userId, user.id)).orderBy(desc(forms.createdAt));
  const sanitizedRows = rows.map(r => ({
    ...r,
    smtpPass: r.smtpPass ? "__SMTP_PASSWORD_SET__" : null
  }));
  return jsonOk({ forms: sanitizedRows });
}

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to create forms.", 401);
  }

  const body = await readJson(request);
  const name = readString(body.name, "New form").slice(0, 120);
  const formId = randomId("form");
  const slug = slugify(readString(body.slug, name));
  const endpoint = endpointId();

  const webhookUrlVal = readString(body.webhookUrl) || null;
  const redirectUrlVal = readString(body.redirectUrl) || null;

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

  try {
    await db.insert(forms).values({
      id: formId,
      userId: user.id,
      name,
      slug,
      endpointId: endpoint,
      description: readString(body.description) || null,
      redirectUrl: redirectUrlVal,
      allowedOrigins: readString(body.allowedOrigins, "*"),
      honeypotField: readString(body.honeypotField, "website") || "website",
      requireProofOfWork: Boolean(body.requireProofOfWork),
      notifyEmail: Boolean(body.notifyEmail),
      emailTo: readString(body.emailTo) || null,
      webhookUrl: webhookUrlVal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.insert(auditLogs).values({
      userId: user.id,
      formId,
      action: "form.created",
      metadata: JSON.stringify({ slug, endpoint }),
    });

    return jsonOk(
      {
        form: { id: formId, name, slug, endpointId: endpoint, endpointPath: `/api/submit/${endpoint}` },
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to create new form.", 500);
  }
}
