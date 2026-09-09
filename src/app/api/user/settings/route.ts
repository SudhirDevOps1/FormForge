import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { encryptText } from "@/lib/encryption";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = getDb();
    if (!isDbReady(db)) {
      return databaseUnavailableResponse();
    }

    await ensureSchema(db);
    const sessionUser = await getCurrentUser(request, db);
    if (!sessionUser) {
      return jsonError("UNAUTHENTICATED", "Sign in to continue.", 401);
    }

    const rows = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
    const user = rows[0];
    if (!user) {
      return jsonError("USER_NOT_FOUND", "Account profile not found.", 404);
    }

    const settings = {
      globalSmtpEnabled: Boolean(user.globalSmtpEnabled),
      globalSmtpHost: user.globalSmtpHost || "",
      globalSmtpPort: user.globalSmtpPort || 587,
      globalSmtpUser: user.globalSmtpUser || "",
      hasGlobalSmtpPass: Boolean(user.globalSmtpPass),
      globalSmtpFrom: user.globalSmtpFrom || "",
      globalGasUrl: user.globalGasUrl || "",
      hasGlobalGasSecret: Boolean(user.globalGasSecret),
      globalWebhookUrl: user.globalWebhookUrl || "",
      hasGlobalWebhookSecret: Boolean(user.globalWebhookSecret),
      globalNotifyEmail: user.globalNotifyEmail || "",
      notifyOnLogin: user.notifyOnLogin !== false,
      notifyOnSubmission: user.notifyOnSubmission !== false,
    };

    return jsonOk({ settings });
  } catch (err: any) {
    console.error("GET /api/user/settings error:", err);
    return jsonError("FETCH_SETTINGS_FAILED", err.message || "Failed to retrieve settings.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const db = getDb();
    if (!isDbReady(db)) {
      return databaseUnavailableResponse();
    }

    await ensureSchema(db);
    const sessionUser = await getCurrentUser(request, db);
    if (!sessionUser) {
      return jsonError("UNAUTHENTICATED", "Sign in to continue.", 401);
    }

    const body = await readJson(request);
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof body.globalSmtpEnabled === "boolean") {
      updateData.globalSmtpEnabled = body.globalSmtpEnabled;
    }
    if (typeof body.globalSmtpHost === "string") {
      updateData.globalSmtpHost = body.globalSmtpHost.trim() || null;
    }
    if (typeof body.globalSmtpPort === "number" || typeof body.globalSmtpPort === "string") {
      const port = Number(body.globalSmtpPort);
      if (!isNaN(port) && port > 0 && port <= 65535) {
        updateData.globalSmtpPort = port;
      }
    }
    if (typeof body.globalSmtpUser === "string") {
      updateData.globalSmtpUser = body.globalSmtpUser.trim() || null;
    }
    if (typeof body.globalSmtpFrom === "string") {
      updateData.globalSmtpFrom = body.globalSmtpFrom.trim() || null;
    }

    // Handle password update / clear
    if (body.clearGlobalSmtpPass === true) {
      updateData.globalSmtpPass = null;
    } else if (typeof body.globalSmtpPass === "string" && body.globalSmtpPass.trim().length > 0) {
      updateData.globalSmtpPass = await encryptText(body.globalSmtpPass.trim());
    }

    // Handle Universal GAS Webhook URL & Secret
    if (typeof body.globalGasUrl === "string") {
      const cleanUrl = body.globalGasUrl.trim();
      if (cleanUrl) {
        if (!cleanUrl.startsWith("https://")) {
          return jsonError("INVALID_URL", "Google Apps Script URL must use https://.", 400);
        }
        updateData.globalGasUrl = cleanUrl;
      } else {
        updateData.globalGasUrl = null;
      }
    }
    if (body.clearGlobalGasSecret === true) {
      updateData.globalGasSecret = null;
    } else if (typeof body.globalGasSecret === "string" && body.globalGasSecret.trim().length > 0) {
      updateData.globalGasSecret = await encryptText(body.globalGasSecret.trim());
    }

    // Handle Universal Outgoing Webhook URL (Stoat, Slack, Discord, custom) & Secret
    if (typeof body.globalWebhookUrl === "string") {
      const cleanUrl = body.globalWebhookUrl.trim();
      if (cleanUrl) {
        const { isPrivateUrl, normalizeWebhookUrl } = await import("@/lib/url-validation");
        const normalized = normalizeWebhookUrl(cleanUrl);
        if (!normalized.startsWith("https://") && !normalized.startsWith("http://")) {
          return jsonError("INVALID_URL", "Webhook URL must start with https:// or http://.", 400);
        }
        if (isPrivateUrl(normalized)) {
          return jsonError("SSRF_BLOCKED", "Internal network URLs are forbidden.", 403);
        }
        updateData.globalWebhookUrl = normalized;
      } else {
        updateData.globalWebhookUrl = null;
      }
    }
    if (body.clearGlobalWebhookSecret === true) {
      updateData.globalWebhookSecret = null;
    } else if (typeof body.globalWebhookSecret === "string" && body.globalWebhookSecret.trim().length > 0) {
      updateData.globalWebhookSecret = await encryptText(body.globalWebhookSecret.trim());
    }

    if (typeof body.globalNotifyEmail === "string") {
      const email = body.globalNotifyEmail.trim();
      updateData.globalNotifyEmail = email || null;
    }

    if (typeof body.notifyOnLogin === "boolean") {
      updateData.notifyOnLogin = body.notifyOnLogin;
    }
    if (typeof body.notifyOnSubmission === "boolean") {
      updateData.notifyOnSubmission = body.notifyOnSubmission;
    }

    try {
      await db.update(users).set(updateData).where(eq(users.id, sessionUser.id));
    } catch {
      // If column is missing in SQLite/D1, dynamically run column additions and retry:
      const { sql: drizzleSql } = await import("drizzle-orm");
      const alterQueries = [
        "ALTER TABLE users ADD COLUMN totp_secret text;",
        "ALTER TABLE users ADD COLUMN totp_enabled integer NOT NULL DEFAULT 0;",
        "ALTER TABLE users ADD COLUMN global_smtp_enabled integer NOT NULL DEFAULT 0;",
        "ALTER TABLE users ADD COLUMN global_smtp_host text;",
        "ALTER TABLE users ADD COLUMN global_smtp_port integer DEFAULT 587;",
        "ALTER TABLE users ADD COLUMN global_smtp_user text;",
        "ALTER TABLE users ADD COLUMN global_smtp_pass text;",
        "ALTER TABLE users ADD COLUMN global_smtp_from text;",
        "ALTER TABLE users ADD COLUMN global_gas_url text;",
        "ALTER TABLE users ADD COLUMN global_gas_secret text;",
        "ALTER TABLE users ADD COLUMN global_webhook_url text;",
        "ALTER TABLE users ADD COLUMN global_webhook_secret text;",
        "ALTER TABLE users ADD COLUMN global_notify_email text;",
        "ALTER TABLE users ADD COLUMN notify_on_login integer NOT NULL DEFAULT 1;",
        "ALTER TABLE users ADD COLUMN notify_on_submission integer NOT NULL DEFAULT 1;",
      ];
      for (const q of alterQueries) {
        try {
          if (typeof (db as any).run === "function") await (db as any).run(drizzleSql.raw(q));
          else if (typeof (db as any).execute === "function") await (db as any).execute(drizzleSql.raw(q));
        } catch {
          // already exists
        }
      }
      await db.update(users).set(updateData).where(eq(users.id, sessionUser.id));
    }

    const updatedRows = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
    const updatedUser = updatedRows[0];

    const settings = {
      globalSmtpEnabled: Boolean(updatedUser.globalSmtpEnabled),
      globalSmtpHost: updatedUser.globalSmtpHost || "",
      globalSmtpPort: updatedUser.globalSmtpPort || 587,
      globalSmtpUser: updatedUser.globalSmtpUser || "",
      hasGlobalSmtpPass: Boolean(updatedUser.globalSmtpPass),
      globalSmtpFrom: updatedUser.globalSmtpFrom || "",
      globalGasUrl: updatedUser.globalGasUrl || "",
      hasGlobalGasSecret: Boolean(updatedUser.globalGasSecret),
      globalWebhookUrl: updatedUser.globalWebhookUrl || "",
      hasGlobalWebhookSecret: Boolean(updatedUser.globalWebhookSecret),
      notifyOnLogin: updatedUser.notifyOnLogin !== false,
      notifyOnSubmission: updatedUser.notifyOnSubmission !== false,
    };

    return jsonOk({
      success: true,
      message: "Universal account settings updated successfully.",
      settings,
    });
  } catch (err: any) {
    console.error("PATCH /api/user/settings error:", err);
    return jsonError("SETTINGS_UPDATE_FAILED", err.message || "Failed to update settings.", 500);
  }
}
