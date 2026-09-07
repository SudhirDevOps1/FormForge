import type { AppDb } from "@/db";
import { sql } from "drizzle-orm";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[a-fA-F0-9:]+$/;

/**
 * Extract and sanitize client IP address with priority on tamper-proof Cloudflare edge headers.
 * Validates against IPv4 and IPv6 to prevent header injection or spoofing.
 */
export function getClientIp(request: Request): string {
  // 1. Cloudflare edge header (unspoofable on Cloudflare Workers / Pages)
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp && (IPV4_REGEX.test(cfIp) || (IPV6_REGEX.test(cfIp) && cfIp.includes(":")))) {
    return cfIp;
  }

  // 2. True-Client-IP (Enterprise reverse proxies)
  const trueIp = request.headers.get("true-client-ip")?.trim();
  if (trueIp && (IPV4_REGEX.test(trueIp) || (IPV6_REGEX.test(trueIp) && trueIp.includes(":")))) {
    return trueIp;
  }

  // 3. X-Real-IP
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && (IPV4_REGEX.test(realIp) || (IPV6_REGEX.test(realIp) && realIp.includes(":")))) {
    return realIp;
  }

  // 4. X-Forwarded-For (take the first client IP and strictly validate)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && (IPV4_REGEX.test(first) || (IPV6_REGEX.test(first) && first.includes(":")))) {
      return first;
    }
  }

  return "127.0.0.1";
}

export async function checkRateLimit(
  db: AppDb,
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000).toISOString();

  // Get existing rate limit entry
  const existing = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  const entry = existing[0];

  if (!entry || new Date(entry.resetAt) <= now) {
    // No entry or window expired — create/reset
    await db.insert(rateLimits)
      .values({ key, count: 1, resetAt, updatedAt: now.toISOString() })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: 1, resetAt, updatedAt: now.toISOString() },
      });
    return { allowed: true, remaining: maxAttempts - 1, resetAt };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  await db.update(rateLimits)
    .set({ count: sql`${rateLimits.count} + 1`, updatedAt: now.toISOString() })
    .where(eq(rateLimits.key, key));

  return { allowed: true, remaining: maxAttempts - entry.count - 1, resetAt: entry.resetAt };
}

export function rateLimitResponse(resetAt: string) {
  return Response.json(
    { ok: false, code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000)) } }
  );
}
