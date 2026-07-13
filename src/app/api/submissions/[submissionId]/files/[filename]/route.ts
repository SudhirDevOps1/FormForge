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
  const decodedFilename = decodeURIComponent(filename);
  const storageKey = `uploads/${submissionId}/${decodedFilename}`;

  try {
    const fileResult = await getFile(storageKey);
    if (!fileResult) {
      return new Response("File not found in storage", { status: 404 });
    }

    return new Response(fileResult.data, {
      headers: {
        "Content-Type": fileResult.contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(decodedFilename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Secure file download request failed:", err);
    return new Response("Failed to fetch file from storage backend.", { status: 500 });
  }
}
