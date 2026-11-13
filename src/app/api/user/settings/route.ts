import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { encryptText } from "@/lib/encryption";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { cacheKey, cached, invalidateCached } from "@/lib/kv-cache";

export const dynamic = "force-dynamic";

/**
 * The settings payload is read whenever the dashboard's integration panel
 * opens, and it never changes unless the owner saves it. It is cached for five
 * minutes per user and dropped on every PATCH, so reopening the panel costs no
 * D1 read while a save is visible immediately.
 *
 * Only the columns the panel renders are selected — the previous
 * `select().from(users)` pulled `password_hash` and `totp_secret` into the
 * Worker's memory for no reason.
 */
const SETTINGS_COLUMNS = {
  globalSmtpEnabled: users.globalSmtpEnabled,
  globalSmtpHost: users.globalSmtpHost,
  globalSmtpPort: users.globalSmtpPort,
  globalSmtpUser: users.globalSmtpUser,
  globalSmtpPass: users.globalSmtpPass,
  globalSmtpFrom: users.globalSmtpFrom,
  globalGasUrl: users.globalGasUrl,
  globalGasSecret: users.globalGasSecret,
  globalWebhookUrl: users.globalWebhookUrl,
  globalWebhookSecret: users.globalWebhookSecret,
  globalNotifyEmail: users.globalNotifyEmail,
  notifyOnLogin: users.notifyOnLogin,
  notifyOnSubmission: users.notifyOnSubmission,
} as const;

type SettingsRow = {
  [K in keyof typeof SETTINGS_COLUMNS]: (typeof users.$inferSelect)[K];
};

function toSettings(user: SettingsRow) {
  return {
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
}

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

    const result = await cached<{ settings: ReturnType<typeof toSettings> | null }>(
      cacheKey("settings", sessionUser.id),
      300,
      async () => {
        const rows = await db
          .select(SETTINGS_COLUMNS)
          .from(users)
          .where(eq(users.id, sessionUser.id))
          .limit(1);
        const user = rows[0];
        return { settings: user ? toSettings(user) : null };
      },
    );

    if (!result.settings) {
      return jsonError("USER_NOT_FOUND", "Account profile not found.", 404);
    }

    return jsonOk({ settings: result.settings });
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

    const updatedRows = await db
      .select(SETTINGS_COLUMNS)
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1);
    const updatedUser = updatedRows[0];

    if (!updatedUser) {
      return jsonError("USER_NOT_FOUND", "Account profile not found.", 404);
    }

    const settings = toSettings(updatedUser);

    // The cached copy is now stale — drop it so the next read sees this save.
    await invalidateCached(cacheKey("settings", sessionUser.id));

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
