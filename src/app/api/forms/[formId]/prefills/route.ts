import { asc, eq } from "drizzle-orm";
import { auditLogs, formPrefills, forms } from "@/db/schema";
import { requireOwnedForm } from "@/lib/form-access";
import { randomId } from "@/lib/crypto";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { sanitizePrefillMappings } from "@/lib/prefill";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

/**
 * URL prefill + hidden-field mappings for a form.
 *
 * GET → list mappings
 * PUT → replace the whole mapping set
 */
export async function GET(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  try {
    const rows = await result.db
      .select()
      .from(formPrefills)
      .where(eq(formPrefills.formId, formId))
      .orderBy(asc(formPrefills.position), asc(formPrefills.createdAt));

    return jsonOk({ prefills: rows, captureUtm: result.form.captureUtm });
  } catch {
    return jsonError("DB_ERROR", "Failed to load prefill mappings.", 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const sanitized = sanitizePrefillMappings(body.prefills);

  try {
    await result.db.delete(formPrefills).where(eq(formPrefills.formId, formId));

    if (sanitized.length) {
      await result.db.insert(formPrefills).values(
        sanitized.map((mapping, index) => ({
          id: mapping.id ?? randomId("prefill"),
          formId,
          fieldKey: mapping.fieldKey,
          paramName: mapping.paramName,
          isHidden: Boolean(mapping.isHidden),
          position: index,
          createdAt: new Date().toISOString(),
        })),
      );
    }

    if (typeof body.captureUtm === "boolean") {
      await result.db
        .update(forms)
        .set({ captureUtm: body.captureUtm, updatedAt: new Date().toISOString() })
        .where(eq(forms.id, formId));
    }

    await result.db.insert(auditLogs).values({
      userId: result.user.id,
      formId,
      action: "form.prefills.updated",
      metadata: JSON.stringify({ count: sanitized.length }),
    });

    const rows = await result.db
      .select()
      .from(formPrefills)
      .where(eq(formPrefills.formId, formId))
      .orderBy(asc(formPrefills.position), asc(formPrefills.createdAt));

    return jsonOk({ prefills: rows, count: sanitized.length });
  } catch {
    return jsonError("DB_ERROR", "Failed to save prefill mappings.", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const [mapping] = sanitizePrefillMappings([body]);

  if (!mapping) {
    return jsonError(
      "INVALID_PREFILL",
      "A mapping needs a valid field key and URL parameter name.",
      400,
    );
  }

  try {
    const inserted = await result.db
      .insert(formPrefills)
      .values({
        id: randomId("prefill"),
        formId,
        fieldKey: mapping.fieldKey,
        paramName: mapping.paramName,
        isHidden: Boolean(mapping.isHidden),
        position: mapping.position ?? 0,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return jsonOk({ prefill: inserted[0] }, { status: 201 });
  } catch {
    return jsonError("DB_ERROR", "Failed to create prefill mapping.", 500);
  }
}
