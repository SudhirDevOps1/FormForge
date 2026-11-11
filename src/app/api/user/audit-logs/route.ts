import { desc, eq, sql } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { auditLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Audit trail.
 *
 * FormForge has always written an audit row for administrative actions, but
 * there was no way to read them back. This endpoint exposes the trail so the
 * owner can see exactly who changed what, and when.
 *
 * Only the signed-in user's own rows are returned — the query is scoped by
 * `user_id`, so one deployment owner can never read another owner's trail.
 */
export async function GET(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to view the audit trail.", 401);
  }

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const actionFilter = url.searchParams.get("action")?.trim();

  try {
    const rows = await db
      .select({
        id: auditLogs.id,
        formId: auditLogs.formId,
        action: auditLogs.action,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.userId, user.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(eq(auditLogs.userId, user.id));

    const filtered = actionFilter
      ? rows.filter((row) => row.action.toLowerCase().includes(actionFilter.toLowerCase()))
      : rows;

    return jsonOk({
      entries: filtered.map((row) => ({
        id: row.id,
        formId: row.formId,
        action: row.action,
        metadata: safeParse(row.metadata),
        createdAt: row.createdAt,
      })),
      total: Number(total[0]?.count ?? 0),
      limit,
      offset,
    });
  } catch {
    return jsonError("INTERNAL_ERROR", "An error occurred while loading the audit trail.", 500);
  }
}

/** Parse the stored JSON metadata without letting a malformed row throw. */
function safeParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
