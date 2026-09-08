import { and, desc, eq, gte, sql } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

function parseUserAgent(ua: string | null): { browser: string; os: string; device: string } {
  if (!ua) return { browser: "Direct / API", os: "Unknown", device: "Bot / Script" };
  const lower = ua.toLowerCase();

  let browser = "Other";
  if (lower.includes("edg/")) browser = "Microsoft Edge";
  else if (lower.includes("chrome/") && !lower.includes("edg/")) browser = "Google Chrome";
  else if (lower.includes("safari/") && !lower.includes("chrome/")) browser = "Apple Safari";
  else if (lower.includes("firefox/")) browser = "Mozilla Firefox";
  else if (lower.includes("curl/") || lower.includes("python") || lower.includes("postman")) browser = "API Client";

  let os = "Other";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("macintosh") || lower.includes("mac os")) os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";

  let device = "Desktop";
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) device = "Mobile";
  else if (lower.includes("ipad") || lower.includes("tablet")) device = "Tablet";
  else if (lower.includes("bot") || lower.includes("crawler") || lower.includes("spider")) device = "Bot";

  return { browser, os, device };
}

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
    .select({
      id: forms.id,
      name: forms.name,
      slug: forms.slug,
      submissionsCount: forms.submissionsCount,
      submissionLimit: forms.submissionLimit,
    })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
    .limit(1);

  if (!formRows[0]) {
    return jsonError("FORM_NOT_FOUND", "Form not found.", 404);
  }

  try {
    // 1. Total statistics across accepted vs spam
    const stats = await db
      .select({
        status: submissions.status,
        count: sql<number>`count(*)`,
      })
      .from(submissions)
      .where(eq(submissions.formId, formId))
      .groupBy(submissions.status);

    const acceptedCount = Number(stats.find((s) => s.status === "accepted")?.count ?? 0);
    const spamCount = Number(stats.find((s) => s.status === "spam")?.count ?? 0);
    const totalCount = acceptedCount + spamCount;

    const totalStats = {
      accepted: acceptedCount,
      spam: spamCount,
      total: totalCount,
      acceptanceRate: totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 100,
      spamRate: totalCount > 0 ? Math.round((spamCount / totalCount) * 100) : 0,
    };

    // 2. Timeline statistics (last 30 days) - compute ISO string in JS for cross-database universal support
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

    const timelineRaw = await db
      .select({
        createdAt: submissions.createdAt,
        status: submissions.status,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.formId, formId),
          gte(submissions.createdAt, thirtyDaysAgoIso)
        )
      )
      .orderBy(submissions.createdAt);

    // Aggregate timeline by date (YYYY-MM-DD) and hour (0-23)
    const timelineMap: Record<string, { date: string; accepted: number; spam: number; total: number }> = {};
    const hourlyDistribution: number[] = new Array(24).fill(0);

    for (const row of timelineRaw) {
      const dateStr = (row.createdAt || "").slice(0, 10);
      if (dateStr) {
        if (!timelineMap[dateStr]) {
          timelineMap[dateStr] = { date: dateStr, accepted: 0, spam: 0, total: 0 };
        }
        if (row.status === "accepted") {
          timelineMap[dateStr].accepted++;
        } else {
          timelineMap[dateStr].spam++;
        }
        timelineMap[dateStr].total++;
      }

      // Hour extraction
      const timePart = (row.createdAt || "").slice(11, 13);
      const hour = parseInt(timePart, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) {
        hourlyDistribution[hour]++;
      }
    }

    const timeline = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

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
      .limit(6);

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
      .limit(6);

    // 5. Browser & Device Breakdown from recent submissions
    const recentSubmissions = await db
      .select({
        userAgent: submissions.userAgent,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .where(eq(submissions.formId, formId))
      .orderBy(desc(submissions.createdAt))
      .limit(100);

    const browsers: Record<string, number> = {};
    const devices: Record<string, number> = {};

    for (const sub of recentSubmissions) {
      const parsed = parseUserAgent(sub.userAgent);
      browsers[parsed.browser] = (browsers[parsed.browser] ?? 0) + 1;
      devices[parsed.device] = (devices[parsed.device] ?? 0) + 1;
    }

    const browserBreakdown = Object.entries(browsers).map(([name, count]) => ({ name, count }));
    const deviceBreakdown = Object.entries(devices).map(([name, count]) => ({ name, count }));

    return jsonOk({
      form: formRows[0],
      stats: totalStats,
      timeline,
      hourlyDistribution,
      referrers,
      submitters,
      browserBreakdown,
      deviceBreakdown,
    });
  } catch (error) {
    console.error("Analytics retrieval error:", error);
    return jsonError("DB_ERROR", "Failed to retrieve analytics data.", 500);
  }
}
