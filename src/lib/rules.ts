/**
 * FormForge conditional-logic engine.
 *
 * A rule reads one source field, compares it against a value, and applies an
 * action to a target field:
 *
 *   show    → the target field is hidden unless one of its `show` rules matches
 *   hide    → the target field is hidden when the rule matches
 *   require → the target field becomes required when the rule matches
 *
 * The engine is deliberately pure and dependency-free so the exact same code
 * runs in three places without drift:
 *
 *   1. `POST /api/submit/[endpointId]` — server-side enforcement. Hidden
 *      fields are stripped from the stored payload and never counted as
 *      required, so a crafted request cannot bypass the logic.
 *   2. `GET /api/f/[slug]` — the hosted form ships the resolved visibility map
 *      to the browser.
 *   3. The dashboard preview.
 */

import { isSafeFieldKey } from "./security";

export const RULE_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
] as const;

export type RuleOperator = (typeof RULE_OPERATORS)[number];

export const RULE_ACTIONS = ["show", "hide", "require"] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];

export interface FormRule {
  id?: string;
  sourceField: string;
  operator: string;
  value: string;
  action: string;
  targetField: string;
  position?: number;
}

export interface RuleEvaluation {
  /** Target fields that must not be shown or stored. */
  hidden: string[];
  /** Target fields that must carry a value. */
  required: string[];
  /** Target fields whose visibility was resolved by a matching `show` rule. */
  visible: string[];
  /** Human-readable trace of every rule that fired (dashboard + debugging). */
  matched: Array<{
    ruleId?: string;
    sourceField: string;
    operator: string;
    value: string;
    action: string;
    targetField: string;
  }>;
}

const OPERATOR_SET = new Set<string>(RULE_OPERATORS);
const ACTION_SET = new Set<string>(RULE_ACTIONS);

/**
 * Normalise a raw string into a comparable form.
 * Numbers are coerced so `age > 30` works when the field arrived as `"30"`.
 */
function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => normalize(v)).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Evaluate a single rule's condition against a payload.
 * Unknown operators never match — a malformed rule must not accidentally
 * hide or require a field.
 */
export function ruleMatches(rule: FormRule, payload: Record<string, unknown>): boolean {
  const source = normalize(payload[rule.sourceField]);
  const expected = rule.value ?? "";
  const operator = (rule.operator || "equals").toLowerCase();

  switch (operator) {
    case "equals":
      return source.trim().toLowerCase() === expected.trim().toLowerCase();
    case "not_equals":
      return source.trim().toLowerCase() !== expected.trim().toLowerCase();
    case "contains":
      return expected !== "" && source.toLowerCase().includes(expected.toLowerCase());
    case "not_contains":
      return expected !== "" && !source.toLowerCase().includes(expected.toLowerCase());
    case "starts_with":
      return expected !== "" && source.trim().toLowerCase().startsWith(expected.trim().toLowerCase());
    case "ends_with":
      return expected !== "" && source.trim().toLowerCase().endsWith(expected.trim().toLowerCase());
    case "is_empty":
      return source.trim() === "";
    case "is_not_empty":
      return source.trim() !== "";
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const left = toNumber(source);
      const right = toNumber(expected);
      if (left === null || right === null) return false;
      if (operator === "gt") return left > right;
      if (operator === "gte") return left >= right;
      if (operator === "lt") return left < right;
      return left <= right;
    }
    case "in": {
      const list = expected
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
      if (!list.length) return false;
      return list.includes(source.trim().toLowerCase());
    }
    default:
      return false;
  }
}

/** Drop rules with unsafe field names or unknown operators/actions. */
export function sanitizeRules(rules: unknown): FormRule[] {
  if (!Array.isArray(rules)) return [];
  const seen = new Set<string>();
  const clean: FormRule[] = [];

  for (const candidate of rules) {
    if (!candidate || typeof candidate !== "object") continue;
    const raw = candidate as Record<string, unknown>;

    const sourceField = typeof raw.sourceField === "string" ? raw.sourceField.trim() : "";
    const targetField = typeof raw.targetField === "string" ? raw.targetField.trim() : "";
    const operator = typeof raw.operator === "string" ? raw.operator.trim().toLowerCase() : "equals";
    const action = typeof raw.action === "string" ? raw.action.trim().toLowerCase() : "hide";
    const value = typeof raw.value === "string" ? raw.value : raw.value == null ? "" : String(raw.value);

    if (!isSafeFieldKey(sourceField) || !isSafeFieldKey(targetField)) continue;
    if (!OPERATOR_SET.has(operator) || !ACTION_SET.has(action)) continue;
    if (sourceField === targetField) continue;

    // Prevent duplicate rules collapsing the same target/condition.
    const signature = `${sourceField}|${operator}|${value}|${action}|${targetField}`;
    if (seen.has(signature)) continue;
    seen.add(signature);

    clean.push({
      id: typeof raw.id === "string" ? raw.id : undefined,
      sourceField,
      operator,
      value: value.slice(0, 512),
      action,
      targetField,
      position: typeof raw.position === "number" ? raw.position : 0,
    });
  }

  return clean;
}

/**
 * Resolve a set of rules against a payload.
 *
 * Semantics:
 *  - A target field mentioned by a `show` rule is **hidden by default** and
 *    becomes visible only when one of its `show` rules matches.
 *  - A matching `hide` rule always hides, even for conditionally-shown fields.
 *  - A matching `require` rule makes the target required — unless the target
 *    ends up hidden, in which case "required" is meaningless and ignored.
 */
export function evaluateRules(rules: FormRule[], payload: Record<string, unknown>): RuleEvaluation {
  const valid = sanitizeRules(rules);
  const hidden = new Set<string>();
  const required = new Set<string>();
  const visible = new Set<string>();
  const matched: RuleEvaluation["matched"] = [];

  const conditionalShowTargets = new Set<string>();
  for (const rule of valid) {
    if (rule.action === "show") conditionalShowTargets.add(rule.targetField);
  }

  for (const rule of valid) {
    if (!ruleMatches(rule, payload)) continue;

    matched.push({
      ruleId: rule.id,
      sourceField: rule.sourceField,
      operator: rule.operator,
      value: rule.value,
      action: rule.action,
      targetField: rule.targetField,
    });

    if (rule.action === "hide") {
      hidden.add(rule.targetField);
    } else if (rule.action === "show") {
      visible.add(rule.targetField);
    } else if (rule.action === "require") {
      required.add(rule.targetField);
    }
  }

  // Conditionally-shown fields stay hidden unless a `show` rule fired.
  for (const target of conditionalShowTargets) {
    if (!visible.has(target)) {
      hidden.add(target);
    }
  }

  // A hidden field can never be required.
  for (const target of hidden) {
    required.delete(target);
  }

  return {
    hidden: [...hidden],
    required: [...required],
    visible: [...visible],
    matched,
  };
}

/**
 * Apply the evaluation to a payload: strip hidden fields and report which
 * required fields are missing.
 *
 * This is the server-side enforcement point — the browser's own view of the
 * form is advisory only.
 */
export function applyRules(
  rules: FormRule[],
  payload: Record<string, unknown>,
): { sanitized: Record<string, unknown>; evaluation: RuleEvaluation; missingRequired: string[] } {
  const evaluation = evaluateRules(rules, payload);
  const hiddenSet = new Set(evaluation.hidden);
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (hiddenSet.has(key)) continue;
    sanitized[key] = value;
  }

  const missingRequired = evaluation.required.filter((key) => {
    const value = sanitized[key];
    if (value === undefined || value === null) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  });

  return { sanitized, evaluation, missingRequired };
}
