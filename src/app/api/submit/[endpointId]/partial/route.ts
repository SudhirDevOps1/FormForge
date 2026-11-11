import { and, eq, gt, lt } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, partialSubmissions } from "@/db/schema";
import { randomId, randomToken, sha256 } from "@/lib/crypto";
import { corsHeaders, jsonError, jsonOk, readJson } from "@/lib/http";
import { sanitizePayload } from "@/lib/security";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ endpointId: string }> };

/** Partial submissions expire after 30 days. */
const PARTIAL_TTL_DAYS = 30;
const MAX_PARTIAL_PAYLOAD_BYTES = 32_000;
const MAX_COMPLETED_KEYS = 200;

async function getForm(endpointId: string) {
  const db = getDb();
  if (!isDbReady(db)) return { db: null, form: null };
  const rows = await db.select().from(forms).where(eq(forms.endpointId, endpointId)).limit(1);
  return { db, form: rows[0] ?? null };
}

/**
 * Save a partial submission (save & resume).
 *
 * The response contains a plaintext resume token. Only its SHA-256 hash is
 * stored, so a leaked database row cannot be turned back into a working
 * resume link.
 *
 * POST body: { payload, completedFieldKeys?, lastStep?, token? }
 */
export async function POST(request: Request, context: RouteContext) {
  const { endpointId } = await context.params;
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const { form } = await getForm(endpointId);
  if (!form || !form.isActive) {
    return jsonError("FORM_NOT_FOUND", "This FormForge endpoint is not active.", 404);
  }

  if (!form.partialSubmissionsEnabled) {
    return jsonError(
      "PARTIAL_DISABLED",
      "Partial submissions are not enabled for this form.",
      403,
    );
  }

  const body = await readJson(request);
  const rawPayload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  const serialized = JSON.stringify(rawPayload);
  if (serialized.length > MAX_PARTIAL_PAYLOAD_BYTES) {
    return jsonError("PAYLOAD_TOO_LARGE", "Partial payload exceeds the 32KB limit.", 413);
  }

  const cleanPayload = sanitizePayload(rawPayload);

  const completedRaw = Array.isArray(body.completedFieldKeys)
    ? body.completedFieldKeys.filter((k): k is string => typeof k === "string")
    : [];
  const completedFieldKeys = completedRaw.slice(0, MAX_COMPLETED_KEYS);

  const lastStep =
    typeof body.lastStep === "number" && Number.isFinite(body.lastStep)
      ? Math.max(0, Math.min(1000, Math.floor(body.lastStep)))
      : 0;

  const origin = request.headers.get("origin");
  const { resolveAllowedOrigin } = await import("@/lib/http");
  const allowedOrigin = resolveAllowedOrigin(form.allowedOrigins, origin);
  const cors = corsHeaders(allowedOrigin);

  try {
    // Resume an existing partial when a token is supplied.
    const existingToken = typeof body.token === "string" ? body.token.trim() : "";
    if (existingToken) {
      const tokenHash = await sha256(existingToken);
      const now = new Date().toISOString();

      const existing = await db
        .select()
        .from(partialSubmissions)
        .where(
          and(
            eq(partialSubmissions.tokenHash, tokenHash),
            eq(partialSubmissions.formId, form.id),
            gt(partialSubmissions.expiresAt, now),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(partialSubmissions)
          .set({
            payload: JSON.stringify(cleanPayload),
            completedFieldKeys: JSON.stringify(completedFieldKeys),
            lastStep,
            updatedAt: now,
          })
          .where(eq(partialSubmissions.id, existing[0].id));

        return jsonOk(
          {
            partialId: existing[0].id,
            resumeToken: existingToken,
            lastStep,
            savedAt: now,
          },
          { headers: cors },
        );
      }
    }

    const resumeToken = randomToken(32);
    const tokenHash = await sha256(resumeToken);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + PARTIAL_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { getClientIp } = await import("@/lib/rate-limit");
    const ip = getClientIp(request);
    const ipHash = form.storeIpHash && ip ? await sha256(`${form.id}:${ip}`) : undefined;

    const inserted = await db
      .insert(partialSubmissions)
      .values({
        id: randomId("part"),
        formId: form.id,
        tokenHash,
        payload: JSON.stringify(cleanPayload),
        completedFieldKeys: JSON.stringify(completedFieldKeys),
        lastStep,
        userAgent: request.headers.get("user-agent") ?? null,
        referer: request.headers.get("referer") ?? null,
        ipHash: ipHash ?? null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
      })
      .returning();

    return jsonOk(
      {
        partialId: inserted[0]?.id ?? null,
        resumeToken,
        lastStep,
        expiresAt,
      },
      { status: 201, headers: cors },
    );
  } catch {
    return jsonError("DB_ERROR", "An error occurred while saving the partial submission.", 500);
  }
}

/**
 * Resume a partial submission.
 *
 * GET ?token=<resume token> → returns the saved payload so the hosted form
 * can restore the respondent's progress.
 */
export async function GET(request: Request, context: RouteContext) {
  const { endpointId } = await context.params;
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const { form } = await getForm(endpointId);
  if (!form || !form.isActive) {
    return jsonError("FORM_NOT_FOUND", "This FormForge endpoint is not active.", 404);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return jsonError("MISSING_TOKEN", "Provide the resume token.", 400);
  }

  const origin = request.headers.get("origin");
  const { resolveAllowedOrigin } = await import("@/lib/http");
  const cors = corsHeaders(resolveAllowedOrigin(form.allowedOrigins, origin));

  try {
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();

    const rows = await db
      .select()
      .from(partialSubmissions)
      .where(
        and(
          eq(partialSubmissions.tokenHash, tokenHash),
          eq(partialSubmissions.formId, form.id),
          gt(partialSubmissions.expiresAt, now),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return jsonError("TOKEN_INVALID", "This resume link is invalid or has expired.", 404, {
        headers: cors,
      });
    }

    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(row.payload);
      if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
    } catch {
      payload = {};
    }

    let completedFieldKeys: string[] = [];
    try {
      const parsed = JSON.parse(row.completedFieldKeys);
      if (Array.isArray(parsed)) completedFieldKeys = parsed.filter((k) => typeof k === "string");
    } catch {
      completedFieldKeys = [];
    }

    return jsonOk(
      {
        partialId: row.id,
        payload,
        completedFieldKeys,
        lastStep: row.lastStep,
        savedAt: row.updatedAt,
        expiresAt: row.expiresAt,
        converted: Boolean(row.convertedSubmissionId),
      },
      { headers: cors },
    );
  } catch {
    return jsonError("DB_ERROR", "An error occurred while loading the partial submission.", 500);
  }
}

/**
 * Delete a partial submission (respondent abandoned the form).
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { endpointId } = await context.params;
  const db = getDb();
  if (!isDbReady(db)) return databaseUnavailableResponse();

  await ensureSchema(db);

  const { form } = await getForm(endpointId);
  if (!form) {
    return jsonError("FORM_NOT_FOUND", "This FormForge endpoint is not active.", 404);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return jsonError("MISSING_TOKEN", "Provide the resume token.", 400);
  }

  try {
    const tokenHash = await sha256(token);
    await db
      .delete(partialSubmissions)
      .where(
        and(
          eq(partialSubmissions.tokenHash, tokenHash),
          eq(partialSubmissions.formId, form.id),
        ),
      );
    return jsonOk({ deleted: true });
  } catch {
    return jsonError("DB_ERROR", "An error occurred while deleting the partial submission.", 500);
  }
}

/** Housekeeping helper used by the retention job. */
export async function purgeExpiredPartials(): Promise<number> {
  const db = getDb();
  if (!isDbReady(db)) return 0;
  const now = new Date().toISOString();
  const stale = await db
    .select({ id: partialSubmissions.id })
    .from(partialSubmissions)
    .where(lt(partialSubmissions.expiresAt, now));
  if (!stale.length) return 0;
  await db
    .delete(partialSubmissions)
    .where(lt(partialSubmissions.expiresAt, now));
  return stale.length;
}
