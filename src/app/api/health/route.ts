import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  if (!db) {
    return Response.json({
      ok: true,
      service: "FormForge",
      version: "1.0.0",
      database: "not-bound",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await ensureSchema(db);
    await db.run(sql`select 1`);
    return Response.json({
      ok: true,
      service: "FormForge",
      version: "1.0.0",
      database: "cloudflare-d1",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        service: "FormForge",
        database: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
