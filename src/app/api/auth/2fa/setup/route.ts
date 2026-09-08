import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { formatSecretForDisplay, generateTotpSecret, getTotpAuthUri } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);
  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to setup 2FA.", 401);
  }

  // Generate fresh Base32 TOTP secret
  const secret = generateTotpSecret(20);
  const formattedSecret = formatSecretForDisplay(secret);
  const otpauthUri = getTotpAuthUri(secret, user.email, "FormForge");

  // Save pending secret (totpEnabled remains false until verified)
  await db
    .update(users)
    .set({
      totpSecret: secret,
      totpEnabled: false,
    })
    .where(eq(users.id, user.id));

  return jsonOk({
    secret,
    formattedSecret,
    otpauthUri,
    account: user.email,
    issuer: "FormForge",
  });
}
