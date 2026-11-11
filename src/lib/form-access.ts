/**
 * Shared ownership guard for per-form API routes.
 *
 * Every route that touches a form's configuration must prove the caller owns
 * that form. The guard centralises the check so a new route cannot forget it:
 * the caller either receives the database handle, the authenticated user and
 * the form row — or an already-built error response.
 */

import { and, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady, type AppDb } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms } from "@/db/schema";
import { getCurrentUser } from "./auth";
import { jsonError } from "./http";

export type OwnedFormResult =
  | { response: Response }
  | {
      db: AppDb;
      user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
      form: typeof forms.$inferSelect;
    };

/**
 * Resolve a form the caller owns.
 *
 * Returns a `Response` on every failure path so the route can simply
 * `return result.response` without repeating error handling.
 */
export async function requireOwnedForm(request: Request, formId: string): Promise<OwnedFormResult> {
  const db = getDb();
  if (!isDbReady(db)) {
    return { response: databaseUnavailableResponse() };
  }

  try {
    await ensureSchema(db);
  } catch {
    return { response: jsonError("DB_ERROR", "Failed to initialize schema.", 500) };
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return { response: jsonError("UNAUTHENTICATED", "Sign in to manage this form.", 401) };
  }

  try {
    const rows = await db
      .select()
      .from(forms)
      .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
      .limit(1);

    if (!rows[0]) {
      return { response: jsonError("FORM_NOT_FOUND", "Form not found.", 404) };
    }

    return { db, user, form: rows[0] };
  } catch {
    return { response: jsonError("DB_ERROR", "Database query failed.", 500) };
  }
}

/** Strip secrets that must never leave the server. */
export function redactFormSecrets<T extends Record<string, unknown>>(form: T): T {
  const clone = { ...form } as Record<string, unknown>;
  if (clone.smtpPass) clone.smtpPass = "__SMTP_PASSWORD_SET__";
  if (clone.passwordHash) clone.passwordHash = "__PASSWORD_SET__";
  return clone as T;
}
