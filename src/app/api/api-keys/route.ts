import { desc, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, getRuntimeEnv, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { apiKeys } from "@/db/schema";
import { getCurrentUser, isAuthConfigured, AUTH_SECRET_HELP } from "@/lib/auth";
import { hmacSha256, randomId, randomToken } from "@/lib/crypto";
import { jsonError, jsonOk, readJson, readString } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to list API keys.", 401);
  }

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));

  // Filter out active vs revoked or let client decide. We filter out explicitly revoked.
  return jsonOk({ apiKeys: rows.filter(r => !r.revokedAt) });
}

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  try {
    await ensureSchema(db);
  } catch (error) {
    return jsonError("DB_ERROR", "Database not initialized.", 500);
  }

  if (!isAuthConfigured()) {
    return jsonError("AUTH_SECRET_MISSING", AUTH_SECRET_HELP, 503);
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to create API keys.", 401);
  }

  const secret = getRuntimeEnv().AUTH_SECRET;
  if (!secret) {
    return jsonError("AUTH_SECRET_MISSING", "Set AUTH_SECRET before creating API keys.", 503);
  }

  const body = await readJson(request);
  const token = `ff_live_${randomToken(32)}`;
  const prefix = token.slice(0, 16);

  const expiresInDays = Number(body.expiresInDays || 0);
  let expiresAt: string | null = null;
  if (expiresInDays > 0) {
    expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  }

  try {
    await db.insert(apiKeys).values({
      id: randomId("key"),
      userId: user.id,
      name: readString(body.name, "Default key"),
      keyPrefix: prefix,
      keyHash: await hmacSha256(token, secret),
      scopes: readString(body.scopes, "forms:read,submissions:read"),
      expiresAt,
    });

    return jsonOk({ apiKey: token, prefix, warning: "Copy this key now. It will not be shown again." }, { status: 201 });
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to create API key.", 500);
  }
}

export async function DELETE(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  try {
    await ensureSchema(db);
  } catch (error) {
    return jsonError("DB_ERROR", "Database not initialized.", 500);
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to revoke API keys.", 401);
  }

  const url = new URL(request.url);
  const keyId = url.searchParams.get("id");

  if (!keyId) {
    return jsonError("MISSING_PARAMETER", "API Key ID ('id') is required.", 400);
  }

  try {
    const updated = await db
      .update(apiKeys)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, keyId));

    return jsonOk({ revoked: true });
  } catch (error) {
    return jsonError("DB_ERROR", "Failed to revoke API key.", 500);
  }
}
