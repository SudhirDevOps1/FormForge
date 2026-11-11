import { and, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissionNotes, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { sanitizeHtml } from "@/lib/security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ submissionId: string }> };

const MAX_NOTE_LENGTH = 4000;

async function getAuthorizedSubmission(submissionId: string, userId: string) {
  const db = getDb();
  if (!isDbReady(db)) return null;

  const rows = await db
    .select({ submission: submissions, form: forms })
    .from(submissions)
    .innerJoin(forms, eq(submissions.formId, forms.id))
    .where(and(eq(submissions.id, submissionId), eq(forms.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Internal notes attached to a submission.
 *
 * Notes never leave the dashboard — they are excluded from webhook payloads,
 * email notifications and exports.
 */
export async function GET(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to read notes.", 401);
  }

  const { submissionId } = await context.params;
  const match = await getAuthorizedSubmission(submissionId, user.id);
  if (!match) {
    return jsonError("NOT_FOUND", "Submission not found or unauthorized.", 404);
  }

  try {
    const rows = await db
      .select()
      .from(submissionNotes)
      .where(eq(submissionNotes.submissionId, submissionId));

    return jsonOk({ notes: rows });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while loading notes.", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to add notes.", 401);
  }

  const { submissionId } = await context.params;
  const match = await getAuthorizedSubmission(submissionId, user.id);
  if (!match) {
    return jsonError("NOT_FOUND", "Submission not found or unauthorized.", 404);
  }

  const body = await readJson(request);
  const raw = typeof body.body === "string" ? body.body.trim() : "";
  if (!raw) {
    return jsonError("BAD_REQUEST", "A note body is required.", 400);
  }
  if (raw.length > MAX_NOTE_LENGTH) {
    return jsonError("BAD_REQUEST", `Notes are limited to ${MAX_NOTE_LENGTH} characters.`, 400);
  }

  try {
    // Notes are rendered inside the dashboard; sanitize so a stored-XSS
    // payload can never execute when the note is displayed.
    const safeBody = sanitizeHtml(raw).slice(0, MAX_NOTE_LENGTH);

    const inserted = await db
      .insert(submissionNotes)
      .values({
        id: randomId("note"),
        submissionId,
        author: user.email || "owner",
        body: safeBody,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return jsonOk({ note: inserted[0] }, { status: 201 });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while saving the note.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to delete notes.", 401);
  }

  const { submissionId } = await context.params;
  const match = await getAuthorizedSubmission(submissionId, user.id);
  if (!match) {
    return jsonError("NOT_FOUND", "Submission not found or unauthorized.", 404);
  }

  const url = new URL(request.url);
  const noteId = url.searchParams.get("id");
  if (!noteId) {
    return jsonError("BAD_REQUEST", "Provide the note id to delete.", 400);
  }

  try {
    await db
      .delete(submissionNotes)
      .where(and(eq(submissionNotes.id, noteId), eq(submissionNotes.submissionId, submissionId)));
    return jsonOk({ deleted: true, id: noteId });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while deleting the note.", 500);
  }
}
