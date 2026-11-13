import { and, eq } from "drizzle-orm";
import { formWorkflows } from "@/db/schema";
import { requireOwnedForm } from "@/lib/form-access";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ formId: string; workflowId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { formId, workflowId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  const body = await readJson(request);
  const updates: Partial<{
    name: string;
    triggerEvent: string;
    triggerConditions: string;
    actionsDefinition: string;
    isActive: boolean;
    position: number;
    updatedAt: string;
  }> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.name === "string") updates.name = body.name.trim().slice(0, 100);
  if (typeof body.triggerEvent === "string") updates.triggerEvent = body.triggerEvent;
  if (body.triggerConditions !== undefined) {
    updates.triggerConditions = typeof body.triggerConditions === "string"
      ? body.triggerConditions
      : JSON.stringify(body.triggerConditions);
  }
  if (body.actionsDefinition !== undefined) {
    updates.actionsDefinition = typeof body.actionsDefinition === "string"
      ? body.actionsDefinition
      : JSON.stringify(body.actionsDefinition);
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (typeof body.position === "number") updates.position = body.position;

  try {
    await result.db
      .update(formWorkflows)
      .set(updates)
      .where(and(eq(formWorkflows.id, workflowId), eq(formWorkflows.formId, formId)));

    return jsonOk({ message: "Workflow updated successfully" });
  } catch {
    return jsonError("DB_ERROR", "Failed to update workflow.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { formId, workflowId } = await context.params;
  const result = await requireOwnedForm(request, formId);
  if ("response" in result) return result.response;

  try {
    await result.db
      .delete(formWorkflows)
      .where(and(eq(formWorkflows.id, workflowId), eq(formWorkflows.formId, formId)));

    return jsonOk({ message: "Workflow deleted successfully" });
  } catch {
    return jsonError("DB_ERROR", "Failed to delete workflow.", 500);
  }
}
