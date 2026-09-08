import { NextResponse } from "next/server";
import { getDb, isDbReady } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { getStorageConfig, testStorageConnection } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = getDb();
  if (!db || !isDbReady(db)) {
    return NextResponse.json({ ok: false, message: "Database not ready" }, { status: 503 });
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const config = getStorageConfig();

  // Safely expose provider info without sensitive keys
  const safeEndpoint = config.endpoint
    ? config.endpoint.replace(/^https?:\/\//, "").split("/")[0]
    : null;

  return NextResponse.json({
    ok: true,
    data: {
      type: config.type,
      providerName: config.providerName,
      bucketName: config.bucketName || null,
      endpoint: safeEndpoint,
      configured: config.type !== "none",
    },
  });
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db || !isDbReady(db)) {
    return NextResponse.json({ ok: false, message: "Database not ready" }, { status: 503 });
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await testStorageConnection();
    return NextResponse.json({
      ok: result.ok,
      data: result,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Storage test failed",
      },
      { status: 500 }
    );
  }
}
