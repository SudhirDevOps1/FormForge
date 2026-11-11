import { and, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { sanitizeHtml } from "@/lib/security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ submissionId: string }> };

const MAX_REPLY_LENGTH = 8000;

/**
 * Reply to a submission by email.
 *
 * The reply is sent to the address captured in the submission (never to an
 * address supplied in the request body), so a compromised dashboard session
 * cannot be used to make FormForge send mail to an arbitrary recipient.
 */
export async function POST(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to reply.", 401);
  }

  const { submissionId } = await context.params;
  const rows = await db
    .select({ submission: submissions, form: forms })
    .from(submissions)
    .innerJoin(forms, eq(submissions.formId, forms.id))
    .where(and(eq(submissions.id, submissionId), eq(forms.userId, user.id)))
    .limit(1);

  const match = rows[0];
  if (!match) {
    return jsonError("NOT_FOUND", "Submission not found or unauthorized.", 404);
  }

  if (!match.submission.email) {
    return jsonError(
      "NO_EMAIL",
      "This submission does not include an email address, so it cannot be answered by email.",
      400,
    );
  }

  const body = await readJson(request);
  const raw = typeof body.body === "string" ? body.body.trim() : "";
  if (!raw) {
    return jsonError("BAD_REQUEST", "A reply body is required.", 400);
  }
  if (raw.length > MAX_REPLY_LENGTH) {
    return jsonError("BAD_REQUEST", `Replies are limited to ${MAX_REPLY_LENGTH} characters.`, 400);
  }

  const subject =
    typeof body.subject === "string" && body.subject.trim()
      ? body.subject.trim().slice(0, 200)
      : `Re: Your submission to ${match.form.name}`;

  try {
    const { sendSubmissionReply } = await import("@/lib/notifications");
    const sent = await sendSubmissionReply(
      match.form,
      match.submission.email,
      sanitizeHtml(raw),
      subject,
      user.email || undefined,
    );

    if (!sent) {
      return jsonError(
        "DELIVERY_FAILED",
        "The reply could not be delivered. Configure an email provider in Settings first.",
        502,
      );
    }

    // Mark the submission as handled so it leaves the "new" queue.
    await db
      .update(submissions)
      .set({ workflowStatus: "in_progress" })
      .where(eq(submissions.id, submissionId));

    return jsonOk({ sent: true, to: match.submission.email, subject });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while sending the reply.", 500);
  }
}
