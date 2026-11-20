import { getDb, isDbReady } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getFile } from "@/lib/storage";

type RouteContext = { params: Promise<{ submissionId: string; filename: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  const db = getDb();
  if (!db || !isDbReady(db)) {
    return new Response("Database not ready", { status: 503 });
  }

  // Verify owner authentication
  const user = await getCurrentUser(request, db);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { submissionId, filename } = await context.params;

  // Verify that the requested submission actually belongs to a form owned by this user (IDOR prevention)
  const { forms, submissions } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const rows = await db
    .select({ id: submissions.id, payload: submissions.payload })
    .from(submissions)
    .innerJoin(forms, eq(submissions.formId, forms.id))
    .where(and(eq(submissions.id, submissionId), eq(forms.userId, user.id)))
    .limit(1);

  if (!rows[0]) {
    return new Response("Unauthorized or file not found", { status: 404 });
  }

  const decodedFilename = decodeURIComponent(filename);
  const storageKey = `uploads/${submissionId}/${decodedFilename}`;

  try {
    let fileBuffer: ArrayBuffer | ReadableStream<any> | null = null;
    let contentType = "application/octet-stream";

    const fileResult = await getFile(storageKey);
    if (fileResult) {
      fileBuffer = fileResult.data;
      contentType = fileResult.contentType;
    } else if (rows[0].payload) {
      // Zero-card inline fallback (files <= 2MB stored in database when R2/S3 is unconfigured)
      try {
        const payload = JSON.parse(rows[0].payload);
        for (const val of Object.values(payload)) {
          if (
            val &&
            typeof val === "object" &&
            (val as any).name === decodedFilename &&
            typeof (val as any).data === "string"
          ) {
            const dataUri = (val as any).data as string;
            const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              contentType = match[1];
              const base64Str = match[2];
              const binaryStr = atob(base64Str);
              const len = binaryStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              fileBuffer = bytes.buffer as ArrayBuffer;
              break;
            }
          }
        }
      } catch {
        // Fallback error non-blocking
      }
    }

    if (!fileBuffer) {
      return new Response("File not found in storage", { status: 404 });
    }

    const safePreviewTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
    const isSafePreview = safePreviewTypes.includes(contentType.toLowerCase());
    const dispositionType = isSafePreview ? "inline" : "attachment";

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(decodedFilename)}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Frame-Options": "DENY",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Secure file download request failed:", err);
    return new Response("Failed to fetch file from storage backend.", { status: 500 });
  }
}
