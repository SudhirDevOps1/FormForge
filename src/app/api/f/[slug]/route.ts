import { NextResponse } from "next/server";
import { getDb, isDbReady } from "@/db";
import { forms } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const db = getDb();
  if (!db || !isDbReady(db)) {
    return NextResponse.json({ ok: false, message: "Database not ready" }, { status: 503 });
  }

  const { slug } = await context.params;
  const decodedSlug = decodeURIComponent(slug);

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

    const isClosed = form.submissionLimit && form.submissionLimit > 0
      ? form.submissionsCount >= form.submissionLimit
      : false;

    return NextResponse.json({
      ok: true,
      data: {
        id: form.id,
        name: form.name,
        slug: form.slug,
        endpointId: form.endpointId,
        description: form.description,
        successMessage: form.successMessage,
        redirectUrl: form.redirectUrl,
        altchaEnabled: form.altchaEnabled,
        maxAttachmentSizeMb: form.maxAttachmentSizeMb ?? 10,
        allowedFileExtensions: form.allowedFileExtensions ?? "",
        isClosed,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: "Failed to query form" }, { status: 500 });
  }
}
