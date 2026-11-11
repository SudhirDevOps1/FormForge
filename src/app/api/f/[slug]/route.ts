import { NextResponse } from "next/server";
import { getDb, isDbReady } from "@/db";
import { formFields, formPrefills, formRules, forms } from "@/db/schema";
import { asc, eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * Public definition of a hosted form.
 *
 * Everything returned here is public by design — it is what the hosted page
 * needs to render. Secrets (SMTP credentials, the form password hash, the
 * webhook secret) are never included.
 */
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

    const limitReached =
      form.submissionLimit && form.submissionLimit > 0
        ? form.submissionsCount >= form.submissionLimit
        : false;

    const closedByDate =
      Boolean(form.closeAt) && new Date(form.closeAt as string).getTime() <= Date.now();

    const isClosed = limitReached || closedByDate;

    // Conditional-logic rules drive the client's field visibility.
    const rules = await db
      .select({
        id: formRules.id,
        sourceField: formRules.sourceField,
        operator: formRules.operator,
        value: formRules.value,
        action: formRules.action,
        targetField: formRules.targetField,
        position: formRules.position,
      })
      .from(formRules)
      .where(eq(formRules.formId, form.id))
      .orderBy(asc(formRules.position));

    // Prefill mappings tell the hosted page which query parameters to read.
    const prefills = await db
      .select({
        id: formPrefills.id,
        fieldKey: formPrefills.fieldKey,
        paramName: formPrefills.paramName,
        isHidden: formPrefills.isHidden,
      })
      .from(formPrefills)
      .where(eq(formPrefills.formId, form.id))
      .orderBy(asc(formPrefills.position));

    // The owner-defined field list. When it is empty the hosted page falls
    // back to the classic name/email/subject/message layout.
    const fieldRows = await db
      .select({
        id: formFields.id,
        key: formFields.fieldKey,
        label: formFields.label,
        type: formFields.type,
        required: formFields.required,
        position: formFields.position,
      })
      .from(formFields)
      .where(eq(formFields.formId, form.id))
      .orderBy(asc(formFields.position));

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
        otpEnabled: Boolean(form.otpEnabled),
        maxAttachmentSizeMb: form.maxAttachmentSizeMb ?? 10,
        allowedFileExtensions: form.allowedFileExtensions ?? "",
        displayMode: form.displayMode || "classic",
        isClosed,
        closedByDate,
        closeAt: form.closeAt ?? null,
        // Password-gated forms expose only the fact that a password is needed.
        passwordRequired: Boolean(form.passwordEnabled),
        captureUtm: Boolean(form.captureUtm),
        partialSubmissionsEnabled: Boolean(form.partialSubmissionsEnabled),
        rules,
        prefills,
        fields: fieldRows.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          required: Boolean(field.required),
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: "Failed to query form" }, { status: 500 });
  }
}
