import { eq, sql } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions, type Form, type NewSubmission } from "@/db/schema";
import { randomId, safeStringify, sha256 } from "@/lib/crypto";
import { corsHeaders, jsonError, resolveAllowedOrigin } from "@/lib/http";
import { deliverNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ endpointId: string }> };

type ParsedSubmission = Record<string, unknown>;

async function getForm(endpointId: string): Promise<Form | null> {
  const db = getDb();
  if (!isDbReady(db)) {
    return null;
  }

  const rows = await db.select().from(forms).where(eq(forms.endpointId, endpointId)).limit(1);
  return rows[0] ?? null;
}

async function parsePayload(request: Request): Promise<ParsedSubmission> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as unknown;
      return body && typeof body === "object" && !Array.isArray(body) ? (body as ParsedSubmission) : {};
    } catch {
      return {};
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    return Object.fromEntries(new URLSearchParams(text).entries());
  }

  const formData = await request.formData();
  const payload: ParsedSubmission = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      payload[key] = { name: value.name, size: value.size, type: value.type };
    } else if (payload[key] !== undefined) {
      payload[key] = Array.isArray(payload[key]) ? [...payload[key], value] : [payload[key], value];
    } else {
      payload[key] = value;
    }
  }

  return payload;
}

function findEmail(payload: ParsedSubmission): string | undefined {
  for (const key of ["email", "Email", "reply_to", "replyTo"]) {
    const value = payload[key];
    if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      return value.trim().toLowerCase();
    }
  }
  return undefined;
}

async function calculateSpamScore(form: Form, payload: ParsedSubmission, request: Request) {
  const reasons: string[] = [];
  let score = 0;

  if (typeof payload[form.honeypotField] === "string" && payload[form.honeypotField]) {
    score += 100;
    reasons.push("honeypot_filled");
  }

  // Custom Spam Words Blocklist
  if (form.spamBlocklist) {
    const blocklistedWords = form.spamBlocklist.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
    const contentToScan = safeStringify(payload).toLowerCase();
    const hit = blocklistedWords.find((w) => contentToScan.includes(w));
    if (hit) {
      score += 100;
      reasons.push(`blocklisted_word_detected: ${hit}`);
    }
  }

  const serialized = safeStringify(payload);
  if (serialized.length > 64_000) {
    score += 40;
    reasons.push("payload_too_large");
  }

  if (!request.headers.get("user-agent")) {
    score += 10;
    reasons.push("missing_user_agent");
  }

  const powNonce = request.headers.get("x-formforge-pow") ?? (typeof payload._ff_pow === "string" ? payload._ff_pow : "");
  if (form.requireProofOfWork) {
    const hash = powNonce ? await sha256(`${form.endpointId}:${powNonce}:${serialized}`) : "";
    if (!hash.startsWith("000")) {
      score += 80;
      reasons.push("proof_of_work_failed");
    }
  }

  return { score, reasons, serialized };
}

export async function OPTIONS(request: Request, context: RouteContext) {
  const { endpointId } = await context.params;
  const form = await getForm(endpointId);
  const origin = request.headers.get("origin");
  const allowedOrigin = form ? resolveAllowedOrigin(form.allowedOrigins, origin) : origin;

  return new Response(null, { headers: corsHeaders(allowedOrigin) });
}

export async function POST(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  const { endpointId } = await context.params;
  await ensureSchema(db);
  const formRows = await db.select().from(forms).where(eq(forms.endpointId, endpointId)).limit(1);
  const form = formRows[0];
  const origin = request.headers.get("origin");
  const allowedOrigin = form ? resolveAllowedOrigin(form.allowedOrigins, origin) : null;
  const cors = corsHeaders(allowedOrigin);

  if (!form || !form.isActive) {
    return new Response(JSON.stringify({ ok: false, code: "FORM_NOT_FOUND", message: "This FormForge endpoint is not active." }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (origin && !allowedOrigin) {
    return new Response(JSON.stringify({ ok: false, code: "ORIGIN_BLOCKED", message: "Origin is not allowed." }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Rate Limiting
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { checkRateLimit, rateLimitResponse } = await import("@/lib/rate-limit");
  const limitRes = await checkRateLimit(db, `submit:${form.id}:${ip}`, 60, 60); // 60 submissions per min
  if (!limitRes.allowed) {
    return new Response(JSON.stringify({ ok: false, code: "RATE_LIMITED", message: "Too many submissions. Please try again later." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.ceil((new Date(limitRes.resetAt).getTime() - Date.now()) / 1000)) }
    });
  }

  // Check payload size using Content-Length header or streaming check
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLength > 65536) {
    return new Response(JSON.stringify({ ok: false, code: "PAYLOAD_TOO_LARGE", message: "Payload size exceeds 64KB limit." }), {
      status: 413,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload: ParsedSubmission;
  try {
    payload = await parsePayload(request);
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, code: "BAD_REQUEST", message: "Invalid payload formatting." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Turnstile Verification
  if (form.turnstileEnabled && form.turnstileSecretKey) {
    const token = (payload["cf-turnstile-response"] as string) || 
                  (payload["g-recaptcha-response"] as string) || 
                  request.headers.get("x-cf-turnstile-response") || 
                  request.headers.get("x-turnstile-response");

    if (!token) {
      return new Response(JSON.stringify({ ok: false, code: "TURNSTILE_REQUIRED", message: "Turnstile spam verification token is missing." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    try {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(form.turnstileSecretKey)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip)}`,
      });
      const verifyData = await verifyRes.json() as { success: boolean };
      if (!verifyData.success) {
        return new Response(JSON.stringify({ ok: false, code: "TURNSTILE_FAILED", message: "Turnstile spam verification failed." }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, code: "TURNSTILE_ERROR", message: "Error verifying Turnstile token." }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  const { score, reasons, serialized } = await calculateSpamScore(form, payload, request);
  const status = score >= 80 ? "spam" : "accepted";
  const submission: NewSubmission = {
    id: randomId("sub"),
    formId: form.id,
    payload: serialized,
    email: findEmail(payload),
    ipHash: form.storeIpHash && ip ? await sha256(`${form.id}:${ip}`) : undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    referer: request.headers.get("referer") ?? undefined,
    status,
    spamScore: score,
    spamReasons: JSON.stringify(reasons),
    createdAt: new Date().toISOString(),
  };

  try {
    await db.insert(submissions).values(submission);
    await db.update(forms).set({ submissionsCount: sql`${forms.submissionsCount} + 1`, updatedAt: new Date().toISOString() }).where(eq(forms.id, form.id));

    if (status === "accepted") {
      await deliverNotifications(db, form, submission as typeof submissions.$inferSelect);
    }

    if (form.redirectUrl && request.headers.get("accept")?.includes("text/html")) {
      const { isSafeRedirectUrl } = await import("@/lib/url-validation");
      if (isSafeRedirectUrl(form.redirectUrl)) {
        return Response.redirect(form.redirectUrl, 303);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, message: form.successMessage, submissionId: submission.id, status }),
      { status: 202, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, code: "INTERNAL_ERROR", message: "An error occurred while saving the submission." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
