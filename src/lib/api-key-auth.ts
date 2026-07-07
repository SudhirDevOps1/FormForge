import type { AppDb } from "@/db";
import { eq } from "drizzle-orm";
import { apiKeys, users } from "@/db/schema";
import { getRuntimeEnv } from "@/db";

export async function validateApiKey(db: AppDb, authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ff_")) {
    return null;
  }

  const apiKeyString = authHeader.substring(7); // Remove "Bearer "
  const prefix = apiKeyString.split(".")[0];
  if (!prefix) return null;

  try {
    const env = getRuntimeEnv();
    const authSecret = env.AUTH_SECRET;
    if (!authSecret) return null;

    // Reconstruct the key hash
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(authSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      secretKey,
      encoder.encode(apiKeyString)
    );
    
    const hashHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const rows = await db
      .select({
        apiKey: apiKeys,
        user: users,
      })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(eq(apiKeys.keyHash, hashHex))
      .limit(1);

    const match = rows[0];
    if (!match || match.apiKey.revokedAt) {
      return null;
    }

    if (match.apiKey.expiresAt && new Date(match.apiKey.expiresAt).getTime() < Date.now()) {
      return null;
    }

    // Update lastUsedAt asynchronously
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, match.apiKey.id));

    return match.user;
  } catch {
    return null;
  }
}
