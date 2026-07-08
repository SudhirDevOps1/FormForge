import { randomId } from "./crypto";

export type JsonRecord = Record<string, unknown>;

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return Response.json({ ok: true, data }, { ...init, headers });
}

export function jsonError(code: string, message: string, status = 400, details?: JsonRecord): Response {
  return Response.json({ ok: false, code, message, details }, { status });
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();
  // Require at least 2 character TLD for proper validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return null;
  }

  return email;
}

export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export async function readJson(request: Request): Promise<JsonRecord> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as JsonRecord) : {};
  } catch {
    return {};
  }
}

export async function readJsonOrNull(request: Request): Promise<JsonRecord | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as JsonRecord) : null;
  } catch {
    return null;
  }
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);

  return slug || randomId("form").toLowerCase();
}

export function endpointId(): string {
  return randomId("endpoint");
}

export function splitOrigins(value: string | null | undefined): string[] {
  if (!value || value.trim() === "*") {
    return ["*"];
  }

  return value
    .split(/[\n,]/)
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigin(allowedOrigins: string, requestOrigin: string | null): string | null {
  const origins = splitOrigins(allowedOrigins);

  if (origins.includes("*")) {
    return requestOrigin ?? "*";
  }

  if (requestOrigin && origins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}

export function corsHeaders(allowedOrigin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-FormForge-Pow, X-FormForge-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function csvEscape(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
