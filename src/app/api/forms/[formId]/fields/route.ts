import { asc, eq } from "drizzle-orm";
import { auditLogs, formFields } from "@/db/schema";
import { requireOwnedForm } from "@/lib/form-access";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { ALLOWED_FIELD_TYPES, sanitizeFields } from "@/lib/fields";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

export { ALLOWED_FIELD_TYPES };

/**
 * Custom form fields for hosted forms and dynamic schemas.
 *
 * GET → Fetch ordered field definitions for the form.
 * PUT → Replace the form's field list atomically.
 */
export async function GET(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  try {
    const rows = await result.db
      .select({
        id: formFields.id,
        key: formFields.fieldKey,
        label: formFields.label,
        type: formFields.type,
        required: formFields.required,
        position: formFields.position,
      })
      .from(formFields)
      .where(eq(formFields.formId, formId))
      .orderBy(asc(formFields.position), asc(formFields.id));

    return jsonOk({
      fields: rows.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        required: Boolean(f.required),
        position: f.position,
      })),
      allowedTypes: ALLOWED_FIELD_TYPES,
    });
  } catch (err: any) {
    return jsonError("DB_ERROR", err?.message || "Failed to load form fields.", 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const fields = sanitizeFields(body.fields);

  try {
    // Atomically replace all fields for this form
    await result.db.delete(formFields).where(eq(formFields.formId, formId));

    if (fields.length > 0) {
      await result.db.insert(formFields).values(
        fields.map((f, index) => ({
          formId,
          fieldKey: f.key,
          label: f.label,
          type: f.type || "text",
          required: Boolean(f.required),
          position: index,
          createdAt: new Date().toISOString(),
        })),
      );
    }

    try {
      await result.db.insert(auditLogs).values({
        userId: result.user.id,
        formId,
        action: "form.fields.updated",
        metadata: JSON.stringify({
          fieldCount: fields.length,
          ip: request.headers.get("cf-connecting-ip") || "unknown",
        }),
      });
    } catch {
      // Audit log error non-blocking
    }

    return jsonOk({
      fields,
      count: fields.length,
      message: "Form fields successfully saved.",
    });
  } catch (err: any) {
    return jsonError("DB_ERROR", err?.message || "Failed to save form fields.", 500);
  }
}
