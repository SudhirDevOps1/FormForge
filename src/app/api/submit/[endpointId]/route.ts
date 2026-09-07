import { and, eq, lt, sql } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms, submissions, type Form, type NewSubmission } from "@/db/schema";
import { randomId, safeStringify, sha256 } from "@/lib/crypto";
import { corsHeaders, jsonError, resolveAllowedOrigin } from "@/lib/http";
import { deliverNotifications } from "@/lib/notifications";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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

async function parsePayload(request: Request, submissionId: string): Promise<ParsedSubmission> {
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
      const fileMeta = {
        name: value.name,
        size: value.size,
        type: value.type,
        url: undefined as string | undefined,
      };

      if (value.size > 0) {
        try {
          const { uploadFile, getStorageConfig } = await import("@/lib/storage");
          const storageConfig = getStorageConfig();
          if (storageConfig.type !== "none") {
            const fileBuffer = await value.arrayBuffer();
            const storageKey = `uploads/${submissionId}/${value.name}`;
            const uploaded = await uploadFile(storageKey, fileBuffer, value.type);
            if (uploaded) {
              fileMeta.url = `/api/submissions/${submissionId}/files/${encodeURIComponent(value.name)}`;
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

  const submissionId = randomId("sub");
  let payload: ParsedSubmission;
  try {
    payload = await parsePayload(request, submissionId);
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
      const { decryptText } = await import("@/lib/encryption");
      const decryptedSecret = await decryptText(form.turnstileSecretKey);
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(decryptedSecret)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip)}`,
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

  const { score, reasons, serialized } = await calculateSpamScore(form, payload, request);
  const isPendingVerification = (form.emailVerificationEnabled || form.otpEnabled) && email;
  const status = score >= 80 ? "spam" : isPendingVerification ? "pending" : "accepted";
  
  const submission: NewSubmission = {
    id: submissionId,
    formId: form.id,
    payload: serialized,
    email: email || undefined,
    ipHash: form.storeIpHash && ip ? await sha256(`${form.id}:${ip}`) : (ip ?? undefined),
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

    if (status === "accepted") {
      try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        const ctx = getCloudflareContext().ctx;
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(deliverNotifications(db, form, submission as typeof submissions.$inferSelect));
        } else {
          await deliverNotifications(db, form, submission as typeof submissions.$inferSelect);
        }
      } catch {
        await deliverNotifications(db, form, submission as typeof submissions.$inferSelect);
      }
    } else if (status === "pending") {
      if (form.otpEnabled && email) {
        try {
          const { createOtp } = await import("@/lib/otp");
          const { sendOtpEmail } = await import("@/lib/notifications");
          const { code } = await createOtp(db, form.id, email);
          await sendOtpEmail(form, email, code);
        } catch (otpErr) {
          console.error("Failed to generate and send OTP:", otpErr);
        }
      } else {
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
    return new Response(JSON.stringify({ ok: false, code: "INTERNAL_ERROR", message: "An error occurred while saving the submission." }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
