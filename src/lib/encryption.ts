/**
 * FormForge encryption helpers.
 *
 * Two jobs, one primitive:
 *
 *  1. **Secrets at rest** — SMTP passwords, Telegram tokens, GAS secrets and
 *     webhook secrets are stored encrypted so a database dump never reveals
 *     them.
 *  2. **Submission payloads at rest** — opt-in per form. The payload holds
 *     the highest-value PII in the product (names, messages, phone numbers,
 *     addresses), so a deployment that wants it unreadable can seal it with
 *     AES-256-GCM.
 *
 * The AES-256-GCM key is derived from `AUTH_SECRET`, so there is no second
 * key to manage and no key-rotation story to get wrong.
 */

/**
 * Versioned envelope for an encrypted submission payload.
 *
 * The prefix makes the format self-describing: a reader can tell an
 * encrypted payload from a legacy plaintext one without consulting the form
 * configuration, which means turning encryption on or off never orphans
 * existing rows.
 */
export const ENCRYPTED_PAYLOAD_PREFIX = "ffenc:v1:";

/**
 * Resolve the application secret used to derive the AES key.
 *
 * The Cloudflare Worker binding is read through the runtime environment
 * helper, which is loaded lazily. The lazy load keeps this module free of a
 * static dependency on the database layer, so it can also be used by
 * standalone tooling (the feature test suite) where no Worker context
 * exists. When the helper cannot be loaded, `process.env.AUTH_SECRET` is
 * used instead.
 */
async function resolveSecret(): Promise<string> {
  try {
    const { getRuntimeEnv } = await import("@/db");
    const secret = getRuntimeEnv().AUTH_SECRET;
    if (secret && secret.trim()) return secret;
  } catch {
    // No Worker runtime available (local tooling, unit tests).
  }

  const fromEnv =
    typeof process !== "undefined" ? process.env?.AUTH_SECRET : undefined;

  return fromEnv && fromEnv.trim()
    ? fromEnv
    : "default-secret-key-change-in-prod";
}

/** Derive the 256-bit AES key from the application secret. */
async function deriveKey(): Promise<CryptoKey> {
  const secret = await resolveSecret();
  const encoder = new TextEncoder();
  const rawKey = encoder.encode(secret.padEnd(32, "0").slice(0, 32));

  return crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt bytes and return `iv || ciphertext`. */
async function sealBytes(plainBytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    plainBytes,
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);
  return combined;
}

/** Reverse of `sealBytes`. Throws when the ciphertext fails authentication. */
async function openBytes(sealed: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await deriveKey();
  const iv = sealed.slice(0, 12);
  const data = sealed.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new Uint8Array(decrypted);
}

/** Base64-encode bytes without blowing the argument limit on large payloads. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/** Decode base64 into bytes. */
function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binaryString = atob(value);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }
  return bytes;
}

/**
 * Encrypts plain text using AES-GCM and the application's AUTH_SECRET.
 */
export async function encryptText(text: string): Promise<string> {
  if (!text) return "";
  const sealed = await sealBytes(new TextEncoder().encode(text));
  return bytesToBase64(sealed);
}

/**
 * Decrypts encrypted base64 text using AES-GCM and the application's AUTH_SECRET.
 */
export async function decryptText(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64) return "";
  try {
    const decrypted = await openBytes(base64ToBytes(encryptedBase64));
    return new TextDecoder().decode(decrypted);
  } catch {
    console.error("Decryption failed.");
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Submission payload encryption                                      */
/* ------------------------------------------------------------------ */

/** True when a stored payload uses the encrypted envelope. */
export function isEncryptedPayload(stored: unknown): boolean {
  return typeof stored === "string" && stored.startsWith(ENCRYPTED_PAYLOAD_PREFIX);
}

/**
 * Encrypt a submission payload for storage at rest.
 *
 * The envelope is self-describing, so a database that mixes encrypted and
 * plaintext rows (encryption was turned on part-way through) stays readable.
 */
export async function encryptPayload(plainText: string): Promise<string> {
  if (!plainText) return "";
  if (isEncryptedPayload(plainText)) return plainText;

  const sealed = await sealBytes(new TextEncoder().encode(plainText));
  return `${ENCRYPTED_PAYLOAD_PREFIX}${bytesToBase64(sealed)}`;
}

/**
 * Decrypt a stored payload if it is encrypted.
 *
 * A plaintext payload is returned unchanged, which keeps every read path
 * working for databases that were created before encryption was enabled.
 * A payload that cannot be decrypted (for example the `AUTH_SECRET` was
 * rotated) returns a readable placeholder rather than throwing, so one
 * unreadable row can never break an entire export.
 */
export async function decryptPayload(stored: string): Promise<string> {
  if (!stored) return "";
  if (!isEncryptedPayload(stored)) return stored;

  try {
    const decrypted = await openBytes(
      base64ToBytes(stored.slice(ENCRYPTED_PAYLOAD_PREFIX.length)),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return '{"_error":"payload could not be decrypted"}';
  }
}

/**
 * Decrypt a stored payload and parse it.
 * Falls back to an empty object when the payload is unreadable.
 */
export async function decryptPayloadJson(
  stored: string,
): Promise<Record<string, unknown>> {
  const plain = await decryptPayload(stored);
  if (!plain) return {};
  try {
    const parsed = JSON.parse(plain);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
