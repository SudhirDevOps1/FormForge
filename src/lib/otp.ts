import type { AppDb } from "@/db";
import { otpCodes } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { randomToken } from "./crypto";

async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSecureCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return code.toString();
}

export async function createOtp(
  db: AppDb,
  formId: string,
  email: string
): Promise<{ code: string; expiresAt: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const code = generateSecureCode();
  const codeHash = await sha256Hex(`${formId}:${normalizedEmail}:${code}`);
  const id = crypto.randomUUID();

  // 10 minutes expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await db.insert(otpCodes).values({
    id,
    formId,
    email: normalizedEmail,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  return { code, expiresAt };
}

export async function verifyOtp(
  db: AppDb,
  formId: string,
  email: string,
  codeOrToken: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmed = codeOrToken.trim();
  const nowIso = new Date().toISOString();

  // Find unverified OTP / token records for this form and email
  const records = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.formId, formId),
        eq(otpCodes.email, normalizedEmail),
        isNull(otpCodes.verifiedAt)
      )
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(10);

  if (!records.length) {
    return { success: false, error: "No active verification code or link found for this email." };
  }

  const expectedHash = await sha256Hex(`${formId}:${normalizedEmail}:${trimmed}`);
  const matched = records.find((r) => r.codeHash === expectedHash);

  if (!matched) {
    // Increment attempts on latest record to prevent brute-force attacks
    await db
      .update(otpCodes)
      .set({ attempts: records[0].attempts + 1 })
      .where(eq(otpCodes.id, records[0].id));
    return { success: false, error: "Incorrect verification code. Please check your latest email or click 'Resend Code'." };
  }

  if (new Date(matched.expiresAt).getTime() < Date.now()) {
    return { success: false, error: "Verification code or magic link has expired. Please request a new one." };
  }

  if (matched.attempts >= 5) {
    return { success: false, error: "Too many failed attempts. Please request a new code or magic link." };
  }

  // Mark verified
  await db
    .update(otpCodes)
    .set({ verifiedAt: nowIso })
    .where(eq(otpCodes.id, matched.id));

  return { success: true };
}

export async function isEmailVerifiedForForm(
  db: AppDb,
  formId: string,
  email: string
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const records = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.formId, formId),
        eq(otpCodes.email, normalizedEmail),
        isNotNull(otpCodes.verifiedAt),
        gte(otpCodes.verifiedAt, fifteenMinutesAgo)
      )
    )
    .limit(1);

  return records.length > 0;
}

export async function createPasswordResetOtp(
  db: AppDb,
  email: string
): Promise<{ code: string; token: string; expiresAt: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const code = generateSecureCode();
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const codeHash = await sha256Hex(`__password_reset__:${normalizedEmail}:${code}`);
  const tokenHash = await sha256Hex(`__password_reset__:${normalizedEmail}:${token}`);

  await db.insert(otpCodes).values([
    {
      id: crypto.randomUUID(),
      formId: "__password_reset__",
      email: normalizedEmail,
      codeHash,
      expiresAt,
      attempts: 0,
    },
    {
      id: crypto.randomUUID(),
      formId: "__password_reset__",
      email: normalizedEmail,
      codeHash: tokenHash,
      expiresAt,
      attempts: 0,
    },
  ]);

  return { code, token, expiresAt };
}

export async function verifyPasswordResetOtp(
  db: AppDb,
  email: string,
  codeOrToken: string
): Promise<{ success: boolean; error?: string }> {
  return verifyOtp(db, "__password_reset__", email, codeOrToken);
}

export async function createMagicLoginToken(
  db: AppDb,
  email: string
): Promise<{ token: string; expiresAt: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const tokenHash = await sha256Hex(`__magic_login__:${normalizedEmail}:${token}`);

  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    formId: "__magic_login__",
    email: normalizedEmail,
    codeHash: tokenHash,
    expiresAt,
    attempts: 0,
  });

  return { token, expiresAt };
}

export async function verifyMagicLoginToken(
  db: AppDb,
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  return verifyOtp(db, "__magic_login__", email, token);
}

