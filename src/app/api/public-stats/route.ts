import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { submissions, forms, users } from "@/db/schema";
import { cacheKey, cached } from "@/lib/kv-cache";

export const dynamic = "force-dynamic";

/**
 * Public counters rendered on the landing page.
 *
 * Every visitor polls this endpoint, and each poll used to run three separate
 * `count(*)` scans over `submissions`, `forms` and `users` — the most
 * expensive read in the application for the least specific data. The numbers
 * only need to be roughly live, so they are cached for two minutes in KV
 * (shared across isolates/colos) and 15 seconds in isolate memory.
 *
 * With the cache warm a poll performs zero D1 reads; at the 100k/day Worker
 * ceiling that removes ~3 D1 queries per visitor.
 */
const STATS_TTL_SECONDS = 120;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type PublicStats = {
  ok: true;
  submissions: number;
  forms: number;
  users: number;
  fallback: boolean;
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  const db = getDb();

  if (!db) {
    return Response.json(
      { ok: true, submissions: 0, forms: 0, users: 0, fallback: true } satisfies PublicStats,
      { headers: corsHeaders },
    );
  }

  try {
    const stats = await cached<PublicStats>(
      cacheKey("public-stats"),
      STATS_TTL_SECONDS,
      async () => {
        // Three narrow counts, issued together so a cold cache costs one
        // round trip of wall-clock latency instead of three sequential ones.
        const [subsCount, formsCount, usersCount] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(submissions),
          db.select({ count: sql<number>`count(*)` }).from(forms),
          db.select({ count: sql<number>`count(*)` }).from(users),
        ]);

        return {
          ok: true as const,
          submissions: Number(subsCount[0]?.count ?? 0),
          forms: Number(formsCount[0]?.count ?? 0),
          users: Number(usersCount[0]?.count ?? 0),
          fallback: false,
        };
      },
    );

    return Response.json(stats, {
      headers: { ...corsHeaders, "Cache-Control": "public, max-age=30" },
    });
  } catch {
    // A counter is never worth failing a page render over.
    return Response.json(
      { ok: true, submissions: 0, forms: 0, users: 0, fallback: true } satisfies PublicStats,
      { headers: corsHeaders },
    );
  }
}
