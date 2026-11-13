import { and, asc, eq } from "drizzle-orm";
import type { AppDb } from "@/db";
import type { Form, FormWorkflow, Submission } from "@/db/schema";
import { renderMergeTags } from "./merge-tags";
import { isPrivateUrl, normalizeWebhookUrl } from "./url-validation";

export type WorkflowOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in";

export interface WorkflowCondition {
  field: string;
  operator: WorkflowOperator;
  value: string;
}

export interface WorkflowAction {
  id?: string;
  type: "autoresponder" | "webhook" | "slack" | "discord" | "google_sheets" | "tag";
  // Autoresponder
  to?: string;
  subject?: string;
  body?: string;
  replyTo?: string;
  // Webhook
  url?: string;
  headers?: Record<string, string>;
  payloadTemplate?: string;
  // Slack / Discord
  webhookUrl?: string;
  message?: string;
  // Google Sheets (GAS)
  gasUrl?: string;
  // Tagging
  tags?: string;
}

/** Maximum actions allowed per workflow execution to honor Edge subrequest budgets */
export const MAX_WORKFLOW_ACTIONS = 5;

/**
 * Evaluates a single workflow condition against the submission payload and metadata.
 */
export function evaluateCondition(
  condition: WorkflowCondition,
  data: Record<string, unknown>,
): boolean {
  const { field, operator, value } = condition;
  if (!field || typeof field !== "string") return true;

  // Resolve dot paths or top-level properties
  const keys = field.split(".");
  let current: any = data;
  for (const k of keys) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") {
      return false;
    }
    if (current && typeof current === "object" && k in current) {
      current = current[k];
    } else {
      current = undefined;
      break;
    }
  }

  const actualStr = current !== undefined && current !== null ? String(current).trim().toLowerCase() : "";
  const targetStr = value !== undefined && value !== null ? String(value).trim().toLowerCase() : "";

  switch (operator) {
    case "equals":
      return actualStr === targetStr;
    case "not_equals":
      return actualStr !== targetStr;
    case "contains":
      return actualStr.includes(targetStr);
    case "not_contains":
      return !actualStr.includes(targetStr);
    case "starts_with":
      return actualStr.startsWith(targetStr);
    case "ends_with":
      return actualStr.endsWith(targetStr);
    case "is_empty":
      return actualStr === "";
    case "is_not_empty":
      return actualStr !== "";
    case "gt": {
      const a = Number(actualStr);
      const b = Number(targetStr);
      return !isNaN(a) && !isNaN(b) && a > b;
    }
    case "gte": {
      const a = Number(actualStr);
      const b = Number(targetStr);
      return !isNaN(a) && !isNaN(b) && a >= b;
    }
    case "lt": {
      const a = Number(actualStr);
      const b = Number(targetStr);
      return !isNaN(a) && !isNaN(b) && a < b;
    }
    case "lte": {
      const a = Number(actualStr);
      const b = Number(targetStr);
      return !isNaN(a) && !isNaN(b) && a <= b;
    }
    case "in": {
      const list = targetStr.split(",").map((s) => s.trim().toLowerCase());
      return list.includes(actualStr);
    }
    default:
      return true;
  }
}

/**
 * Evaluates whether all conditions in a workflow match the given submission.
 */
export function evaluateAllConditions(
  conditionsJson: string,
  contextData: Record<string, unknown>,
): boolean {
  if (!conditionsJson || conditionsJson.trim() === "" || conditionsJson.trim() === "{}") {
    return true;
  }

  try {
    const parsed = JSON.parse(conditionsJson);
    const conditions: WorkflowCondition[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.conditions)
      ? parsed.conditions
      : [];

    if (!conditions.length) return true;

    // Conjunction: all conditions must match (AND)
    return conditions.every((cond) => evaluateCondition(cond, contextData));
  } catch {
    return true; // Fail open if JSON is malformed
  }
}

/**
 * Builds the combined evaluation context (payload + meta + form).
 */
export function buildWorkflowContext(
  form: Form,
  submission: Submission,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...payload,
    _form: {
      id: form.id,
      name: form.name,
      slug: form.slug,
      endpointId: form.endpointId,
    },
    _meta: {
      submissionId: submission.id,
      submittedAt: submission.createdAt,
      status: submission.status,
      email: submission.email || "",
      ipHash: submission.ipHash || "",
      spamScore: submission.spamScore,
    },
  };
}

/**
 * Executes an individual workflow action.
 */
