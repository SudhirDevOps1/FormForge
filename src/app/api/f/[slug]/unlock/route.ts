import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, isDbReady } from "@/db";
import { forms } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createFormToken,
  verifyFormPassword,
} from "@/lib/form-password";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * Unlock a password-protected hosted form.
 *
 * POST { password } → { ok, token }
 *
 * The token is an HMAC bound to the form id with a 6-hour expiry. It is sent
 * back to the browser and replayed on submit; it never grants access to any
 * other form.
 */
export async function POST(request: Request, context: RouteContext) {
  const db = getDb();
  if (!db || !isDbReady(db)) {
    return NextResponse.json({ ok: false, message: "Database not ready" }, { status: 503 });
  }

  const { slug } = await context.params;
  const decodedSlug = decodeURIComponent(slug);

  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body" }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(forms)
      .where(
        or(
          eq(forms.slug, decodedSlug),
          eq(forms.endpointId, decodedSlug),
          eq(forms.id, decodedSlug)
        )
      )
      .limit(1);

    const form = rows[0];
    if (!form || !form.isActive) {
      return NextResponse.json({ ok: false, message: "Form not found or inactive" }, { status: 404 });
    }

    if (!form.passwordEnabled || !form.passwordHash) {
      return NextResponse.json({ ok: true, token: null, message: "This form is not password protected." });
    }

    // Throttle by client IP so the shared password cannot be brute-forced.
    const { getClientIp } = await import("@/lib/rate-limit");
    const ip = getClientIp(request);
    const limit = await checkRateLimit(db, `unlock:${form.id}:${ip}`, 10, 300);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, message: "Too many attempts. Please wait a few minutes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((new Date(limit.resetAt).getTime() - Date.now()) / 1000)),
            ),
          },
        },
      );
    }

    const password = typeof body.password === "string" ? body.password : "";
    const valid = await verifyFormPassword(password, form.passwordHash);

    if (!valid) {
      // Constant-ish response: no hint about the expected format or length.
      return NextResponse.json(
        { ok: false, message: "Incorrect password." },
        { status: 401 },
      );
    }

    const { getAuthSecret } = await import("@/lib/auth");
    const secret = getAuthSecret() || form.id;
    const token = await createFormToken(form.id, secret);

    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ ok: false, message: "Failed to unlock form" }, { status: 500 });
  }
}
