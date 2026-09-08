import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson, readString } from "@/lib/http";
import { isPrivateUrl } from "@/lib/url-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  await ensureSchema(db);
  const sessionUser = await getCurrentUser(request, db);
  if (!sessionUser) {
    return jsonError("UNAUTHENTICATED", "Sign in to test integrations.", 401);
  }

  const rows = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
  const user = rows[0];
  if (!user) {
    return jsonError("USER_NOT_FOUND", "Account profile not found.", 404);
  }

  const body = await readJson(request);
  const target = readString(body.target); // "gas" | "webhook" | "smtp"

  const samplePayload = {
    event: "universal_test",
    timestamp: new Date().toISOString(),
    account: { id: user.id, email: user.email, name: user.name },
    sampleData: {
      message: "✨ Universal Integration test verified! Your account-level alerts are working properly.",
    },
  };

  // 1. Universal Google Apps Script
  if (target === "gas") {
    const gasUrl = readString(body.url) || user.globalGasUrl;
    if (!gasUrl) {
      return jsonError("MISSING_URL", "Provide a Google Apps Script URL to test.", 400);
    }
    if (isPrivateUrl(gasUrl)) {
      return jsonError("SSRF_BLOCKED", "Internal network URLs are forbidden.", 403);
    }

    let gasSecret: string | undefined = readString(body.secret);
    if (!gasSecret && user.globalGasSecret) {
      try {
        const { decryptText } = await import("@/lib/encryption");
        gasSecret = await decryptText(user.globalGasSecret);
      } catch {
        // ignore decryption error
      }
    }
    if (!gasSecret) {
      const env = (await import("@/db")).getRuntimeEnv();
      gasSecret = (env.GAS_SECRET || env.GAS_SECRET_TOKEN || (process.env.GAS_SECRET as string) || (process.env.GAS_SECRET_TOKEN as string))?.trim() || undefined;
    }
    if (!gasSecret) {
      try {
        const u = new URL(gasUrl);
        gasSecret = u.searchParams.get("secret") || u.searchParams.get("token") || undefined;
      } catch {
        // ignore
      }
    }

    try {
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "follow",
        body: JSON.stringify({
          ...(gasSecret ? { secret: gasSecret } : {}),
          ...samplePayload,
          emailTo: user.email,
          to: user.email,
          recipient: user.email,
          subject: "🧪 FormForge Universal GAS Integration Test",
          text: "Universal Google Apps Script integration test successful! All forms will forward responses to your Google Sheet / Gmail.",
          html: "<div style='font-family: sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 12px;'><h2 style='color: #38bdf8;'>🧪 FormForge Universal GAS Test</h2><p>Universal Google Apps Script integration test successful! All forms will forward responses to your Google Sheet / Gmail.</p></div>",
          htmlBody: "<div style='font-family: sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 12px;'><h2 style='color: #38bdf8;'>🧪 FormForge Universal GAS Test</h2><p>Universal Google Apps Script integration test successful! All forms will forward responses to your Google Sheet / Gmail.</p></div>",
        }),
      });

      let gasData: any = null;
      try {
        gasData = await response.json();
      } catch {
        // Not JSON response
      }

      if (gasData && gasData.success === false) {
        return jsonError("GAS_REJECTED", `Google Apps Script returned an error: "${gasData.error || 'Failed'}"`, 400);
      }

      const isSuccess = response.ok || response.status === 302 || response.type === "opaqueredirect";
      return jsonOk({
        success: isSuccess,
        status: response.status,
        message: isSuccess
          ? (gasData?.message ? `✓ GAS: ${gasData.message}` : "✓ Universal Google Apps Script test passed! Connected successfully.")
          : `GAS endpoint returned HTTP ${response.status}`,
      });
    } catch (err) {
      return jsonError("TEST_FAILED", `Failed to reach Google Apps Script: ${err instanceof Error ? err.message : String(err)}`, 502);
    }
  }

  // 2. Universal Webhook (Stoat, Slack, Discord, Custom)
  if (target === "webhook") {
    let webhookUrl = readString(body.url) || user.globalWebhookUrl;
    if (!webhookUrl) {
      return jsonError("MISSING_URL", "Provide a Webhook URL to test.", 400);
    }

    const { normalizeWebhookUrl } = await import("@/lib/url-validation");
    webhookUrl = normalizeWebhookUrl(webhookUrl);

    if (isPrivateUrl(webhookUrl)) {
      return jsonError("SSRF_BLOCKED", "Internal network URLs are forbidden.", 403);
    }

    try {
      let webhookSecret: string | undefined = readString(body.secret);
      if (!webhookSecret && user.globalWebhookSecret) {
        try {
          const { decryptText } = await import("@/lib/encryption");
          webhookSecret = await decryptText(user.globalWebhookSecret);
        } catch {
          // ignore
        }
      }

      const isStoat = webhookUrl.includes("stoat.chat");
      const isDiscord = webhookUrl.includes("discord.com");
      const isSlack = webhookUrl.includes("slack.com");

      let bodyToSend: Record<string, unknown>;
      if (isStoat) {
        bodyToSend = {
          content: `🧪 **FormForge Universal Webhook Test**\nUniversal webhook integration for **${user.name}** is active and functioning properly!`,
        };
      } else if (isDiscord) {
        bodyToSend = {
          content: `🧪 **FormForge Universal Webhook Test**\n> Connected to **${user.name}** account!`,
        };
      } else if (isSlack) {
        bodyToSend = {
          text: `🧪 *FormForge Universal Webhook Test*\nUniversal alerts active for *${user.name}*!`,
        };
      } else {
        bodyToSend = samplePayload;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "FormForge/1.0",
      };
      if (webhookSecret) {
        headers["X-FormForge-Secret"] = webhookSecret;
        headers["Authorization"] = `Bearer ${webhookSecret}`;
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyToSend),
      });

      return jsonOk({
        success: response.ok,
        status: response.status,
        message: response.ok
          ? "✓ Universal Webhook test payload delivered successfully!"
          : `Webhook target returned HTTP ${response.status}`,
      });
    } catch (err) {
      return jsonError("TEST_FAILED", `Failed to deliver webhook: ${err instanceof Error ? err.message : String(err)}`, 502);
    }
  }

  // 3. Universal SMTP
  if (target === "smtp") {
    const host = readString(body.host) || user.globalSmtpHost;
    const port = body.port ? Number(body.port) : (user.globalSmtpPort || 587);
    const smtpUser = readString(body.user) || user.globalSmtpUser;
    const from = readString(body.from) || user.globalSmtpFrom || smtpUser;
    let pass = readString(body.pass);

    if (!pass && user.globalSmtpPass) {
      const { decryptText } = await import("@/lib/encryption");
      pass = await decryptText(user.globalSmtpPass);
    }

    if (!host || !smtpUser || !pass || !from) {
      return jsonError("MISSING_CONFIG", "Host, Port, User, Password, and From address are required to test SMTP.", 400);
    }

    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass },
        connectionTimeout: 10000,
      });

      const info = await transporter.sendMail({
        from,
        to: user.email,
        subject: "🧪 FormForge Universal SMTP Test",
        text: `Congratulations! Your Universal SMTP server (${host}:${port}) is working perfectly. All FormForge email alerts will use this configuration.`,
      });

      return jsonOk({
        success: !!info.messageId,
        message: `✓ Universal SMTP test email sent to ${user.email} successfully!`,
      });
    } catch (err) {
      return jsonError("SMTP_FAILED", `SMTP verification failed: ${err instanceof Error ? err.message : String(err)}`, 502);
    }
  }

  return jsonError("INVALID_TARGET", "Target must be 'gas', 'webhook', or 'smtp'.", 400);
}
