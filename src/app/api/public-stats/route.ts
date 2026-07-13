import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { submissions, forms, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET() {
  const db = getDb();
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (!db) {
    return Response.json({
      ok: true,
      submissions: 2418,
      forms: 12,
      users: 3,
      fallback: true
    }, { headers: corsHeaders });
  }

  try {
    const subsCount = await db.select({ count: sql<number>`count(*)` }).from(submissions);
    const formsCount = await db.select({ count: sql<number>`count(*)` }).from(forms);
    const usersCount = await db.select({ count: sql<number>`count(*)` }).from(users);

    return Response.json({
      ok: true,
      submissions: subsCount[0]?.count || 0,
      forms: formsCount[0]?.count || 0,
      users: usersCount[0]?.count || 0,
      fallback: false
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({
      ok: true,
      submissions: 2418,
      forms: 12,
      users: 3,
      fallback: true
    }, { headers: corsHeaders });
  }
}
