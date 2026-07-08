import { and, desc, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { csvEscape, jsonError } from "@/lib/http";

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
    return jsonError("UNAUTHENTICATED", "Sign in to export submissions.", 401);
  }

  const { formId } = await context.params;
  const formRows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
    .limit(1);
  const form = formRows[0];

  if (!form) {
    return jsonError("FORM_NOT_FOUND", "Form not found.", 404);
  }

  try {
    const rows = await db
      .select()
      .from(submissions)
      .where(eq(submissions.formId, formId))
      .orderBy(desc(submissions.createdAt))
      .limit(5000); // Guard memory limit — prevents worker crashes on large databases

    const url = new URL(request.url);
    const format = url.searchParams.get("format")?.toLowerCase() || "csv";

    if (format === "json") {
      const submissionsJson = rows.map((row) => {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(row.payload);
        } catch (_) {}
        return {
          id: row.id,
          createdAt: row.createdAt,
          status: row.status,
          spamScore: row.spamScore,
          email: row.email,
          referer: row.referer,
          userAgent: row.userAgent,
          ipHash: row.ipHash,
          payload: parsedPayload,
        };
      });

      return new Response(JSON.stringify(submissionsJson, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${form.slug}-submissions.json"`,
        },
      });
    } else if (format === "txt") {
      let txt = `=========================================\n`;
      txt += `SUBMISSIONS REPORT FOR: ${form.name} (${form.slug})\n`;
      txt += `Generated: ${new Date().toISOString()}\n`;
      txt += `Total Submissions Exported: ${rows.length}\n`;
      txt += `=========================================\n\n`;

      rows.forEach((row) => {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(row.payload);
        } catch (_) {}

        txt += `Submission ID: ${row.id}\n`;
        txt += `Date: ${row.createdAt}\n`;
        txt += `Status: ${row.status} (Spam Score: ${row.spamScore})\n`;
        if (row.email) txt += `Email: ${row.email}\n`;
        if (row.referer) txt += `Referer: ${row.referer}\n`;
        txt += `Data:\n`;
        Object.entries(parsedPayload).forEach(([k, v]) => {
          txt += `  ${k}: ${v}\n`;
        });
        txt += `-----------------------------------------\n\n`;
      });

      return new Response(txt, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${form.slug}-submissions.txt"`,
        },
      });
    } else {
      // Default to CSV
      const header = ["id", "created_at", "status", "spam_score", "email", "referer", "payload"];
      const csv = [
        header.map(csvEscape).join(","),
        ...rows.map((row) =>
          [row.id, row.createdAt, row.status, row.spamScore, row.email ?? "", row.referer ?? "", row.payload]
            .map(csvEscape)
            .join(","),
        ),
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${form.slug}-submissions.csv"`,
        },
      });
    }
  } catch (error) {
    return jsonError("INTERNAL_ERROR", "An error occurred while generating export.", 500);
  }
}
