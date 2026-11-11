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
    const body = (await request.json()) as { status?: string; workflowStatus?: string };

    const validStatuses = ["accepted", "spam", "pending"];
    const validWorkflowStatuses = ["new", "in_progress", "resolved", "spam"];

    if (!body.status && !body.workflowStatus) {
      return jsonError("BAD_REQUEST", "Status is required.", 400);
    }

    const update: Partial<typeof submissions.$inferInsert> = {};

    if (body.status) {
      if (!validStatuses.includes(body.status)) {
        return jsonError("INVALID_STATUS", "Status must be 'accepted', 'spam', or 'pending'.", 400);
      }
      update.status = body.status;
    }

    if (body.workflowStatus) {
      if (!validWorkflowStatuses.includes(body.workflowStatus)) {
        return jsonError(
          "INVALID_WORKFLOW_STATUS",
          "Workflow status must be 'new', 'in_progress', 'resolved', or 'spam'.",
          400,
        );
      }
      update.workflowStatus = body.workflowStatus;
    }

    await db.update(submissions).set(update).where(eq(submissions.id, submissionId));

    return jsonOk({
      success: true,
      status: update.status ?? match.submission.status,
      workflowStatus: update.workflowStatus ?? match.submission.workflowStatus,
    });
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
