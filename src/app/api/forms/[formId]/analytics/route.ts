import { and, eq, sql } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

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
    return jsonError("UNAUTHENTICATED", "Sign in to view analytics.", 401);
  }

  const { formId } = await context.params;
  const formRows = await db
    .select({ id: forms.id, name: forms.name })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
    .limit(1);

  if (!formRows[0]) {
    return jsonError("FORM_NOT_FOUND", "Form not found.", 404);
  }

  try {
    // 1. Total statistics
    const stats = await db
      .select({
        status: submissions.status,
        count: sql<number>`count(*)`,
      })
      .from(submissions)
      .where(eq(submissions.formId, formId))
      .groupBy(submissions.status);

    const totalStats = {
      accepted: stats.find(s => s.status === "accepted")?.count ?? 0,
      spam: stats.find(s => s.status === "spam")?.count ?? 0,
    };

    // 2. Timeline statistics (last 30 days)
    const timeline = await db
      .select({
        date: sql<string>`substr(created_at, 1, 10)`,
        status: submissions.status,
        count: sql<number>`count(*)`,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.formId, formId),
          sql`created_at >= date('now', '-30 days')`
        )
      )
      .groupBy(sql`substr(created_at, 1, 10)`, submissions.status)
      .orderBy(sql`substr(created_at, 1, 10)`);

    // 3. Top Referrers
    const referrers = await db
      .select({
        referer: submissions.referer,
        count: sql<number>`count(*)`,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.formId, formId),
          sql`referer IS NOT NULL AND referer != ''`
        )
      )
      .groupBy(submissions.referer)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    // 4. Top Submitters
    const submitters = await db
      .select({
        email: submissions.email,
        count: sql<number>`count(*)`,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.formId, formId),
          sql`email IS NOT NULL AND email != ''`
        )
      )
      .groupBy(submissions.email)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    return jsonOk({
      form: formRows[0],
      stats: totalStats,
      timeline,
      referrers,
      submitters,
    });
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to retrieve analytics data.", 500);
  }
}
