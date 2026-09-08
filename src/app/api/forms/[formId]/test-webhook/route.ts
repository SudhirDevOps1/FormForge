import { and, eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { forms } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson, readString } from "@/lib/http";
import { isPrivateUrl } from "@/lib/url-validation";
import { hmacSha256 } from "@/lib/crypto";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const db = getDb();
  if (!isDbReady(db)) {
    return databaseUnavailableResponse();
  }

  try {
    await ensureSchema(db);
  } catch {
    return jsonError("DB_ERROR", "Failed to initialize schema.", 500);
  }

  const user = await getCurrentUser(request, db);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Sign in to test integrations.", 401);
  }

  const rows = await db
    .select()
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.userId, user.id)))
    .limit(1);

  const form = rows[0];
  if (!form) {
    return jsonError("FORM_NOT_FOUND", "Form not found.", 404);
  }

  const body = await readJson(request);
  const target = readString(body.target); // "webhook" | "gas" | "telegram" | "ntfy"
  const customUrl = readString(body.url);
  const customToken = readString(body.token);
  const customChatId = readString(body.chatId);
  const customTopic = readString(body.topic);

  const testPayload = {
    event: "test_notification",
    formId: form.id,
    formName: form.name,
    timestamp: new Date().toISOString(),
    sampleData: {
      name: user.name || "Test Submitter",
      email: user.email,
      message: "This is a live test notification from FormForge! Real-time notifications are active and verified.",
    },
  };

  const startTime = Date.now();

  try {
    if (target === "webhook") {
      const rawUrl = customUrl || form.webhookUrl;
      if (!rawUrl) {
        return jsonError("MISSING_URL", "No webhook URL configured or provided.", 400);
      }

      const { normalizeWebhookUrl } = await import("@/lib/url-validation");
      const targetUrl = normalizeWebhookUrl(rawUrl);

      let parsed: URL;
      try {
        parsed = new URL(targetUrl);
      } catch {
        return jsonError("INVALID_URL", "Invalid webhook URL.", 400);
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return jsonError("INVALID_SCHEME", "URL scheme must be http or https.", 400);
      }

      if (isPrivateUrl(targetUrl)) {
        return jsonError("SSRF_BLOCKED", "Private or loopback IPs are disallowed.", 400);
      }

      const lowercaseUrl = targetUrl.toLowerCase();
      let bodyText = "";

      if (lowercaseUrl.includes("discord.com/api/webhooks") || lowercaseUrl.includes("discordapp.com/api/webhooks")) {
        bodyText = JSON.stringify({
          username: "FormForge",
          embeds: [
            {
              title: `⚡ FormForge Live Test: ${form.name}`,
              description: "Your webhook is connected and working successfully! 🎉",
              color: 1629853,
              fields: [
                { name: "Status", value: "Verified & Connected ✅", inline: true },
                { name: "Sender", value: user.name || user.email, inline: true },
                { name: "Engine", value: "Zero-Card Free Tier Active", inline: false },
              ],
              timestamp: new Date().toISOString(),
              footer: { text: "FormForge Notifications" },
            },
          ],
        });
      } else if (lowercaseUrl.includes("hooks.slack.com")) {
        bodyText = JSON.stringify({
          text: `⚡ *FormForge Live Test: ${form.name}*\nConnected Successfully ✅ Real-time notifications are active and verified!`,
        });
      } else if (lowercaseUrl.includes("stoat.chat") || lowercaseUrl.includes("revolt.chat")) {
        bodyText = JSON.stringify({
          content: `⚡ **FormForge Live Test: ${form.name}**\n\nConnected Successfully ✅ Real-time notifications are active and verified!\n• **Sender**: ${user.name || user.email}\n• **Engine**: Zero-Card Free Tier Active\n• **Timestamp**: ${new Date().toISOString()}`,
        });
      } else if (lowercaseUrl.includes("office.com") || lowercaseUrl.includes("webhook.office") || lowercaseUrl.includes("msteams")) {
        bodyText = JSON.stringify({
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          themeColor: "0076D7",
          summary: `FormForge Test: ${form.name}`,
          title: `⚡ FormForge Test: ${form.name}`,
          text: "Connected Successfully ✅ Real-time notifications are active and verified!",
        });
      } else if (lowercaseUrl.includes("mattermost")) {
        bodyText = JSON.stringify({
          text: `### ⚡ FormForge Test: ${form.name}\nConnected Successfully ✅ Real-time notifications are active and verified!`,
        });
      } else {
        bodyText = JSON.stringify({
          content: `⚡ FormForge Live Test: ${form.name} connected successfully! ✅`,
          text: `⚡ FormForge Live Test: ${form.name} connected successfully! ✅`,
          ...testPayload,
        });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      let signature = "";
      try {
        signature = await hmacSha256(timestamp + "." + bodyText, process.env.AUTH_SECRET || form.id);
      } catch {
        // ignore
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "FormForge/1.0 (Integration Tester)",
      };
      if (signature) {
        headers["X-FormForge-Signature"] = "t=" + timestamp + ",v1=" + signature;
      }

      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: bodyText,
        signal: AbortSignal.timeout(10000),
      });

      const elapsed = Date.now() - startTime;
      const text = await res.text();
      return jsonOk({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        elapsedMs: elapsed,
        responsePreview: text.slice(0, 300),
      });
    }

    if (target === "gas") {
      const targetUrl = customUrl || form.gasUrl;
      if (!targetUrl) {
        return jsonError("MISSING_URL", "No Google Apps Script URL provided.", 400);
      }

      let parsed: URL;
      try {
        parsed = new URL(targetUrl);
      } catch {
        return jsonError("INVALID_URL", "Invalid GAS Web App URL.", 400);
      }

      if (!targetUrl.includes("script.google.com")) {
        return jsonError("INVALID_HOST", "GAS URL must be hosted on script.google.com.", 400);
      }

      const gasPayload = {
        form: { id: form.id, name: form.name },
        submission: { id: "test-preview", createdAt: new Date().toISOString() },
        payload: testPayload.sampleData,
        emailTo: form.emailTo || user.email,
        isTest: true,
      };

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gasPayload),
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      });

      const elapsed = Date.now() - startTime;
      const text = await res.text();
      return jsonOk({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        elapsedMs: elapsed,
        responsePreview: text.slice(0, 300),
      });
    }

    if (target === "telegram") {
      const token = customToken || form.telegramBotToken;
      const chatId = customChatId || form.telegramChatId;
      if (!token || !chatId) {
        return jsonError("MISSING_PARAMS", "Both Telegram Bot Token and Chat ID are required.", 400);
      }

      const msg = "⚡ *FormForge Test Notification*\n\nForm: *" + form.name + "*\nStatus: Connected Successfully ✅\nEngine: Zero-Card Free Tier Active";
      const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: "Markdown",
        }),
        signal: AbortSignal.timeout(10000),
      });

      const elapsed = Date.now() - startTime;
      const data = (await res.json()) as { ok?: boolean; description?: string };
      return jsonOk({
        status: res.status,
        statusText: res.statusText,
        ok: !!data.ok,
        elapsedMs: elapsed,
        responsePreview: data.description || "Message delivered to Telegram chat",
      });
    }

    if (target === "ntfy") {
      const topic = customTopic || form.ntfyTopic;
      if (!topic) {
        return jsonError("MISSING_TOPIC", "ntfy.sh topic is required.", 400);
      }

      const res = await fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
        method: "POST",
        headers: {
          Title: "FormForge Test: " + form.name,
          Priority: "default",
          Tags: "white_check_mark,bell",
        },
        body: "Test notification sent successfully! FormForge is wired to topic: " + topic,
        signal: AbortSignal.timeout(10000),
      });

      const elapsed = Date.now() - startTime;
      return jsonOk({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        elapsedMs: elapsed,
        responsePreview: "Notification published to https://ntfy.sh/" + topic,
      });
    }

    return jsonError("INVALID_TARGET", "Unsupported test target.", 400);
  } catch (err: unknown) {
    const elapsed = Date.now() - startTime;
    return jsonError(
      "DISPATCH_FAILED",
      "Connection failed after " + elapsed + "ms: " + (err instanceof Error ? err.message : String(err)),
      502
    );
  }
}
