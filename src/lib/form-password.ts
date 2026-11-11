/**
 * Form-level password gate.
 *
 * Some forms are not public — an internal intake form, a private beta
 * signup — and the owner wants a shared password before the form renders.
 *
 * Design decisions:
 *   • The password is hashed with the *same* PBKDF2-SHA256 primitive used for
 *     account passwords (100 000 iterations, 16-byte random salt). The
 *     plaintext is never written down.
 *   • Unlocking returns a short-lived HMAC token instead of a session. The
 *     token is bound to the form id and expires, so it cannot be replayed
 *     against a different form.
 *   • Verification uses a constant-time comparison.
 */

import { hashPassword, hmacSha256, verifyPassword } from "./crypto";
import { timingSafeEqualHex } from "./security";

/** How long an unlocked form stays unlocked. */
export const FORM_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface FormTokenPayload {
  formId: string;
  expiresAt: number;
}

/**
 * Mint an unlock token for a form.
 * Format: `<expiresAtMs>.<hexHmac>` — the HMAC covers `formId:expiresAt`.
 */
export async function createFormToken(
  formId: string,
  secret: string,
  ttlMs: number = FORM_TOKEN_TTL_MS,
): Promise<string> {
  const expiresAt = Date.now() + ttlMs;
  const signature = await hmacSha256(`form:${formId}:${expiresAt}`, secret);
  return `${expiresAt}.${signature}`;
}

/**
 * Verify an unlock token.
 *
 * Returns `true` only when the signature matches *and* the token has not
 * expired. Expiry is checked after the signature so a forged token cannot be
 * distinguished from an expired one by timing.
 */
export async function verifyFormToken(
  token: string,
  formId: string,
  secret: string,
): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;

  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiresAtText = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d{10,}$/.test(expiresAtText)) return false;

  const expected = await hmacSha256(`form:${formId}:${expiresAtText}`, secret);
  if (!timingSafeEqualHex(expected, signature)) return false;

  return Number(expiresAtText) > Date.now();
}

/** Hash a form password with the account-password primitive. */
export async function hashFormPassword(password: string): Promise<string> {
  return hashPassword(password);
}

/** Verify a form password in constant time. */
export async function verifyFormPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;
  return verifyPassword(password, storedHash);
}

/**
 * Minimum password policy for a form gate.
 * Deliberately mild — this is a shared access code, not an account password.
 */
export function validateFormPassword(password: unknown): { ok: boolean; error?: string } {
  if (typeof password !== "string" || !password) {
    return { ok: false, error: "A password is required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Use at least 8 characters." };
  }
  if (password.length > 256) {
    return { ok: false, error: "Passwords are limited to 256 characters." };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9\W]/.test(password)) {
    return { ok: false, error: "Mix letters with at least one number or symbol." };
  }
  return { ok: true };
}
