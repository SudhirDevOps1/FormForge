import { asc, eq } from "drizzle-orm";
import { auditLogs, formRules } from "@/db/schema";
import { requireOwnedForm } from "@/lib/form-access";
import { randomId } from "@/lib/crypto";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { RULE_ACTIONS, RULE_OPERATORS, sanitizeRules } from "@/lib/rules";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

/**
 * Conditional-logic rules for a form.
 *
 * GET    → list the rules
 * PUT    → replace the whole rule set (the dashboard editor saves atomically)
 * POST   → append a single rule
 * DELETE → remove a single rule by id
 */
export async function GET(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  try {
    const rows = await result.db
      .select()
      .from(formRules)
      .where(eq(formRules.formId, formId))
      .orderBy(asc(formRules.position), asc(formRules.createdAt));

    return jsonOk({
      rules: rows,
      operators: RULE_OPERATORS,
      actions: RULE_ACTIONS,
    });
  } catch {
    return jsonError("DB_ERROR", "Failed to load conditional logic rules.", 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const sanitized = sanitizeRules(body.rules);

  try {
    await result.db.delete(formRules).where(eq(formRules.formId, formId));

    if (sanitized.length) {
      await result.db.insert(formRules).values(
        sanitized.map((rule, index) => ({
          id: rule.id ?? randomId("rule"),
          formId,
          sourceField: rule.sourceField,
          operator: rule.operator,
          value: rule.value,
          action: rule.action,
          targetField: rule.targetField,
          position: index,
          createdAt: new Date().toISOString(),
        })),
      );
    }

    await result.db.insert(auditLogs).values({
      userId: result.user.id,
      formId,
      action: "form.rules.updated",
      metadata: JSON.stringify({ count: sanitized.length }),
    });

    const rows = await result.db
      .select()
      .from(formRules)
      .where(eq(formRules.formId, formId))
      .orderBy(asc(formRules.position), asc(formRules.createdAt));

    return jsonOk({ rules: rows, count: sanitized.length });
  } catch {
    return jsonError("DB_ERROR", "Failed to save conditional logic rules.", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const [rule] = sanitizeRules([body]);

  if (!rule) {
    return jsonError(
      "INVALID_RULE",
      "A rule needs a valid source field, target field, operator and action.",
      400,
    );
  }

  try {
    const inserted = await result.db
      .insert(formRules)
      .values({
        id: randomId("rule"),
        formId,
        sourceField: rule.sourceField,
        operator: rule.operator,
        value: rule.value,
        action: rule.action,
        targetField: rule.targetField,
        position: rule.position ?? 0,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return jsonOk({ rule: inserted[0] }, { status: 201 });
  } catch {
    return jsonError("DB_ERROR", "Failed to create rule.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const url = new URL(request.url);
  const ruleId = url.searchParams.get("id");
  if (!ruleId) {
    return jsonError("MISSING_ID", "Provide the rule id to delete.", 400);
  }

  try {
    await result.db
      .delete(formRules)
      .where(eq(formRules.id, ruleId));

    await result.db.insert(auditLogs).values({
      userId: result.user.id,
      formId,
      action: "form.rule.deleted",
      metadata: JSON.stringify({ ruleId }),
    });

    return jsonOk({ deleted: true, id: ruleId });
  } catch {
    return jsonError("DB_ERROR", "Failed to delete rule.", 500);
  }
}
