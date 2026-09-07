import { and, eq, sql } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ submissionId: string }> };

async function getAuthorizedSubmission(submissionId: string, userId: string) {
  const db = getDb();
  if (!isDbReady(db)) return null;

  const rows = await db
    .select({
      submission: submissions,
      form: forms,
    })
    .from(submissions)
    .innerJoin(forms, eq(submissions.formId, forms.id))
    .where(and(eq(submissions.id, submissionId), eq(forms.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function GET(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to view submission.", 401);
  }

  const { submissionId } = await context.params;
  const match = await getAuthorizedSubmission(submissionId, user.id);

  if (!match) {
    return jsonError("NOT_FOUND", "Submission not found or unauthorized.", 404);
  }

  return jsonOk({ submission: match.submission });
}

export async function PATCH(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to update submission.", 401);
  }

  const { submissionId } = await context.params;
  const match = await getAuthorizedSubmission(submissionId, user.id);

  if (!match) {
    return jsonError("NOT_FOUND", "Submission not found or unauthorized.", 404);
  }

  try {
    const body = (await request.json()) as { status?: string };
    if (!body || !body.status) {
      return jsonError("BAD_REQUEST", "Status is required.", 400);
    }

    const validStatuses = ["accepted", "spam", "pending"];
    if (!validStatuses.includes(body.status)) {
      return jsonError("INVALID_STATUS", "Status must be 'accepted', 'spam', or 'pending'.", 400);
    }

    await db
      .update(submissions)
      .set({ status: body.status })
      .where(eq(submissions.id, submissionId));

    return jsonOk({ success: true, status: body.status });
  } catch {
    return jsonError("INTERNAL_ERROR", "Failed to update submission status.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to delete submission.", 401);
  }

  const { submissionId } = await context.params;
  const match = await getAuthorizedSubmission(submissionId, user.id);

  if (!match) {
    return jsonError("NOT_FOUND", "Submission not found or unauthorized.", 404);
  }

  try {
    await db.delete(submissions).where(eq(submissions.id, submissionId));

    // Decrement submission count safely
    await db
      .update(forms)
      .set({
        submissionsCount: sql`MAX(0, ${forms.submissionsCount} - 1)`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(forms.id, match.form.id));

    return jsonOk({ success: true, message: "Submission deleted successfully." });
  } catch {
    return jsonError("INTERNAL_ERROR", "Failed to delete submission.", 500);
  }
}
