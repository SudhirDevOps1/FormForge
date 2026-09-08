import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions, webhookLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { dispatchWebhook } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { formId } = await context.params;

  const formRows = await db
    .select()
    .from(forms)
    .where(eq(forms.id, formId))
    .limit(1);

  const form = formRows[0];
  if (!form || form.userId !== user.id) {
    return NextResponse.json({ ok: false, message: "Form not found" }, { status: 404 });
  }

  const logs = await db
    .select()
    .from(webhookLogs)
    .where(eq(webhookLogs.formId, form.id))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(50);

  return NextResponse.json({ ok: true, logs });
}

export async function POST(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { formId } = await context.params;

  const formRows = await db
    .select()
    .from(forms)
    .where(eq(forms.id, formId))
    .limit(1);

  const form = formRows[0];
  if (!form || form.userId !== user.id) {
    return NextResponse.json({ ok: false, message: "Form not found" }, { status: 404 });
  }

  if (!form.webhookUrl) {
    return NextResponse.json({ ok: false, message: "No webhook URL configured on this form" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const submissionId = body.submissionId;

  if (!submissionId) {
    return NextResponse.json({ ok: false, message: "Missing submissionId to redeliver" }, { status: 400 });
  }

  const subRows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  const submission = subRows[0];
  if (!submission || submission.formId !== form.id) {
    return NextResponse.json({ ok: false, message: "Submission not found for this form" }, { status: 404 });
  }

  const result = await dispatchWebhook(db, form, submission, form.webhookUrl, "form.redelivered");

  return NextResponse.json({
    ok: result.success,
    result,
  });
}
