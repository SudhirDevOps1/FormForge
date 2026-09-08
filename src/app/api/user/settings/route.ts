import { eq } from "drizzle-orm";
import { databaseUnavailableResponse, getDb, isDbReady } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { encryptText } from "@/lib/encryption";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  return jsonOk({
    settings: {
      globalSmtpEnabled: Boolean(user.globalSmtpEnabled),
      globalSmtpHost: user.globalSmtpHost || "",
      globalSmtpPort: user.globalSmtpPort || 587,
      globalSmtpUser: user.globalSmtpUser || "",
      hasGlobalSmtpPass: Boolean(user.globalSmtpPass),
      globalSmtpFrom: user.globalSmtpFrom || "",
      globalGasUrl: user.globalGasUrl || "",
      globalWebhookUrl: user.globalWebhookUrl || "",
      notifyOnLogin: user.notifyOnLogin !== false,
      notifyOnSubmission: user.notifyOnSubmission !== false,
    },
  });
}

export async function PATCH(request: Request) {
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

  // Handle Universal GAS Webhook URL
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

  // Handle Universal Outgoing Webhook URL (Stoat, Slack, Discord, custom)
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

  if (typeof body.notifyOnLogin === "boolean") {
    updateData.notifyOnLogin = body.notifyOnLogin;
  }
  if (typeof body.notifyOnSubmission === "boolean") {
    updateData.notifyOnSubmission = body.notifyOnSubmission;
  }

  await db.update(users).set(updateData).where(eq(users.id, sessionUser.id));

  const updatedRows = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
  const updatedUser = updatedRows[0];

  return jsonOk({
    success: true,
    message: "Universal account settings updated successfully.",
    settings: {
      globalSmtpEnabled: Boolean(updatedUser.globalSmtpEnabled),
      globalSmtpHost: updatedUser.globalSmtpHost || "",
      globalSmtpPort: updatedUser.globalSmtpPort || 587,
      globalSmtpUser: updatedUser.globalSmtpUser || "",
      hasGlobalSmtpPass: Boolean(updatedUser.globalSmtpPass),
      globalSmtpFrom: updatedUser.globalSmtpFrom || "",
      globalGasUrl: updatedUser.globalGasUrl || "",
      globalWebhookUrl: updatedUser.globalWebhookUrl || "",
      notifyOnLogin: updatedUser.notifyOnLogin !== false,
      notifyOnSubmission: updatedUser.notifyOnSubmission !== false,
    },
  });
}
