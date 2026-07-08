import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { AUTH_SECRET_HELP, createSession, isAuthConfigured } from "@/lib/auth";
import { hashPassword, randomId } from "@/lib/crypto";
import { jsonError, jsonOk, normalizeEmail, readJson, readString } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);

  if (!isAuthConfigured()) {
    return jsonError("AUTH_SECRET_MISSING", AUTH_SECRET_HELP, 503);
  }

  // Get client IP for rate limiting
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
  
  // Import checkRateLimit dynamically
  const { checkRateLimit, rateLimitResponse } = await import("@/lib/rate-limit");
  const limitRes = await checkRateLimit(db, `register:${ip}`, 30, 60); // 30 per minute (prevent block during DB setup)
  if (!limitRes.allowed) {
    return rateLimitResponse(limitRes.resetAt);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = readString(body.password);
  const name = readString(body.name, email?.split("@")[0] ?? "Owner");

  if (!email) {
    return jsonError("INVALID_EMAIL", "A valid email address is required.");
  }

  if (password.length < 10) {
    return jsonError("WEAK_PASSWORD", "Password must be at least 10 characters.");
  }

  if (password.length > 128) {
    return jsonError("WEAK_PASSWORD", "Password must not exceed 128 characters.");
  }

  try {
    // Check if registration is allowed (only first user, or if explicit override)
    const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
    if (existingUsers.length > 0) {
      return jsonError("REGISTRATION_DISABLED", "Registration is closed. An owner has already been set up.", 403);
    }

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return jsonError("EMAIL_EXISTS", "An account already exists for this email.", 409);
    }

    const userId = randomId("user");
    await db.insert(users).values({
      id: userId,
      email,
      name: name || "Owner",
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });

    const session = await createSession(db, userId);
    if (!session) {
      return jsonError("AUTH_SECRET_MISSING", "Set AUTH_SECRET before creating sessions.", 503);
    }

    return jsonOk(
      { user: { id: userId, email, name: name || "Owner", role: "owner" } },
      { headers: { "Set-Cookie": session.cookie }, status: 201 },
    );
  } catch (error) {
    return jsonError("DB_ERROR", "An error occurred while saving user data.", 500);
  }
}
