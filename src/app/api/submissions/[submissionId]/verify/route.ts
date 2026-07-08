import { eq } from "drizzle-orm";
import { getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { submissions, forms } from "@/db/schema";
import { deliverNotifications } from "@/lib/notifications";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ submissionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { submissionId } = await context.params;
  const db = getDb();
  if (!isDbReady(db)) {
    return new Response("Database is currently unavailable.", { status: 503 });
  }

  try {
    await ensureSchema(db);
  } catch (error) {
    return new Response("Failed to initialize database schema.", { status: 500 });
  }

  try {
    const subs = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    const sub = subs[0];
    if (!sub) {
      return new Response(errorHtml("Submission not found", "The verification link is invalid or has expired."), {
        status: 404,
        headers: { "Content-Type": "text/html" }
      });
    }

    const formRows = await db
      .select()
      .from(forms)
      .where(eq(forms.id, sub.formId))
      .limit(1);

    const form = formRows[0];
    if (!form) {
      return new Response(errorHtml("Form not found", "The associated form for this submission no longer exists."), {
        status: 404,
        headers: { "Content-Type": "text/html" }
      });
    }

    if (sub.status === "pending") {
      // Update status to accepted
      await db
        .update(submissions)
        .set({ status: "accepted" })
        .where(eq(submissions.id, submissionId));

      // Trigger notifications
      const updatedSub = { ...sub, status: "accepted" };
      try {
        const ctx = getCloudflareContext().ctx;
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(deliverNotifications(db, form, updatedSub));
        } else {
          await deliverNotifications(db, form, updatedSub);
        }
      } catch (err) {
        console.error("Failed to deliver notifications after verification:", err);
      }
    }

    // Redirect if redirect URL is set, or show success page
    if (form.redirectUrl) {
      const payload = JSON.parse(sub.payload) as Record<string, unknown>;
      const { isSafeRedirectUrl } = await import("@/lib/url-validation");
      if (isSafeRedirectUrl(form.redirectUrl)) {
        let finalRedirectUrl = form.redirectUrl;
        for (const [key, val] of Object.entries(payload)) {
          if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            finalRedirectUrl = finalRedirectUrl.replace(new RegExp(`\\{${key}\\}`, "gi"), encodeURIComponent(String(val)));
          }
        }
        return Response.redirect(finalRedirectUrl, 303);
      }
    }

    return new Response(successHtml(form.name, form.successMessage), {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });

  } catch (error) {
    return new Response(errorHtml("Internal Error", "An error occurred during verification. Please try again later."), {
      status: 500,
      headers: { "Content-Type": "text/html" }
    });
  }
}

function successHtml(formName: string, successMessage: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submission Verified - FormForge</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      background: radial-gradient(circle at 50% 50%, #0a0f1d 0%, #020408 100%);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #e2e8f0;
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .container {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 3rem 2rem;
      border-radius: 2rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 1.5rem;
      display: inline-block;
      animation: bounce 1s infinite alternate;
    }
    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-6px); }
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #67e8f9 0%, #38bdf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 0.5rem 0;
    }
    .form-name {
      font-size: 0.9rem;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.5rem;
    }
    p.message {
      font-size: 1rem;
      line-height: 1.6;
      color: #cbd5e1;
      margin: 0 0 2rem 0;
    }
    .footer {
      font-size: 0.75rem;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>Email Verified!</h1>
    <div class="form-name">${escapeHtml(formName)}</div>
    <p class="message">${escapeHtml(successMessage)}</p>
    <div class="footer">
      Powered by FormForge
    </div>
  </div>
</body>
</html>`;
}

function errorHtml(title: string, desc: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Error - FormForge</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      background: radial-gradient(circle at 50% 50%, #150a0a 0%, #080202 100%);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #e2e8f0;
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .container {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(244, 63, 94, 0.15);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 3rem 2rem;
      border-radius: 2rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
      animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 1.5rem;
      display: inline-block;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 800;
      color: #f43f5e;
      margin: 0 0 1rem 0;
    }
    p.message {
      font-size: 1rem;
      line-height: 1.6;
      color: #cbd5e1;
      margin: 0 0 2rem 0;
    }
    .footer {
      font-size: 0.75rem;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="message">${escapeHtml(desc)}</p>
    <div class="footer">
      Powered by FormForge
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
