import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
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
    return jsonError("UNAUTHENTICATED", "Sign in to view submissions.", 401);
  }

  const { formId } = await context.params;
  const formRows = await db
    .select({ id: forms.id })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
    .limit(1);

  if (!formRows[0]) {
    return jsonError("FORM_NOT_FOUND", "Form not found.", 404);
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const statusFilter = url.searchParams.get("status")?.toLowerCase();
  const searchFilter = url.searchParams.get("q")?.trim();

  try {
    const conditions = [eq(submissions.formId, formId)];

    if (statusFilter && ["accepted", "spam", "pending"].includes(statusFilter)) {
      conditions.push(eq(submissions.status, statusFilter));
    }

    if (searchFilter) {
      const searchPattern = `%${searchFilter}%`;
      conditions.push(
        or(
          like(submissions.email, searchPattern),
          like(submissions.payload, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Query total count for pagination with active filters
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(submissions)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);

    const rows = await db
      .select()
      .from(submissions)
      .where(whereClause)
      .orderBy(desc(submissions.createdAt))
      .limit(limit)
      .offset(offset);

    // Also get status count breakdown for dashboard tabs
    const statusCountsResult = await db
      .select({
        status: submissions.status,
        count: sql<number>`count(*)`,
      })
      .from(submissions)
      .where(eq(submissions.formId, formId))
      .groupBy(submissions.status);

    const counts = {
      all: 0,
      accepted: 0,
      spam: 0,
      pending: 0,
    };
    for (const row of statusCountsResult) {
      const cnt = Number(row.count ?? 0);
      counts.all += cnt;
      if (row.status === "accepted") counts.accepted = cnt;
      else if (row.status === "spam") counts.spam = cnt;
      else if (row.status === "pending") counts.pending = cnt;
    }

    return jsonOk({
      submissions: rows,
      pagination: { limit, offset, total },
      counts,
    });
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to retrieve submissions.", 500);
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
    return jsonError("UNAUTHENTICATED", "Sign in to delete submissions.", 401);
  }

  const { formId } = await context.params;
  const formRows = await db
    .select({ id: forms.id })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
    .limit(1);

  if (!formRows[0]) {
    return jsonError("FORM_NOT_FOUND", "Form not found.", 404);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      ids?: string[];
      clearSpam?: boolean;
    };

    if (body.clearSpam) {
      await db
        .delete(submissions)
        .where(and(eq(submissions.formId, formId), eq(submissions.status, "spam")));

      // Recalculate remaining submission count
      const remainingResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissions)
        .where(eq(submissions.formId, formId));
      const remainingCount = Number(remainingResult[0]?.count ?? 0);

      await db
        .update(forms)
        .set({ submissionsCount: remainingCount, updatedAt: new Date().toISOString() })
        .where(eq(forms.id, formId));

      return jsonOk({ success: true, message: "All spam submissions deleted." });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      await db
        .delete(submissions)
        .where(and(eq(submissions.formId, formId), inArray(submissions.id, body.ids)));

      // Recalculate remaining count
      const remainingResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissions)
        .where(eq(submissions.formId, formId));
      const remainingCount = Number(remainingResult[0]?.count ?? 0);

      await db
        .update(forms)
        .set({ submissionsCount: remainingCount, updatedAt: new Date().toISOString() })
        .where(eq(forms.id, formId));

      return jsonOk({ success: true, message: `Deleted ${body.ids.length} submissions.` });
    }

    return jsonError("BAD_REQUEST", "Provide 'ids' array or 'clearSpam: true'.", 400);
  } catch (error) {
    return jsonError("INTERNAL_ERROR", "Failed to delete submissions.", 500);
  }
}
