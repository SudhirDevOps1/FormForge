import { and, eq, lte } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { submissions, webhookLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Retry webhook deliveries whose backoff window has elapsed.
 *
 * Two callers are supported:
 *   • The dashboard owner (session cookie) — for a manual "retry due now".
 *   • A scheduler (Cloudflare Cron, GitHub Actions, any HTTP client) that
 *     sends the `CRON_SECRET` as a bearer token.
 *
 * The endpoint is idempotent: a delivery already marked as succeeded is
 * never picked up again, and each attempt is recorded as a new log row so the
 * full attempt history stays auditable.
 */
export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  const isOwner = Boolean(user);

  if (!isOwner) {
    const env = (await import("@/db")).getRuntimeEnv();
    const cronSecret = String(env.CRON_SECRET || (process.env.CRON_SECRET as string) || "").trim();
    const authorization = request.headers.get("authorization") || "";
    const provided = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : (request.headers.get("x-formforge-cron-secret") || "").trim();

    if (!cronSecret || !provided || provided !== cronSecret) {
      return jsonError("UNAUTHENTICATED", "Sign in or provide a valid CRON_SECRET.", 401);
    }
  }

  try {
    const now = new Date().toISOString();

    const due = await db
      .select()
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.status, "failed"),
          lte(webhookLogs.nextRetryAt, now),
        ),
      )
      .limit(25);

    if (!due.length) {
      return jsonOk({ processed: 0, retried: 0, skipped: 0 });
    }

    const { dispatchWebhook } = await import("@/lib/notifications");
    const { forms } = await import("@/db/schema");

    let retried = 0;
    let skipped = 0;
    const results: Array<{ id: string; success: boolean; attempt: number }> = [];

    for (const log of due) {
      const attempt = (log.attempts ?? 1) + 1;

      if (attempt > (log.maxAttempts ?? 5)) {
        skipped += 1;
        continue;
      }

      // Load the submission and its form for the redelivery.
      const submissionRows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, log.submissionId))
        .limit(1);

      const submission = submissionRows[0];
      if (!submission) {
        skipped += 1;
        continue;
      }

      const formRows = await db.select().from(forms).where(eq(forms.id, log.formId)).limit(1);
      const form = formRows[0];
      if (!form) {
        skipped += 1;
        continue;
      }

      // Mark the original log so it is not retried twice.
      await db
        .update(webhookLogs)
        .set({ nextRetryAt: null })
        .where(eq(webhookLogs.id, log.id));

      const outcome = await dispatchWebhook(db, form, submission, log.url, log.event);

      retried += 1;
      results.push({ id: log.id, success: outcome.success, attempt });
    }

    return jsonOk({ processed: due.length, retried, skipped, results });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while retrying webhook deliveries.", 500);
  }
}
