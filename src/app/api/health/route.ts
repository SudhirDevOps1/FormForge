import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { sql } from "drizzle-orm";
import { APP_NAME, APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * Liveness probe.
 *
 * The version comes from `src/lib/version.ts`, which reads `package.json`, so
 * this endpoint can no longer advertise a stale literal (it used to claim
 * `1.0.0` while the released version was `1.1.1`).
 *
 * The `select 1` probe is intentionally *not* cached: a health endpoint that
 * answers from cache would report "healthy" while the database is unreachable.
 * It is a single-row constant expression with no table access, so it costs one
 * D1 read at most.
 */
export async function GET() {
  const db = getDb();

  if (!db) {
    return Response.json({
      ok: true,
      service: APP_NAME,
      version: APP_VERSION,
      database: "not-bound",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await ensureSchema(db);
    await db.run(sql`select 1`);
    return Response.json({
      ok: true,
      service: APP_NAME,
      version: APP_VERSION,
      database: "cloudflare-d1",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        ok: false,
        service: APP_NAME,
        version: APP_VERSION,
        database: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
