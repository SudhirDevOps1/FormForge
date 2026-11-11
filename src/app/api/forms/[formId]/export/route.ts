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

    // Payloads may be sealed with AES-256-GCM. Exports always contain the
    // readable body — the export is an explicit owner-initiated download.
    const { decryptPayload } = await import("@/lib/encryption");
    const decryptedRows = await Promise.all(
      rows.map(async (row) => ({ ...row, payload: await decryptPayload(row.payload) })),
    );
    const exportRows = decryptedRows;

    const url = new URL(request.url);
    const format = url.searchParams.get("format")?.toLowerCase() || "csv";

    if (format === "json") {
      const submissionsJson = exportRows.map((row) => {
        let parsedPayload = {};
        try {
          parsedPayload = JSON.parse(row.payload);
        } catch (_) {}
        return {
          id: row.id,
          createdAt: row.createdAt,
          status: row.status,
          workflowStatus: row.workflowStatus ?? "new",
          spamScore: row.spamScore,
          email: row.email,
          referer: row.referer,
          userAgent: row.userAgent,
          ipHash: row.ipHash,
          duplicateOf: row.duplicateOf ?? null,
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
      txt += `Total Submissions Exported: ${exportRows.length}\n`;
      txt += `=========================================\n\n`;

      exportRows.forEach((row) => {
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
    } else if (format === "pdf" || format === "print") {
      let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Submissions Report - ${escapeHtml(form.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-size: 13px;
    }
    .report-container {
      padding: 40px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .header-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .header-meta {
      text-align: right;
      color: #64748b;
      font-size: 12px;
    }
    .submissions-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .submissions-table th {
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 12px 10px;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
    }
    .submissions-table td {
      border-bottom: 1px solid #f1f5f9;
      padding: 12px 10px;
      vertical-align: top;
    }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-accepted {
      background: #dcfce7;
      color: #166534;
    }
    .status-spam {
      background: #fee2e2;
      color: #991b1b;
    }
    .status-pending {
      background: #fef9c3;
      color: #854d0e;
    }
    .payload-key {
      font-weight: 600;
      color: #334155;
    }
    .payload-val {
      color: #515f76;
    }
    @media print {
      body {
        margin: 0px;
      }
      .report-container {
        padding: 20px;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #f8fafc; padding: 15px 40px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-family: system-ui, -apple-system, sans-serif;">
    <span style="font-weight: 500; color: #475569; font-size: 13px;">📄 PDF Report Preview — If the print dialog didn't open automatically, use the button on the right.</span>
    <button onclick="window.print()" style="background: #0f172a; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px;">
      🖨️ Print / Save PDF
    </button>
  </div>

  <div class="report-container">
    <table class="header-table">
      <tr>
        <td>
          <h1 class="header-title">${escapeHtml(form.name)}</h1>
          <div style="color: #64748b; margin-top: 5px;">Form Endpoint Slug: /${escapeHtml(form.slug)}</div>
        </td>
        <td class="header-meta">
          <div><strong>Submissions Export Report</strong></div>
          <div style="margin-top: 5px;">Generated: ${new Date().toLocaleString()}</div>
          <div>Total Exchanged: ${exportRows.length} entries</div>
        </td>
      </tr>
    </table>

    <table class="submissions-table">
      <thead>
        <tr>
          <th style="width: 15%;">Date</th>
          <th style="width: 12%;">Status</th>
          <th style="width: 25%;">Email</th>
          <th style="width: 48%;">Payload Data</th>
        </tr>
      </thead>
      <tbody>`;

      exportRows.forEach((row) => {
        let parsedPayload: Record<string, any> = {};
        try {
          parsedPayload = JSON.parse(row.payload);
        } catch (_) {}

        const statusClass = row.status === "accepted" ? "status-accepted" : row.status === "pending" ? "status-pending" : "status-spam";

        html += `
        <tr>
          <td>${new Date(row.createdAt).toLocaleDateString()} ${new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td><span class="status-badge ${statusClass}">${row.status}</span></td>
          <td><strong>${escapeHtml(row.email || "N/A")}</strong></td>
          <td>
            <div style="display: grid; gap: 4px;">`;
        
        Object.entries(parsedPayload).forEach(([k, v]) => {
          html += `<div><span class="payload-key">${escapeHtml(k)}:</span> <span class="payload-val">${escapeHtml(String(v))}</span></div>`;
        });

        html += `
            </div>
          </td>
        </tr>`;
      });

      html += `
      </tbody>
    </table>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        try {
          window.print();
        } catch (e) {
          console.error("Auto print failed: ", e);
        }
      }, 700);
    };
  </script>
</body>
</html>`;

      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    } else {
      // Default to CSV.
      //
      // The payload is flattened into one column per field so the export
      // opens directly in a spreadsheet — no JSON parsing required. Fixed
      // metadata columns always come first, then the discovered field keys
      // in a stable order.
      const payloadRows = exportRows.map((row) => {
        try {
          const parsed = JSON.parse(row.payload);
          return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
        } catch {
          return {};
        }
      });

      const fieldKeys: string[] = [];
      const seen = new Set<string>();
      for (const payload of payloadRows) {
        for (const key of Object.keys(payload)) {
          if (!seen.has(key)) {
            seen.add(key);
            fieldKeys.push(key);
          }
        }
      }

      const header = [
        "id",
        "created_at",
        "status",
        "workflow_status",
        "spam_score",
        "email",
        "referer",
        "duplicate_of",
        ...fieldKeys,
      ];

      const csv = [
        header.map(csvEscape).join(","),
        ...exportRows.map((row, index) => {
          const payload = payloadRows[index] ?? {};
          return [
            row.id,
            row.createdAt,
            row.status,
            row.workflowStatus ?? "new",
            row.spamScore,
            row.email ?? "",
            row.referer ?? "",
            row.duplicateOf ?? "",
            ...fieldKeys.map((key) => {
              const value = payload[key];
              if (value === null || value === undefined) return "";
              if (typeof value === "object") {
                try {
                  return JSON.stringify(value);
                } catch {
                  return "";
                }
              }
              return String(value);
            }),
          ]
            .map(csvEscape)
            .join(",");
        }),
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
