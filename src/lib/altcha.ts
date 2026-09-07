/**
 * ALTCHA Proof-of-Work (PoW) CAPTCHA Alternative
 * Specification: https://altcha.org/docs/website-integration/
 *
 * 100% Free, Self-Hosted, Zero Third-Party Dependencies,
 * Zero Cookies, Privacy-First, and runs natively in WebCrypto.
 */

import { sha256, hmacSha256 } from "./crypto";

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
 *
 * @param rawPayload - Base64 encoded JSON string or parsed AltchaPayload object
 * @param hmacKey - Server secret key that signed the challenge
 */
export async function verifyAltchaSolution({
  rawPayload,
  hmacKey,
}: {
  rawPayload: string | AltchaPayload | unknown;
  hmacKey: string;
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

  // 2. Verify HMAC signature to guarantee the challenge was created by our server
  const expectedSignature = await hmacSha256(challenge, hmacKey);
  if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
    return { ok: false, error: "ALTCHA signature mismatch or tampered challenge." };
  }

  // 3. Verify Proof-of-Work: SHA-256(salt + number) === challenge
  const computedChallenge = await sha256(`${salt}${number}`);
  if (computedChallenge.toLowerCase() !== challenge.toLowerCase()) {
    return { ok: false, error: "ALTCHA Proof-of-Work verification failed." };
  }

  return { ok: true };
}
