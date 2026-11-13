import { and, eq, lt, sql } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions, type Form, type NewSubmission } from "@/db/schema";
import { randomId, safeStringify, sha256 } from "@/lib/crypto";
import { encryptPayload } from "@/lib/encryption";
import { corsHeaders, resolveAllowedOrigin } from "@/lib/http";
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

async function parsePayload(request: Request, submissionId: string, form?: any): Promise<ParsedSubmission> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const text = await request.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    return Object.fromEntries(new URLSearchParams(text).entries());
  }

  const formData = await request.formData();
  const payload: ParsedSubmission = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const fileMeta = {
        name: value.name,
        size: value.size,
        type: value.type,
        url: undefined as string | undefined,
      };

      if (value.size > 0) {
        const rawExt = (value.name.split(".").pop() || "").toLowerCase();
        const ext = "." + rawExt;
        const dangerousExts = [".exe", ".bat", ".cmd", ".sh", ".php", ".phtml", ".cgi", ".pl", ".py", ".js", ".vbs", ".scr", ".jar", ".msi"];
        if (dangerousExts.includes(ext)) {
          throw new Error(`Executable file type '${ext}' is blocked for security reasons.`);
        }

        if (form?.allowedFileExtensions) {
          const allowed = form.allowedFileExtensions
            .split(",")
            .map((e: string) => e.trim().toLowerCase().replace(/^\./, ""))
            .filter(Boolean);
          if (allowed.length > 0 && !allowed.includes(rawExt)) {
            throw new Error(`File type '${ext}' is not permitted. Allowed: ${form.allowedFileExtensions}`);
          }
        }

        const maxBytes = ((form?.maxAttachmentSizeMb ?? 10) || 10) * 1024 * 1024;
        if (value.size > maxBytes) {
          throw new Error(`File '${value.name}' exceeds the maximum allowed size of ${form?.maxAttachmentSizeMb ?? 10}MB.`);
        }

        const fileBuffer = await value.arrayBuffer();

        // Magic Bytes & binary signature verification (anti-spoofing defense)
        const { validateFileSignature } = await import("@/lib/magic-bytes");
        const sigResult = validateFileSignature(new Uint8Array(fileBuffer.slice(0, 1024)), rawExt);
        if (!sigResult.valid) {
          throw new Error(`Upload rejected: ${sigResult.reason || "File signature verification failed"}`);
        }

        try {
          const { uploadFile, getStorageConfig } = await import("@/lib/storage");
          const storageConfig = getStorageConfig();
          if (storageConfig.type !== "none") {
            const safeName = value.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const storageKey = `uploads/${submissionId}/${safeName}`;
            const uploaded = await uploadFile(storageKey, fileBuffer, value.type || "application/octet-stream");
            if (uploaded) {
              fileMeta.url = `/api/submissions/${submissionId}/files/${encodeURIComponent(safeName)}`;
            }
          }
        } catch (err) {
          console.error(`File upload failed for ${value.name}:`, err);
        }
      }
      payload[key] = fileMeta;
    } else if (payload[key] !== undefined) {
      payload[key] = Array.isArray(payload[key]) ? [...payload[key], value] : [payload[key], value];
    } else {
      payload[key] = value;
    }
  }

  return payload;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderSuccessHtml(formName: string, message: string, submissionId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Submission Received — FormForge</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 0%, #0c1527 0%, #030712 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f8fafc;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(56, 189, 248, 0.1);
    }
    .icon-box {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(52, 211, 153, 0.3);
      color: #34d399;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 8px;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .ref-badge {
      display: inline-block;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3);
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn:hover { opacity: 0.95; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .footer {
      margin-top: 32px;
      font-size: 11px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">✓</div>
    <h1>${escapeHtml(formName)}</h1>
    <p>${escapeHtml(message)}</p>
    <div><span class="ref-badge">Reference ID: ${escapeHtml(submissionId)}</span></div>
    <div>
      <button class="btn" onclick="history.back()">← Return to Site</button>
    </div>
    <div class="footer">FormForge &bull; Zero-Card Free Tier Form Engine</div>
  </div>
</body>
</html>`;
}

function hasInvalidEmail(payload: ParsedSubmission): boolean {
  for (const key of ["email", "Email", "reply_to", "replyTo"]) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== "") {
      const valStr = String(value).trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valStr)) {
        return true;
      }
    }
  }
  return false;
}

async function hasMxRecord(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { "accept": "application/dns-json" },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return true; // Fail-safe: if API is down, assume valid
    const data = await res.json() as { Answer?: any[] };
    return Array.isArray(data.Answer) && data.Answer.length > 0;
  } catch (e) {
    return true; // Fail-safe
  }
}

function findEmail(payload: ParsedSubmission): string | undefined {
  for (const key of ["email", "Email", "reply_to", "replyTo"]) {
    const value = payload[key];
    if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())) {
      return value.trim().toLowerCase();
    }
  }
  return undefined;
}

async function calculateSpamScore(form: Form, payload: ParsedSubmission, request: Request, altchaResult?: { verified: boolean; error?: string }) {
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

  // ALTCHA Proof-of-Work: safely classifies missing or failed challenge as spam instead of breaking the client app with HTTP 400
  if (form.altchaEnabled) {
    if (altchaResult?.verified) {
      reasons.push("altcha_verified");
    } else {
      score += 80;
      reasons.push(altchaResult?.error || "altcha_token_missing");
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

export async function GET(request: Request, context: RouteContext) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  const { endpointId } = await context.params;
  await ensureSchema(db);
  const formRows = await db.select().from(forms).where(eq(forms.endpointId, endpointId)).limit(1);
  const form = formRows[0];
  const origin = request.headers.get("origin");
  const allowedOrigin = form ? resolveAllowedOrigin(form.allowedOrigins, origin) : origin;
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

  // Rate limiting for challenge requests
  const { checkRateLimit, getClientIp } = await import("@/lib/rate-limit");
  const ip = getClientIp(request);
  const limitRes = await checkRateLimit(db, `chal:${form.id}:${ip}`, 60, 60);
  if (!limitRes.allowed) {
    return new Response(JSON.stringify({ ok: false, error: "Too many requests. Please wait a moment." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // If ALTCHA is not enabled on this form, return informative status
  if (!form.altchaEnabled) {
    return new Response(JSON.stringify({
      ok: true,
      formId: form.id,
      name: form.name,
      altchaEnabled: false,
      message: "ALTCHA Proof-of-Work is not required for this endpoint."
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  // Generate live ALTCHA challenge directly for this single endpoint
  const { createAltchaChallenge } = await import("@/lib/altcha");
  const { getAuthSecret } = await import("@/lib/auth");
  const hmacKey = getAuthSecret() || "formforge_altcha_secret_fallback_key";

  const challenge = await createAltchaChallenge({
    hmacKey,
    maxNumber: 20000,
    expiresSeconds: 900,
  });

  return new Response(JSON.stringify(challenge), {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
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

  // Quota enforcement: check if form has reached its configured submission limit
  if (form.submissionLimit && form.submissionLimit > 0 && form.submissionsCount >= form.submissionLimit) {
    return new Response(JSON.stringify({
      ok: false,
      code: "LIMIT_REACHED",
      message: "This form has reached its maximum response submission limit and is no longer accepting new responses.",
    }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Scheduled close: the owner can stop accepting responses on a given date.
  if (form.closeAt && new Date(form.closeAt).getTime() <= Date.now()) {
    return new Response(JSON.stringify({
      ok: false,
      code: "FORM_CLOSED",
      message: "This form is closed and is no longer accepting new responses.",
    }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (origin && !allowedOrigin) {
    return new Response(JSON.stringify({ ok: false, code: "ORIGIN_BLOCKED", message: "Origin is not allowed." }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Rate Limiting — per-form, configurable, with a safe default of 60/min.
  const { checkRateLimit, getClientIp } = await import("@/lib/rate-limit");
  const ip = getClientIp(request);
  const [maxAttempts, windowSeconds] =
    form.rateLimitPerMinute && form.rateLimitPerMinute > 0
      ? [form.rateLimitPerMinute, 60]
      : [60, 60];
  const limitRes = await checkRateLimit(db, `submit:${form.id}:${ip}`, maxAttempts, windowSeconds);
  if (!limitRes.allowed) {
    return new Response(JSON.stringify({ ok: false, code: "RATE_LIMITED", message: "Too many submissions. Please try again later." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.ceil((new Date(limitRes.resetAt).getTime() - Date.now()) / 1000)) }
    });
  }

  // Check payload size using Content-Length header
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  const reqContentType = request.headers.get("content-type") || "";
  const isMultipart = reqContentType.includes("multipart/form-data");
  const maxAllowedBytes = isMultipart
    ? (((form as any).maxAttachmentSizeMb ?? 10) || 10) * 1024 * 1024 + 65536
    : 65536;

  if (contentLength > maxAllowedBytes) {
    return new Response(JSON.stringify({
      ok: false,
      code: "PAYLOAD_TOO_LARGE",
      message: isMultipart
        ? `Upload exceeds attachment limit of ${(form as any).maxAttachmentSizeMb ?? 10}MB.`
        : "Payload size exceeds 64KB limit.",
    }), {
      status: 413,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const submissionId = randomId("sub");
  let payload: ParsedSubmission;
  try {
    payload = await parsePayload(request, submissionId, form);
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Invalid payload formatting.",
    }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ALTCHA Proof-of-Work Verification (100% Free, Zero-Config, Self-Hosted)
  let altchaResult: { verified: boolean; error?: string } | undefined = undefined;
  if (form.altchaEnabled) {
    const altchaRaw = (payload["altcha"] as string) ||
                      (payload["altcha-response"] as string) ||
                      request.headers.get("x-altcha-response") ||
                      request.headers.get("x-altcha");

    if (altchaRaw) {
      try {
        const { verifyAltchaSolution } = await import("@/lib/altcha");
        const { getAuthSecret } = await import("@/lib/auth");
        const hmacKey = getAuthSecret() || "formforge_altcha_secret_fallback_key";
        const verification = await verifyAltchaSolution({
          rawPayload: altchaRaw,
          hmacKey,
          db,
        });

        if (verification.ok) {
          altchaResult = { verified: true };
        } else {
          altchaResult = { verified: false, error: verification.error || "altcha_failed" };
        }
      } catch (err) {
        altchaResult = { verified: false, error: "altcha_verification_error" };
      }
    } else {
      altchaResult = { verified: false, error: "altcha_token_missing" };
    }
  }

  // Validate email format strictly to reject typos/spambots like admin@gmailcom
  if (hasInvalidEmail(payload)) {
    return new Response(JSON.stringify({
      ok: false,
      code: "INVALID_EMAIL",
      message: "The email address provided is invalid. Please ensure it follows a valid format (e.g., name@domain.com)."
    }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }

  const email = findEmail(payload);
  if (email) {
    const domain = email.split("@")[1];
    const validMx = await hasMxRecord(domain);
    if (!validMx) {
      return new Response(JSON.stringify({
        ok: false,
        code: "INVALID_EMAIL_DOMAIN",
        message: `The domain @${domain} does not have valid mail server (MX) records. Please enter a working email address.`
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }

  // ── Password-gated forms ────────────────────────────────────────────
  // A form with a password requires a valid unlock token. The token is an
  // HMAC bound to this form id, so it cannot be replayed on another form.
  if (form.passwordEnabled && form.passwordHash) {
    const { verifyFormToken } = await import("@/lib/form-password");
    const { getAuthSecret } = await import("@/lib/auth");
    const secret = getAuthSecret() || form.id;

    const providedToken =
      request.headers.get("x-formforge-form-token") ||
      (typeof payload._ff_form_token === "string" ? payload._ff_form_token : "");

    const unlocked = providedToken ? await verifyFormToken(providedToken, form.id, secret) : false;

    if (!unlocked) {
      return new Response(JSON.stringify({
        ok: false,
        code: "FORM_LOCKED",
        passwordRequired: true,
        message: "This form is protected. Unlock it before submitting.",
      }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    delete payload._ff_form_token;
  }

  // ── Server-side prefill & hidden fields ─────────────────────────────
  // Hidden values are injected here, after the client payload is parsed and
  // before anything is stored — so the client can never forge them.
  {
    const { resolvePrefills, applyHiddenPrefills } = await import("@/lib/prefill");
    const { formPrefills } = await import("@/db/schema");

    const mappingRows = await db
      .select()
      .from(formPrefills)
      .where(eq(formPrefills.formId, form.id));

    const mappings = mappingRows.map((row) => ({
      fieldKey: row.fieldKey,
      paramName: row.paramName,
      isHidden: Boolean(row.isHidden),
    }));

    if (mappings.length || form.captureUtm) {
      const requestUrl = new URL(request.url);
      const resolved = resolvePrefills(mappings, requestUrl.searchParams, form.captureUtm);

      // Only hidden mappings are enforced server-side. Editable prefills are a
      // convenience for the hosted page and are applied by the browser.
      const hiddenValues: Record<string, string> = {};
      for (const fieldKey of resolved.hiddenFields) {
        if (resolved.values[fieldKey] !== undefined) {
          hiddenValues[fieldKey] = resolved.values[fieldKey];
        }
      }

      if (Object.keys(hiddenValues).length) {
        Object.assign(payload, applyHiddenPrefills(payload, hiddenValues));
      }
    }
  }

  // ── Conditional logic enforcement ────────────────────────────────────
  // Rules are evaluated on the server. Hidden fields are stripped from the
  // stored payload and never counted as required, so a crafted request
  // cannot bypass the form's logic.
  const { formRules } = await import("@/db/schema");
  const { applyRules } = await import("@/lib/rules");

  const ruleRows = await db.select().from(formRules).where(eq(formRules.formId, form.id));
  if (ruleRows.length) {
    const { sanitized, missingRequired } = applyRules(
      ruleRows.map((row) => ({
        id: row.id,
        sourceField: row.sourceField,
        operator: row.operator,
        value: row.value,
        action: row.action,
        targetField: row.targetField,
      })),
      payload,
    );

    if (missingRequired.length) {
      return new Response(JSON.stringify({
        ok: false,
        code: "MISSING_REQUIRED_FIELD",
        fields: missingRequired,
        message: `Please complete: ${missingRequired.join(", ")}.`,
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    for (const key of Object.keys(payload)) {
      if (!(key in sanitized)) delete payload[key];
    }
  }

  // 6-Digit Email OTP Verification Enforcement
  let otpVerified = false;
  // Guard: if OTP is required but no email was found in the payload, block immediately
  if (form.otpEnabled && !email) {
    return new Response(JSON.stringify({
      ok: false,
      code: "EMAIL_REQUIRED_FOR_OTP",
      otpRequired: true,
      message: "This form requires email verification. Please include your email address in the submission.",
    }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (form.otpEnabled && email) {
    const { verifyOtp, isEmailVerifiedForForm } = await import("@/lib/otp");
    // 1. Check if email was already verified during this session (within 15 min window)
    otpVerified = await isEmailVerifiedForForm(db, form.id, email);

    // 2. If not already verified, verify the submitted code directly
    if (!otpVerified) {
      const submittedOtp = payload._ff_otp || payload.otp || payload.otpCode || payload.code || payload._otp;
      if (submittedOtp && typeof submittedOtp === "string") {
        const otpRes = await verifyOtp(db, form.id, email, submittedOtp);
        if (otpRes.success) {
          otpVerified = true;
        } else {
          return new Response(JSON.stringify({
            ok: false,
            code: "INVALID_OTP",
            message: otpRes.error || "The 6-digit verification code is invalid or has expired."
          }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" }
          });
        }
      }
    }

    if (!otpVerified) {
      return new Response(JSON.stringify({
        ok: false,
        code: "OTP_REQUIRED",
        error: "OTP_REQUIRED",
        otpRequired: true,
        email,
        message: "Email verification is required. Please verify your email with the 6-digit code before submitting."
      }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }

  const { score, reasons } = await calculateSpamScore(form, payload, request, altchaResult);
  const isPendingVerification = (form.emailVerificationEnabled && !otpVerified) && email;
  const status = score >= 80 ? "spam" : isPendingVerification ? "pending" : "accepted";
  
  // Storage optimization: prune transient/internal fields (honeypot, large verified altcha token, otp tokens) to save D1 space
  const storagePayload: ParsedSubmission = { ...payload };
  delete storagePayload[form.honeypotField];
  delete storagePayload["altcha"];
  delete storagePayload["altcha-response"];
  delete storagePayload["_ff_pow"];
  delete storagePayload["otpCode"];
  delete storagePayload["code"];
  delete storagePayload["_otp"];

  // Smart Intent & Urgency Triage (zero-cost classification)
  const { classifyIntent } = await import("@/lib/intent");
  storagePayload["_intent"] = classifyIntent(storagePayload);

  const minifiedPayload = safeStringify(storagePayload);

  // ── Optional encryption at rest ───────────────────────────────────
  // When the owner enables payload encryption, the stored body is sealed
  // with AES-256-GCM so a database dump never contains the answers. The
  // envelope is self-describing, so existing plaintext rows keep working.
  const storedPayload = form.encryptPayloads
    ? await encryptPayload(minifiedPayload)
    : minifiedPayload;

  // ── Duplicate detection ─────────────────────────────────────────────
  // The fingerprint is a salted hash of the canonical payload, so the
  // database never stores a reversible duplicate key. A repeat is linked to
  // the original submission instead of silently inflating the count.
  let fingerprint: string | undefined;
  let duplicateOf: string | undefined;
  {
    const { fingerprintPayload, hasFingerprintableContent } = await import("@/lib/duplicates");
    if (hasFingerprintableContent(storagePayload)) {
      const { getAuthSecret } = await import("@/lib/auth");
      const salt = getAuthSecret() || form.id;
      fingerprint = await fingerprintPayload(storagePayload, form.id, salt);

      const existing = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.formId, form.id),
            eq(submissions.fingerprint, fingerprint),
            sql`${submissions.id} != ${submissionId}`,
          )
        )
        .limit(1);

      if (existing[0]) {
        duplicateOf = existing[0].id;
      }
    }
  }

  // ── Privacy-preserving IP storage ───────────────────────────────────
  // When `storeIpHash` is off the IP is NOT stored at all — the raw address
  // must never leak into the database. When it is on, the hash is salted
  // with the current UTC day so it cannot be correlated across days while
  // remaining correlatable within a day (for rate-limit forensics).
  const ipHash = form.storeIpHash && ip
    ? await sha256(`${form.id}:${ip}:${new Date().toISOString().slice(0, 10)}`)
    : undefined;

  const submission: NewSubmission = {
    id: submissionId,
    formId: form.id,
    payload: storedPayload,
    email: email || undefined,
    ipHash: ipHash ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    referer: request.headers.get("referer") ?? undefined,
    status,
    workflowStatus: status === "spam" ? "spam" : "new",
    duplicateOf: duplicateOf ?? undefined,
    fingerprint: fingerprint ?? undefined,
    spamScore: score,
    spamReasons: JSON.stringify(reasons),
    createdAt: new Date().toISOString(),
  };

  try {
    await db.insert(submissions).values(submission);
    await db.update(forms).set({ submissionsCount: sql`${forms.submissionsCount} + 1`, updatedAt: new Date().toISOString() }).where(eq(forms.id, form.id));

    // The analytics tab is cached for five minutes; a new submission is the
    // only thing that changes it, so drop the entry instead of waiting for
    // the TTL. Fire-and-forget: a cache miss is a slow dashboard, not a
    // failed submission.
    void import("@/lib/kv-cache")
      .then(({ cacheKey, invalidateCached }) =>
        invalidateCached([cacheKey("analytics", form.id), cacheKey("public-stats")]),
      )
      .catch(() => {});

    // ── Convert a partial submission ─────────────────────────────────
    // When the respondent resumes from a saved progress link, the partial
    // record is linked to the final submission so drop-off analytics can
    // distinguish "abandoned" from "completed".
    const partialToken =
      request.headers.get("x-formforge-partial-token") ||
      (typeof payload._ff_partial_token === "string" ? payload._ff_partial_token : "");

    if (partialToken) {
      try {
        const { partialSubmissions } = await import("@/db/schema");
        const tokenHash = await sha256(partialToken);
        await db
          .update(partialSubmissions)
          .set({ convertedSubmissionId: submissionId, updatedAt: new Date().toISOString() })
          .where(
            and(
              eq(partialSubmissions.tokenHash, tokenHash),
              eq(partialSubmissions.formId, form.id),
            )
          );
        delete payload._ff_partial_token;
      } catch {
        // Linking is best-effort — never fail a submission because of it.
      }
    }

    // Data retention auto-purging
    if (form.retentionDays && form.retentionDays > 0) {
      const thresholdDate = new Date(Date.now() - form.retentionDays * 24 * 60 * 60 * 1000).toISOString();
      await db.delete(submissions).where(
        and(
          eq(submissions.formId, form.id),
          lt(submissions.createdAt, thresholdDate)
        )
      );
    }

    const appUrl = new URL(request.url).origin;

    if (status === "accepted") {
      const handleAcceptedAsync = async () => {
        await deliverNotifications(db, form, submission as typeof submissions.$inferSelect, appUrl);
        try {
          const { runFormWorkflows } = await import("@/lib/workflow-engine");
          await runFormWorkflows(db, form, submission as typeof submissions.$inferSelect, payload, appUrl);
        } catch (wfErr) {
          console.warn("Workflow execution note:", wfErr);
        }
      };

      try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        const ctx = getCloudflareContext().ctx;
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(handleAcceptedAsync());
        } else {
          await handleAcceptedAsync();
        }
      } catch {
        await handleAcceptedAsync();
      }
    } else if (status === "pending" && form.emailVerificationEnabled) {
      const { sendVerificationEmail } = await import("@/lib/notifications");
      const appUrl = new URL(request.url).origin;
        try {
          const { getCloudflareContext } = await import("@opennextjs/cloudflare");
          const ctx = getCloudflareContext().ctx;
          if (ctx && typeof ctx.waitUntil === "function") {
            ctx.waitUntil(sendVerificationEmail(db, form, submission as typeof submissions.$inferSelect, appUrl));
          } else {
            await sendVerificationEmail(db, form, submission as typeof submissions.$inferSelect, appUrl);
          }
        } catch {
          await sendVerificationEmail(db, form, submission as typeof submissions.$inferSelect, appUrl);
        }
    }

    const dynamicRedirect = typeof payload._next === "string" ? payload._next :
                            typeof payload._redirect === "string" ? payload._redirect :
                            typeof payload.next === "string" ? payload.next : null;
    const targetRedirectUrl = dynamicRedirect || form.redirectUrl;

    if (targetRedirectUrl && request.headers.get("accept")?.includes("text/html")) {
      const { isSafeRedirectUrl } = await import("@/lib/url-validation");
      if (isSafeRedirectUrl(targetRedirectUrl)) {
        let finalRedirectUrl = targetRedirectUrl;
        for (const [key, val] of Object.entries(payload)) {
          if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            finalRedirectUrl = finalRedirectUrl.replace(new RegExp(`\\{${key}\\}`, "gi"), encodeURIComponent(String(val)));
          }
        }
        return Response.redirect(finalRedirectUrl, 303);
      }
    }

    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("text/html") && !acceptHeader.includes("application/json")) {
      return new Response(
        renderSuccessHtml(
          form.name,
          isPendingVerification
            ? "Please check your inbox to verify your email address and confirm this submission."
            : form.successMessage,
          submission.id
        ),
        { status: 200, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: isPendingVerification 
          ? "Please check your inbox to verify your email address and confirm this submission." 
          : form.successMessage, 
        submissionId: submission.id, 
        status 
      }),
      { status: 202, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    // Log the cause server-side. The client only ever sees the generic
    // message, but a silent failure here is impossible to debug.
    console.error("Submission failed:", error);
    return new Response(JSON.stringify({ ok: false, code: "INTERNAL_ERROR", message: "An error occurred while saving the submission." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