async function executeAction(
  db: AppDb,
  form: Form,
  submission: Submission,
  action: WorkflowAction,
  contextData: Record<string, unknown>,
  appUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case "autoresponder": {
        const toEmail = action.to
          ? renderMergeTags(action.to, contextData)
          : submission.email || (contextData.email as string) || "";

        if (!toEmail || !toEmail.includes("@")) {
          return { success: false, error: "No recipient email found for autoresponder" };
        }

        const subject = renderMergeTags(action.subject || `Thank you for contacting ${form.name}`, contextData);
        const body = renderMergeTags(action.body || "We have received your submission. Thank you!", contextData, {
          escapeHtml: false,
        });

        const replyTo = action.replyTo ? renderMergeTags(action.replyTo, contextData) : undefined;

        const { sendSubmissionReply } = await import("./notifications");
        const ok = await sendSubmissionReply(form, toEmail, body, subject, replyTo);
        return { success: ok };
      }

      case "webhook": {
        if (!action.url) return { success: false, error: "Missing webhook URL" };
        const normalized = normalizeWebhookUrl(action.url);
        if (isPrivateUrl(normalized)) {
          return { success: false, error: "SSRF prevention: target URL is internal or private" };
        }

        // Custom templating or standard payload
        let bodyPayload: string;
        if (action.payloadTemplate && action.payloadTemplate.trim()) {
          bodyPayload = renderMergeTags(action.payloadTemplate, contextData);
        } else {
          bodyPayload = JSON.stringify({
            event: "form.workflow_dispatched",
            formId: form.id,
            formName: form.name,
            submissionId: submission.id,
            submittedAt: submission.createdAt,
            data: contextData,
          });
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "FormForge-Workflow/1.2",
          ...(action.headers || {}),
        };

        const res = await fetch(normalized, {
          method: "POST",
          headers,
          body: bodyPayload,
          redirect: "manual",
          signal: AbortSignal.timeout(6000),
        });

        return { success: res.ok || res.status === 302 || res.status === 301 };
      }

      case "slack":
      case "discord": {
        const hookUrl = action.webhookUrl || action.url;
        if (!hookUrl) return { success: false, error: "Missing webhook URL" };
        const normalized = normalizeWebhookUrl(hookUrl);
        if (isPrivateUrl(normalized)) {
          return { success: false, error: "SSRF prevention: target URL is internal" };
        }

        const customMsg = action.message
          ? renderMergeTags(action.message, contextData)
          : `✨ New Form Submission on *${form.name}*\nID: \`${submission.id}\``;

        let payloadBody: unknown;
        if (action.type === "slack") {
          payloadBody = {
            text: customMsg,
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: customMsg },
              },
            ],
          };
        } else {
          // Discord embed
          payloadBody = {
            content: customMsg,
            embeds: [
              {
                title: `Submission Received: ${form.name}`,
                color: 0x06b6d4, // Cyan
                fields: Object.entries(contextData)
                  .filter(([k]) => !k.startsWith("_") && typeof contextData[k] !== "object")
                  .slice(0, 8)
                  .map(([name, val]) => ({
                    name: String(name),
                    value: String(val).slice(0, 200) || "—",
                    inline: true,
                  })),
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }

        const res = await fetch(normalized, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadBody),
          redirect: "manual",
          signal: AbortSignal.timeout(6000),
        });

        return { success: res.ok };
      }

      case "google_sheets": {
        const { getRuntimeEnv } = await import("@/db");
        const env = getRuntimeEnv();
        const targetGas = (typeof action.gasUrl === "string" && action.gasUrl)
          ? action.gasUrl
          : (typeof form.gasUrl === "string" && form.gasUrl)
          ? form.gasUrl
          : (typeof env.GLOBAL_GAS_URL === "string" ? env.GLOBAL_GAS_URL : "");

        if (!targetGas || isPrivateUrl(targetGas)) {
          return { success: false, error: "Invalid or private Google Apps Script URL" };
        }

        const res = await fetch(targetGas, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "append_row",
            formId: form.id,
            formName: form.name,
            submissionId: submission.id,
            submittedAt: submission.createdAt,
            row: contextData,
          }),
          redirect: "manual",
          signal: AbortSignal.timeout(6000),
        });

        return { success: res.ok };
      }

      case "tag": {
        if (!action.tags) return { success: true };
        const newTags = action.tags.split(",").map((t) => t.trim()).filter(Boolean);
        const existingTags = form.tags ? form.tags.split(",").map((t) => t.trim()) : [];
        const merged = Array.from(new Set([...existingTags, ...newTags])).join(", ");

        const { forms } = await import("@/db/schema");
        await db
          .update(forms)
          .set({ tags: merged })
          .where(eq(forms.id, form.id));

        return { success: true };
      }

      default:
        return { success: false, error: `Unknown action type: ${(action as any).type}` };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Execution failure",
    };
  }
}

/**
 * Runs all active workflows for a form upon submission.
 * Enforces maximum of 5 total actions to protect edge subrequest budgets.
 */
export async function runFormWorkflows(
  db: AppDb,
  form: Form,
  submission: Submission,
  payload: Record<string, unknown>,
  appUrl?: string,
): Promise<{ executed: number; succeeded: number; failed: number }> {
  try {
    const { formWorkflows } = await import("@/db/schema");
    const activeWorkflows = await db
      .select()
      .from(formWorkflows)
      .where(
        and(
          eq(formWorkflows.formId, form.id),
          eq(formWorkflows.isActive, true),
          eq(formWorkflows.triggerEvent, "submission.created"),
        ),
      )
      .orderBy(asc(formWorkflows.position), asc(formWorkflows.createdAt));

    if (!activeWorkflows.length) {
      return { executed: 0, succeeded: 0, failed: 0 };
    }

    const contextData = buildWorkflowContext(form, submission, payload);
    let totalActionsExecuted = 0;
    let succeeded = 0;
    let failed = 0;

    for (const wf of activeWorkflows) {
      if (totalActionsExecuted >= MAX_WORKFLOW_ACTIONS) {
        break; // Hard edge subrequest guardrail
      }

      // Check condition filters
      const matches = evaluateAllConditions(wf.triggerConditions, contextData);
      if (!matches) continue;

      let actions: WorkflowAction[] = [];
      try {
        actions = JSON.parse(wf.actionsDefinition);
      } catch {
        continue;
      }

      if (!Array.isArray(actions) || !actions.length) continue;

      for (const action of actions) {
        if (totalActionsExecuted >= MAX_WORKFLOW_ACTIONS) break;
        totalActionsExecuted += 1;

        const result = await executeAction(db, form, submission, action, contextData, appUrl);
        if (result.success) {
          succeeded += 1;
        } else {
          failed += 1;
        }
      }
    }

    return { executed: totalActionsExecuted, succeeded, failed };
  } catch (err) {
    console.warn("runFormWorkflows error:", err);
    return { executed: 0, succeeded: 0, failed: 0 };
  }
}
