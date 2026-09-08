import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { verifyTotpCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);
  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to verify 2FA.", 401);
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_REQUEST", "Invalid JSON payload.", 400);
  }

  const code = (body.code ?? "").trim();
  if (!code || code.length !== 6) {
    return jsonError("VALIDATION_ERROR", "Please provide a valid 6-digit authentication code.", 400);
  }

  // Fetch pending totpSecret
  const userRows = await db
    .select({ id: users.id, totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const secret = userRows[0]?.totpSecret;
  if (!secret) {
    return jsonError("SETUP_REQUIRED", "No pending 2FA setup found. Please start setup again.", 400);
  }

  const isValid = await verifyTotpCode(secret, code, 1);
  if (!isValid) {
    return jsonError("INVALID_CODE", "Invalid authentication code. Please check your authenticator app and try again.", 400);
  }

  // Activate 2FA
  await db
    .update(users)
    .set({
      totpEnabled: true,
    })
    .where(eq(users.id, user.id));

  return jsonOk({
    success: true,
    message: "Two-factor authentication successfully enabled! Your account is now protected.",
  });
}
