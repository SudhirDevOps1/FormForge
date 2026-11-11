/**
 * FormForge duplicate detection.
 *
 * Submissions are fingerprinted on a canonical, order-independent
 * representation of their payload. Identical answers produce an identical
 * fingerprint, which lets the dashboard flag a repeat instead of silently
 * inflating the response count.
 *
 * Privacy note: the fingerprint is a salted hash, never the raw payload, so
 * the database column cannot be used to recover answers.
 */

import { sha256 } from "./crypto";

/** Keys that are never part of a fingerprint (transient or server-injected). */
const IGNORED_KEYS = new Set([
  "_intent",
  "_ff_pow",
  "altcha",
  "altcha-response",
  "_next",
  "_redirect",
  "next",
  "website",
]);

/**
 * Build a canonical string from a payload.
 *
 * Keys are sorted so field ordering never affects the result, and values are
 * stringified in a stable way so `{a:1}` and `{"1"}` both hash alike.
 */
export function canonicalizePayload(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload)
    .filter(([key]) => !IGNORED_KEYS.has(key))
    .map(([key, value]) => {
      let normalized: string;
      if (value === null || value === undefined) {
        normalized = "";
      } else if (Array.isArray(value)) {
        normalized = value
          .map((entry) => (entry && typeof entry === "object" ? JSON.stringify(entry) : String(entry)))
          .sort()
          .join("|");
      } else if (typeof value === "object") {
        try {
          normalized = JSON.stringify(value);
        } catch {
          normalized = String(value);
        }
      } else {
        normalized = String(value).trim();
      }
      return `${key.toLowerCase()}=${normalized.toLowerCase()}`;
    })
    .sort();

  return entries.join("&");
}

/**
 * Compute the fingerprint for a submission.
 *
 * The salt scopes the hash to the form, so the same answers on two different
 * forms produce different fingerprints and cross-form correlation is not
 * possible.
 */
export async function fingerprintPayload(
  payload: Record<string, unknown>,
  formId: string,
  salt: string,
): Promise<string> {
  const canonical = canonicalizePayload(payload);
  return sha256(`${salt}:${formId}:${canonical}`);
}

/**
 * Heuristic: a payload with no meaningful content should never be treated as
 * a duplicate of an empty one.
 */
export function hasFingerprintableContent(payload: Record<string, unknown>): boolean {
  return canonicalizePayload(payload)
    .split("&")
    .some((pair) => {
      const [, value = ""] = pair.split("=");
      return value.trim().length > 0;
    });
}
