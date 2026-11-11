"use client";

import { useCallback, useEffect, useState } from "react";

export interface RuleRow {
  id: string;
  sourceField: string;
  operator: string;
  value: string;
  action: string;
  targetField: string;
  position: number;
}

const OPERATORS: Array<{ value: string; label: string }> = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "in", label: "is one of (comma separated)" },
];

const ACTIONS: Array<{ value: string; label: string; hint: string }> = [
  { value: "hide", label: "Hide", hint: "The field disappears unless the condition matches." },
  { value: "show", label: "Show", hint: "The field stays hidden until the condition matches." },
  { value: "require", label: "Require", hint: "The field becomes mandatory when the condition matches." },
];

const EMPTY_RULE = (position: number): RuleRow => ({
  id: `new-${position}-${Math.random().toString(36).slice(2, 8)}`,
  sourceField: "",
  operator: "equals",
  value: "",
  action: "hide",
  targetField: "",
  position,
});

/**
 * Conditional-logic rule editor.
 *
 * The server re-evaluates every rule on submit and strips any field that a
 * matching `hide` rule (or an unmatched `show` rule) removes, so the editor
 * here is a convenience — never the enforcement point.
 */
export function RulesEditor({
  formId,
  fieldKeys,
  onSaved,
}: {
  formId: string;
  /** Field keys the form owns — used to build the dropdowns. */
  fieldKeys: string[];
  onSaved?: (count: number) => void;
}) {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/rules`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) setRules(data.data.rules ?? []);
    } catch {
      setMessage({ tone: "error", text: "Could not load rules." });
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/rules`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      if (data.ok) {
        setRules(data.data.rules ?? []);
        setMessage({ tone: "ok", text: `${data.data.count} rule(s) saved.` });
        onSaved?.(data.data.count);
      } else {
        setMessage({ tone: "error", text: data.message || "Failed to save rules." });
      }
    } catch {
      setMessage({ tone: "error", text: "Network error while saving rules." });
    } finally {
      setSaving(false);
    }
  }

  function updateRule(id: string, patch: Partial<RuleRow>) {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }

  function addRule() {
    setRules((prev) => [...prev, EMPTY_RULE(prev.length)]);
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-xs leading-5 text-slate-400">
          Rules run on the server for every submission. A field hidden by a rule is
          stripped from the stored payload, so it cannot be smuggled back in by a
          crafted request.
        </p>
        <button type="button" onClick={addRule} className="btn btn-ghost btn-sm">
          + Add rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-8 text-center">
          <p className="text-sm text-slate-400">No conditional logic yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Add a rule to show, hide, or require a field based on an answer.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {rules.map((rule) => (
          <RuleEditorRow
            key={rule.id}
            rule={rule}
            fieldKeys={fieldKeys}
            onChange={(patch) => updateRule(rule.id, patch)}
            onRemove={() => removeRule(rule.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? "Saving…" : "Save rules"}
        </button>
        {message && (
          <span
            className={`text-xs font-medium ${
              message.tone === "ok" ? "text-emerald-400" : "text-rose-400"
            }`}
            role="status"
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

function RuleEditorRow({
  rule,
  fieldKeys,
  onChange,
  onRemove,
}: {
  rule: RuleRow;
  fieldKeys: string[];
  onChange: (patch: Partial<RuleRow>) => void;
  onRemove: () => void;
}) {
  const needsValue = !["is_empty", "is_not_empty"].includes(rule.operator);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
      <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            When field
          </span>
          <FieldSelect
            value={rule.sourceField}
            onChange={(value) => onChange({ sourceField: value })}
            options={fieldKeys}
            placeholder="Select a field"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Condition
          </span>
          <select
            value={rule.operator}
            onChange={(e) => onChange({ operator: e.target.value })}
            className="ff-input !py-2 !text-xs"
          >
            {OPERATORS.map((operator) => (
              <option key={operator.value} value={operator.value} className="bg-slate-900">
                {operator.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Value
          </span>
          <input
            value={rule.value}
            onChange={(e) => onChange({ value: e.target.value })}
            disabled={!needsValue}
            placeholder={needsValue ? "Value" : "Not used"}
            className="ff-input !py-2 !text-xs disabled:opacity-40"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove rule"
            className="btn btn-danger btn-sm !px-3"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Action
          </span>
          <select
            value={rule.action}
            onChange={(e) => onChange({ action: e.target.value })}
            className="ff-input !py-2 !text-xs"
          >
            {ACTIONS.map((action) => (
              <option key={action.value} value={action.value} className="bg-slate-900">
                {action.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Target field
          </span>
          <FieldSelect
            value={rule.targetField}
            onChange={(value) => onChange({ targetField: value })}
            options={fieldKeys}
            placeholder="Select a field"
          />
        </label>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {ACTIONS.find((action) => action.value === rule.action)?.hint}
      </p>
    </div>
  );
}

function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  const list = options.length ? options : ["name", "email", "subject", "message"];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="ff-input !py-2 !text-xs"
    >
      <option value="" className="bg-slate-900">
        {placeholder}
      </option>
      {list.map((key) => (
        <option key={key} value={key} className="bg-slate-900">
          {key}
        </option>
      ))}
    </select>
  );
}
