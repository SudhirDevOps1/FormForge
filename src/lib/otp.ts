import type { AppDb } from "@/db";
import { otpCodes } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";

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
  code: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  // Find latest unverified OTP for this email
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
    .limit(1);

  if (!records.length) {
    return { success: false, error: "No active OTP request found for this email." };
  }

  const otpRecord = records[0];

  if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
    return { success: false, error: "OTP has expired. Please request a new code." };
  }

  if (otpRecord.attempts >= 5) {
    return { success: false, error: "Too many failed attempts. Please request a new code." };
  }

  const expectedHash = await sha256Hex(`${formId}:${normalizedEmail}:${code.trim()}`);

  if (expectedHash !== otpRecord.codeHash) {
    // Increment attempts
    await db
      .update(otpCodes)
      .set({ attempts: otpRecord.attempts + 1 })
      .where(eq(otpCodes.id, otpRecord.id));
    return { success: false, error: "Invalid OTP code. Please try again." };
  }

  // Mark verified
  await db
    .update(otpCodes)
    .set({ verifiedAt: nowIso })
    .where(eq(otpCodes.id, otpRecord.id));

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
): Promise<{ code: string; expiresAt: string }> {
  return createOtp(db, "__password_reset__", email);
}

export async function verifyPasswordResetOtp(
  db: AppDb,
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  return verifyOtp(db, "__password_reset__", email, code);
}

