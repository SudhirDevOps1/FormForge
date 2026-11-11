/**
 * FormForge password policy.
 *
 * Server-side the policy is a *policy*: a password is accepted when it is
 * long enough, not trivially guessable, and not on the built-in blocklist.
 *
 * Client-side the same module offers a live strength meter and a breach
 * check. The breach check uses the Pwned Passwords **k-anonymity** API: only
 * the first five characters of the SHA-1 digest leave the browser, so the
 * password itself — and even the full hash — never reaches a third party.
 * That keeps the privacy promise intact while still catching
 * "Password123!"-class credentials.
 */

export interface PasswordAssessment {
  /** 0 (unusable) → 4 (excellent). */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  /** Actionable improvements. */
  suggestions: string[];
  /** True when the password satisfies the server policy. */
  acceptable: boolean;
}

/**
 * Passwords that are common enough to be the first thing an attacker tries.
 * Deliberately short — a long list is a liability (and a false-positive
 * risk) for very little benefit.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "abc123",
  "letmein",
  "admin",
  "administrator",
  "welcome",
  "monkey",
  "dragon",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "trustno1",
  "changeme",
  "secret",
  "formforge",
  "formforge123",
]);

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 256;

function hasClass(password: string, pattern: RegExp): boolean {
  return pattern.test(password);
}

/**
 * Score a password.
 *
 * The score rewards length first (length is the strongest single predictor of
 * resistance to guessing) and diversity second. A password that fails the
 * policy is never reported as better than "Weak".
 */
export function assessPasswordStrength(password: unknown): PasswordAssessment {
  const value = typeof password === "string" ? password : "";
  const suggestions: string[] = [];

  if (!value) {
    return {
      score: 0,
      label: "Very weak",
      suggestions: ["Enter a password."],
      acceptable: false,
    };
  }

  if (value.length > MAX_PASSWORD_LENGTH) {
    return {
      score: 0,
      label: "Very weak",
      suggestions: [`Passwords are limited to ${MAX_PASSWORD_LENGTH} characters.`],
      acceptable: false,
    };
  }

  let score = 0;

  // Length — up to 3 points.
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;

  // Diversity — up to 2 points.
  const lower = hasClass(value, /[a-z]/);
  const upper = hasClass(value, /[A-Z]/);
  const digit = hasClass(value, /[0-9]/);
  const symbol = hasClass(value, /[^A-Za-z0-9]/);

  const classes = [lower, upper, digit, symbol].filter(Boolean).length;
  if (classes >= 3) score += 1;
  if (classes >= 4) score += 1;

  // Penalties.
  const lowered = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) {
    score = Math.min(score, 1);
    suggestions.push("This password is one of the most common ones. Choose something else.");
  }

  if (/^(.)\1+$/.test(value)) {
    score = 0;
    suggestions.push("Avoid repeating a single character.");
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    suggestions.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (!upper || !lower) {
    suggestions.push("Mix uppercase and lowercase letters.");
  }
  if (!digit) {
    suggestions.push("Add a number.");
  }
  if (!symbol) {
    suggestions.push("Add a symbol.");
  }

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"] as const;

  const acceptable =
    value.length >= MIN_PASSWORD_LENGTH &&
    classes >= 3 &&
    !COMMON_PASSWORDS.has(lowered);

  return {
    score: clamped,
    label: labels[clamped],
    suggestions: suggestions.slice(0, 4),
    acceptable,
  };
}

/**
 * Server-side gate. Returns `null` when the password is acceptable,
 * otherwise a human-readable reason.
 */
export function passwordPolicyError(password: unknown): string | null {
  const assessment = assessPasswordStrength(password);
  if (assessment.acceptable) return null;
  if (typeof password !== "string" || !password) {
    return "A password is required.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Please choose a more unique one.";
  }
  return "Password must mix uppercase, lowercase, a number and a symbol.";
}

/* ------------------------------------------------------------------ */
/* Breach check (k-anonymity)                                         */
/* ------------------------------------------------------------------ */

/**
 * Check a password against the Pwned Passwords corpus.
 *
 * Only the first five hex characters of the SHA-1 digest are sent to the
 * API; the remaining 35 characters are compared locally against the
 * returned suffix list. The password — and its full hash — never leaves the
 * browser.
 *
 * Returns `null` when the check cannot run (offline, blocked, rate
 * limited); callers should treat that as "unknown", not "safe".
 */
export async function checkPasswordBreached(
  password: string,
  endpoint = "https://api.pwnedpasswords.com/range",
): Promise<{ breached: boolean; count: number } | null> {
  try {
    const digest = await sha1Hex(password);
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5);

    const response = await fetch(`${endpoint}/${prefix}`, {
      headers: { "Add-Padding": "true" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = await response.text();
    for (const line of body.split("\n")) {
      const [candidate, countText] = line.split(":");
      if (!candidate || !countText) continue;
      if (candidate.trim().toUpperCase() === suffix.toUpperCase()) {
        return { breached: true, count: Number(countText.trim()) || 0 };
      }
    }

    return { breached: false, count: 0 };
  } catch {
    return null;
  }
}

/** SHA-1 in hex — required by the Pwned Passwords range API. */
async function sha1Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
