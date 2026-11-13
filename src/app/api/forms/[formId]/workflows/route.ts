import { asc, eq } from "drizzle-orm";
import { formWorkflows } from "@/db/schema";
import { requireOwnedForm } from "@/lib/form-access";
import { randomId } from "@/lib/crypto";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string }> };

/**
 * Visual automated workflows for a form.
 *
 * GET  → list all workflows
 * POST → create a new workflow
 * PUT  → bulk replace / reorder workflows
 */
export async function GET(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  try {
    const rows = await result.db
      .select()
      .from(formWorkflows)
      .where(eq(formWorkflows.formId, formId))
      .orderBy(asc(formWorkflows.position), asc(formWorkflows.createdAt));

    return jsonOk({ workflows: rows, count: rows.length });
  } catch (err: any) {
    return jsonError("DB_ERROR", err?.message || "Failed to load workflows.", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 100) : "New Workflow";
  const triggerEvent = body.triggerEvent === "submission.verified" ? "submission.verified" : "submission.created";
  const triggerConditions = typeof body.triggerConditions === "string" ? body.triggerConditions : JSON.stringify(body.triggerConditions || {});
  const actionsDefinition = typeof body.actionsDefinition === "string" ? body.actionsDefinition : JSON.stringify(body.actionsDefinition || []);
  const isActive = body.isActive !== false;
  const position = typeof body.position === "number" ? body.position : 0;

  const id = randomId("wf");

  try {
    const newRecord = {
      id,
      formId,
      name,
      triggerEvent,
      triggerConditions,
      actionsDefinition,
      isActive,
      position,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await result.db.insert(formWorkflows).values(newRecord);

    return jsonOk({ id, workflow: newRecord, message: "Workflow created successfully" }, { status: 201 });
  } catch (err: any) {
    return jsonError("DB_ERROR", err?.message || "Failed to create workflow.", 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { formId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const workflowsList = Array.isArray(body.workflows) ? body.workflows : [];

  try {
    // Delete existing workflows for the form and re-insert the provided list
    await result.db.delete(formWorkflows).where(eq(formWorkflows.formId, formId));

    if (workflowsList.length) {
      await result.db.insert(formWorkflows).values(
        workflowsList.map((wf: any, index: number) => ({
          id: wf.id && !wf.id.startsWith("new-") ? wf.id : randomId("wf"),
          formId,
          name: typeof wf.name === "string" && wf.name.trim() ? wf.name.trim().slice(0, 100) : `Workflow ${index + 1}`,
          triggerEvent: wf.triggerEvent === "submission.verified" ? "submission.verified" : "submission.created",
          triggerConditions: typeof wf.triggerConditions === "string" ? wf.triggerConditions : JSON.stringify(wf.triggerConditions || {}),
          actionsDefinition: typeof wf.actionsDefinition === "string" ? wf.actionsDefinition : JSON.stringify(wf.actionsDefinition || []),
          isActive: wf.isActive !== false,
          position: index,
          createdAt: wf.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      );
    }

    const updatedRows = await result.db
      .select()
      .from(formWorkflows)
      .where(eq(formWorkflows.formId, formId))
      .orderBy(asc(formWorkflows.position), asc(formWorkflows.createdAt));

    return jsonOk({
      message: "Workflows saved successfully",
      count: updatedRows.length,
      workflows: updatedRows,
    });
  } catch (err: any) {
    return jsonError("DB_ERROR", err?.message || "Failed to update workflows.", 500);
  }
}
