/**
 * FormForge Native WebCrypto TOTP Engine (RFC 6238 / RFC 4226)
 *
 * Zero-dependency Two-Factor Authentication implementation running natively
 * on Cloudflare Workers, Node.js, and Vercel edge runtimes.
 *
 * Compatible with:
 * - Google Authenticator
 * - Apple Passwords & iOS Keychain
 * - Microsoft Authenticator
 * - 1Password, Bitwarden, Authy
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encode a Uint8Array buffer into a standard Base32 string (without padding).
 */
export function base32Encode(buffer: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decode a Base32 string into a Uint8Array buffer.
 */
export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/[\s-]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

/**
 * Generate a cryptographically secure random 20-byte Base32 TOTP secret.
 */
export function generateTotpSecret(numBytes = 20): string {
  const bytes = new Uint8Array(numBytes);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * Format a Base32 secret for user-friendly display in groups of 4:
 * e.g. "ABCD EFGH JKLM NO12"
 */
export function formatSecretForDisplay(secret: string): string {
  const clean = secret.replace(/\s+/g, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

/**
 * Generate an otpauth:// URI for QR code generators and authenticator apps.
 */
export function getTotpAuthUri(secret: string, accountName: string, issuer = "FormForge"): string {
  const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  return `otpauth://totp/${label}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Compute the 6-digit TOTP code for a given 30-second time counter.
 */
async function computeCodeForCounter(secretKey: CryptoKey, counter: number): Promise<string> {
  const counterBuffer = new ArrayBuffer(8);
  const dataView = new DataView(counterBuffer);
  dataView.setBigUint64(0, BigInt(counter));

  const signature = await crypto.subtle.sign("HMAC", secretKey, counterBuffer);
  const hash = new Uint8Array(signature);

  const offset = hash[19] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = (binary % 1_000_000).toString().padStart(6, "0");
  return otp;
}

/**
 * Generate the current 6-digit TOTP code for a given Base32 secret.
 */
export async function generateTotpCode(secretBase32: string, timeOffsetSeconds = 0): Promise<string> {
  const keyBytes = base32Decode(secretBase32);
  const secretKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const epochSeconds = Math.floor(Date.now() / 1000) + timeOffsetSeconds;
  const counter = Math.floor(epochSeconds / 30);
  return computeCodeForCounter(secretKey, counter);
}

/**
 * Timing-safe string comparison for 6-digit OTP codes.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a user-provided 6-digit code against a Base32 secret.
 * Checks the current 30s window and optionally ±1 window to tolerate clock drift.
 */
export async function verifyTotpCode(
  secretBase32: string,
  userCode: string,
  windowToleranceSteps = 1
): Promise<boolean> {
  const normalizedCode = userCode.trim().replace(/\D/g, "");
  if (normalizedCode.length !== 6) return false;

  const keyBytes = base32Decode(secretBase32);
  if (keyBytes.length === 0) return false;

  try {
    const secretKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );

    const currentCounter = Math.floor(Math.floor(Date.now() / 1000) / 30);

    for (let step = -windowToleranceSteps; step <= windowToleranceSteps; step++) {
      const expectedCode = await computeCodeForCounter(secretKey, currentCounter + step);
      if (timingSafeEqual(normalizedCode, expectedCode)) {
        return true;
      }
    }
  } catch (err) {
    console.error("TOTP verification error:", err);
    return false;
  }

  return false;
}
