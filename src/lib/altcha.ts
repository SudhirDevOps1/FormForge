/**
 * ALTCHA Proof-of-Work (PoW) CAPTCHA Alternative
 * Specification: https://altcha.org/docs/website-integration/
 *
 * 100% Free, Self-Hosted, Zero Third-Party Dependencies,
 * Zero Cookies, Privacy-First, and runs natively in WebCrypto.
 */

import { sha256, hmacSha256 } from "./crypto";

import { timingSafeEqualHex } from "./security";
import type { AppDb } from "@/db";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

export interface AltchaPayload {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
}

/**
 * Generates an ALTCHA challenge.
 *
 * @param hmacKey - Server secret key (e.g. AUTH_SECRET)
 * @param maxNumber - Maximum difficulty (default: 50,000 for ~0.2s - 0.5s client solve time)
 * @param expiresSeconds - Expiration time for this challenge (default: 15 minutes)
 */
export async function createAltchaChallenge({
  hmacKey,
  maxNumber = 50_000,
  expiresSeconds = 900,
}: {
  hmacKey: string;
  maxNumber?: number;
  expiresSeconds?: number;
}): Promise<AltchaChallenge> {
  const expiresAt = Date.now() + expiresSeconds * 1000;
  // Generate random salt combined with expiration timestamp for stateless freshness check
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const salt = `${expiresAt}_${randomHex}`;

  // Random secret number between 0 and maxNumber
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  const number = randomArray[0] % maxNumber;

  // Challenge is SHA-256(salt + number)
  const challenge = await sha256(`${salt}${number}`);

  // Signature is HMAC-SHA256(challenge, hmacKey)
  const signature = await hmacSha256(challenge, hmacKey);

  return {
    algorithm: "SHA-256",
    challenge,
    maxnumber: maxNumber,
    salt,
    signature,
  };
}

/**
 * Verifies an ALTCHA solution submitted by the client.
 * Includes constant-time HMAC comparison and anti-replay protection.
 *
 * @param rawPayload - Base64 encoded JSON string or parsed AltchaPayload object
 * @param hmacKey - Server secret key that signed the challenge
 * @param db - Optional database instance for anti-replay tracking
 */
export async function verifyAltchaSolution({
  rawPayload,
  hmacKey,
  db,
}: {
  rawPayload: string | AltchaPayload | unknown;
  hmacKey: string;
  db?: AppDb;
}): Promise<{ ok: boolean; error?: string }> {
  let payload: AltchaPayload;

  try {
    if (typeof rawPayload === "string") {
      // Decode base64 or URL-safe base64 string
      const normalized = rawPayload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(normalized);
      payload = JSON.parse(decoded) as AltchaPayload;
    } else if (typeof rawPayload === "object" && rawPayload !== null) {
      payload = rawPayload as AltchaPayload;
    } else {
      return { ok: false, error: "Invalid ALTCHA payload format." };
    }
  } catch {
    return { ok: false, error: "Failed to parse ALTCHA payload." };
  }

  const { algorithm, challenge, number, salt, signature } = payload;

  if (algorithm !== "SHA-256") {
    return { ok: false, error: `Unsupported ALTCHA algorithm: ${algorithm}` };
  }

  if (!challenge || typeof challenge !== "string" || !salt || typeof salt !== "string" || !signature) {
    return { ok: false, error: "Missing required ALTCHA challenge parameters." };
  }

  if (typeof number !== "number" || !Number.isInteger(number) || number < 0) {
    return { ok: false, error: "Invalid ALTCHA proof-of-work solution number." };
  }

  // 1. Verify expiration from salt timestamp (${expiresAt}_${randomHex})
  const saltParts = salt.split("_");
  const expiresAt = Number(saltParts[0]);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return { ok: false, error: "ALTCHA challenge has expired. Please refresh and try again." };
  }

  // 2. Verify HMAC signature using timing-safe comparison to prevent timing oracles
  const expectedSignature = await hmacSha256(challenge, hmacKey);
  if (!timingSafeEqualHex(signature, expectedSignature)) {
    return { ok: false, error: "ALTCHA signature mismatch or tampered challenge." };
  }

  // 3. Verify Proof-of-Work: SHA-256(salt + number) === challenge
  const computedChallenge = await sha256(`${salt}${number}`);
  if (!timingSafeEqualHex(computedChallenge, challenge)) {
    return { ok: false, error: "ALTCHA Proof-of-Work verification failed." };
  }

  // 4. Anti-Replay Protection: Ensure this solution cannot be reused across requests
  if (db) {
    try {
      const replayKey = `altcha_replay:${signature}`;
      const existing = await db.select().from(rateLimits).where(eq(rateLimits.key, replayKey)).limit(1);
      const row = existing[0];
      const now = new Date();

      if (row && new Date(row.resetAt) > now) {
        return { ok: false, error: "ALTCHA challenge has already been used. Please solve a new challenge." };
      }

      // Record consumed signature with challenge expiration timestamp
      const resetAtIso = new Date(expiresAt).toISOString();
      await db.insert(rateLimits)
        .values({ key: replayKey, count: 1, resetAt: resetAtIso, updatedAt: now.toISOString() })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: { count: 1, resetAt: resetAtIso, updatedAt: now.toISOString() },
        });
    } catch (dbErr) {
      console.warn("Anti-replay database check skipped on DB warning:", dbErr);
    }
  }

  return { ok: true };
}
