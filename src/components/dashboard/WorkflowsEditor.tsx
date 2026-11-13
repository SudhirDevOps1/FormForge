"use client";

import { useCallback, useEffect, useState } from "react";
import type { Form } from "@/db/schema";
import { ZapIcon, TrashIcon, SparklesIcon, CheckCircleIcon, PlusIcon } from "@/components/icons";

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: string;
}

export interface WorkflowAction {
  id?: string;
  type: "autoresponder" | "webhook" | "slack" | "discord" | "google_sheets" | "tag";
  to?: string;
  subject?: string;
  body?: string;
  replyTo?: string;
  url?: string;
  headers?: Record<string, string>;
  payloadTemplate?: string;
  webhookUrl?: string;
  message?: string;
  gasUrl?: string;
  tags?: string;
}

export interface WorkflowItem {
  id: string;
  name: string;
  triggerEvent: string;
  triggerConditions: string;
  actionsDefinition: string;
  isActive: boolean;
  position: number;
}

const CONDITION_OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "gt", label: "greater than (>)" },
  { value: "lt", label: "less than (<)" },
  { value: "in", label: "is in (comma-separated)" },
];

export function WorkflowsEditor({
  formId,
  form,
}: {
  formId: string;
  form: { id: string; name: string; slug?: string; gasUrl?: string | null; [key: string]: any };
}) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Test simulation state
  const [testPayload, setTestPayload] = useState(
    JSON.stringify({ name: "Alex Mercer", email: "alex@example.com", topic: "Sales", budget: "7500" }, null, 2),
  );
  const [simulating, setSimulating] = useState(false);
  const [simResults, setSimResults] = useState<Array<{ step: string; status: "match" | "skip" | "executed"; details: string }>>([]);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/forms/${formId}/workflows`);
      if (!res.ok) throw new Error("Failed to load workflows");
      const data = await res.json();
      setWorkflows(data.workflows || []);
      if (data.workflows?.length && !editingId) {
        setEditingId(data.workflows[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, [formId, editingId]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleAddWorkflow = () => {
    const newId = `new-${Date.now()}`;
    const defaultActions: WorkflowAction[] = [
      {
        id: `act-1`,
        type: "autoresponder",
        subject: `Thank you for reaching out, {{name | 'there'}}!`,
        body: `Hi {{name | 'Friend'}},\n\nWe received your inquiry regarding {{topic | 'our services'}}. Our team will get back to you shortly.\n\nBest regards,\n${form.name}`,
      },
    ];

    const newWf: WorkflowItem = {
      id: newId,
      name: `Automation ${workflows.length + 1}`,
      triggerEvent: "submission.created",
      triggerConditions: JSON.stringify([
        { field: "email", operator: "is_not_empty", value: "" },
      ]),
      actionsDefinition: JSON.stringify(defaultActions),
      isActive: true,
      position: workflows.length,
    };

    setWorkflows([...workflows, newWf]);
    setEditingId(newId);
  };

  const handleSaveWorkflows = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/forms/${formId}/workflows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflows }),
      });
      if (!res.ok) throw new Error("Failed to save workflows");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workflows");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = (id: string) => {
    const filtered = workflows.filter((w) => w.id !== id);
    setWorkflows(filtered);
    if (editingId === id) {
      setEditingId(filtered.length ? filtered[0].id : null);
    }
  };

  const updateCurrentWorkflow = (updater: (wf: WorkflowItem) => WorkflowItem) => {
    setWorkflows(workflows.map((w) => (w.id === editingId ? updater(w) : w)));
  };

  const currentWf = workflows.find((w) => w.id === editingId);

  // Helper to parse conditions & actions
  let currentConditions: WorkflowCondition[] = [];
  let currentActions: WorkflowAction[] = [];
  if (currentWf) {
    try {
      const parsed = JSON.parse(currentWf.triggerConditions);
      currentConditions = Array.isArray(parsed) ? parsed : [];
    } catch {
      currentConditions = [];
    }
    try {
      const parsed = JSON.parse(currentWf.actionsDefinition);
      currentActions = Array.isArray(parsed) ? parsed : [];
    } catch {
      currentActions = [];
    }
  }

  const handleRunSimulation = () => {
    if (!currentWf) return;
    setSimulating(true);
    try {
      const payload = JSON.parse(testPayload);
      const results: Array<{ step: string; status: "match" | "skip" | "executed"; details: string }> = [];

      // 1. Evaluate conditions
      let allMatch = true;
      for (const cond of currentConditions) {
        const val = payload[cond.field];
        const strVal = String(val ?? "").toLowerCase();
        const tgt = cond.value.toLowerCase();
        let match = false;
        if (cond.operator === "equals") match = strVal === tgt;
        else if (cond.operator === "contains") match = strVal.includes(tgt);
        else if (cond.operator === "is_not_empty") match = strVal.length > 0;
        else if (cond.operator === "gt") match = Number(strVal) > Number(tgt);
        else match = true;

        results.push({
          step: `Condition: ${cond.field} ${cond.operator} "${cond.value}"`,
          status: match ? "match" : "skip",
          details: `Payload field "${cond.field}" was "${val}". Evaluated to ${match ? "TRUE" : "FALSE"}`,
        });

        if (!match) allMatch = false;
      }

      // 2. Simulate actions
      if (allMatch) {
        for (const act of currentActions) {
          let preview = "";
          if (act.type === "autoresponder") {
            const subj = (act.subject || "").replace(/\{\{\s*([a-zA-Z0-9_.-]+)(?:\s*\|\s*'([^']*)')?\s*\}\}/g, (_, k, def) => payload[k] || def || "");
            preview = `Subject: "${subj}", To: ${payload.email || "recipient@domain"}`;
          } else if (act.type === "webhook") {
            preview = `Target: ${act.url || "https://..."}`;
          } else if (act.type === "slack" || act.type === "discord") {
            preview = `Channel Alert: ${act.message || "New Form Submission"}`;
          } else if (act.type === "google_sheets") {
            preview = `Appends row to Google Sheets via GAS`;
          }
          results.push({
            step: `Action: ${act.type.toUpperCase()}`,
            status: "executed",
            details: preview,
          });
        }
      } else {
        results.push({
          step: "Workflow Actions Blocked",
          status: "skip",
          details: "Conditions did not match; actions were safely skipped.",
        });
      }

      setSimResults(results);
    } catch (e) {
      setSimResults([
        {
          step: "JSON Syntax Error",
          status: "skip",
          details: "Could not parse simulation payload. Please verify JSON format.",
        },
      ]);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <svg className="h-5 w-5 animate-spin mr-2 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" strokeWidth="3" className="opacity-75" />
        </svg>
        Loading automated workflows...
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Top Banner & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-500/30 bg-violet-950/20 p-5 shadow-xl shadow-violet-950/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
              <ZapIcon className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-base font-bold text-white">Visual Automated Workflows</h3>
            <span className="rounded-full bg-violet-500/20 border border-violet-400/30 px-2 py-0.5 text-[10px] font-bold text-violet-300 uppercase tracking-wide">
              Premium Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            Trigger dynamic multi-step automations upon submission: auto-responders with merge tags, custom webhooks, Slack/Discord alerts, and Google Sheets sync with zero card required.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleAddWorkflow}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition"
          >
            <span>+</span>
            <span>New Workflow</span>
          </button>
          <button
            type="button"
            onClick={handleSaveWorkflows}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : saveSuccess ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      {workflows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400 mb-3">
            <ZapIcon className="w-6 h-6 text-slate-500" />
          </div>
          <h4 className="text-sm font-bold text-white">No active workflows</h4>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
            Set up an auto-responder, trigger webhooks, or route leads automatically when respondents submit this form.
          </p>
          <button
            type="button"
            onClick={handleAddWorkflow}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition"
          >
            Create your first workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Workflow List Sidebar */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Workflows ({workflows.length})
            </div>
            {workflows.map((wf) => (
              <div
                key={wf.id}
                onClick={() => setEditingId(wf.id)}
                className={`group flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                  editingId === wf.id
                    ? "border-violet-500/50 bg-violet-500/10 shadow-lg shadow-violet-500/5"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className={`h-2 w-2 rounded-full ${wf.isActive ? "bg-emerald-400" : "bg-slate-600"}`} />
                  <div className="truncate">
                    <div className="text-xs font-bold text-white truncate">{wf.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Event: <span className="font-mono text-cyan-300">{wf.triggerEvent}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateCurrentWorkflow((w) => ({ ...w, isActive: !w.isActive }));
                    }}
                    title={wf.isActive ? "Pause Workflow" : "Enable Workflow"}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {wf.isActive ? "⏸" : "▶"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkflow(wf.id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400"
                    title="Delete workflow"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Workflow Builder Panel */}
          {currentWf ? (
            <div className="lg:col-span-8 space-y-6">
              {/* Workflow Details Header */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Workflow Name
                    </label>
                    <input
                      type="text"
                      value={currentWf.name}
                      onChange={(e) => updateCurrentWorkflow((w) => ({ ...w, name: e.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => updateCurrentWorkflow((w) => ({ ...w, isActive: !w.isActive }))}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        currentWf.isActive
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {currentWf.isActive ? "✓ Active" : "Paused"}
                    </button>
                  </div>
                </div>

                {/* Step 1: Trigger Node */}
                <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500 text-[10px] font-bold text-white">1</span>
                    <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Trigger</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    When a new submission is <strong className="text-white">received and accepted</strong> on this form.
                  </p>
                </div>

                {/* Step 2: Conditions (Filters) */}
                <div className="p-4 rounded-xl border border-white/10 bg-black/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500 text-[10px] font-bold text-white">2</span>
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Conditions &amp; Filters</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newCond: WorkflowCondition = { field: "email", operator: "is_not_empty", value: "" };
                        const updated = [...currentConditions, newCond];
                        updateCurrentWorkflow((w) => ({ ...w, triggerConditions: JSON.stringify(updated) }));
                      }}
                      className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold"
                    >
                      + Add Condition
                    </button>
                  </div>

                  {currentConditions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      No filter conditions set. This workflow will execute on <strong className="text-slate-300">every valid submission</strong>.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {currentConditions.map((cond, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 bg-white/5 p-2 rounded-xl">
                          <input
                            type="text"
                            placeholder="field name (e.g. topic)"
                            value={cond.field}
                            onChange={(e) => {
                              const updated = [...currentConditions];
                              updated[idx].field = e.target.value;
                              updateCurrentWorkflow((w) => ({ ...w, triggerConditions: JSON.stringify(updated) }));
                            }}
                            className="w-36 rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                          />

                          <select
                            value={cond.operator}
                            onChange={(e) => {
                              const updated = [...currentConditions];
                              updated[idx].operator = e.target.value;
                              updateCurrentWorkflow((w) => ({ ...w, triggerConditions: JSON.stringify(updated) }));
                            }}
                            className="rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-white focus:outline-none"
                          >
                            {CONDITION_OPERATORS.map((op) => (
                              <option key={op.value} value={op.value} className="bg-slate-900 text-white">
                                {op.label}
                              </option>
                            ))}
                          </select>

                          {cond.operator !== "is_empty" && cond.operator !== "is_not_empty" && (
                            <input
                              type="text"
                              placeholder="comparison value"
                              value={cond.value}
                              onChange={(e) => {
                                const updated = [...currentConditions];
                                updated[idx].value = e.target.value;
                                updateCurrentWorkflow((w) => ({ ...w, triggerConditions: JSON.stringify(updated) }));
                              }}
                              className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-black/50 px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const updated = currentConditions.filter((_, i) => i !== idx);
                              updateCurrentWorkflow((w) => ({ ...w, triggerConditions: JSON.stringify(updated) }));
                            }}
                            className="text-slate-400 hover:text-rose-400 px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 3: Actions Pipeline */}
                <div className="p-4 rounded-xl border border-white/10 bg-black/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-[10px] font-bold text-white">3</span>
                      <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Automated Actions (Max 5)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          const actionType = e.target.value as WorkflowAction["type"];
                          if (!actionType) return;
                          if (currentActions.length >= 5) {
                            alert("Edge quota limit: Maximum 5 actions allowed per workflow to prevent Worker subrequest exhaustion.");
                            return;
                          }
                          const newAction: WorkflowAction = {
                            id: `act-${Date.now()}`,
                            type: actionType,
                            subject: actionType === "autoresponder" ? `Thank you for reaching out to ${form.name}` : undefined,
                            body: actionType === "autoresponder" ? `Hi {{name | 'there'}},\n\nWe got your message: "{{message}}".\n\nThanks!` : undefined,
                          };
                          const updated = [...currentActions, newAction];
                          updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                          e.target.value = "";
                        }}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-xs text-emerald-300 font-semibold focus:outline-none"
                        defaultValue=""
                      >
                        <option value="" disabled>+ Add Action...</option>
                        <option value="autoresponder" className="bg-slate-900 text-white">📧 Auto-Responder Email</option>
                        <option value="webhook" className="bg-slate-900 text-white">🌐 Custom Webhook 2.0</option>
                        <option value="slack" className="bg-slate-900 text-white">💬 Slack Alert</option>
                        <option value="discord" className="bg-slate-900 text-white">👾 Discord Embed</option>
                        <option value="google_sheets" className="bg-slate-900 text-white">📊 Google Sheets Sync</option>
                        <option value="tag" className="bg-slate-900 text-white">🏷️ Auto-Tag Form</option>
                      </select>
                    </div>
                  </div>

                  {currentActions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No actions configured. Add an action above to complete the automation.</p>
                  ) : (
                    <div className="space-y-3">
                      {currentActions.map((act, actIdx) => (
                        <div key={act.id || actIdx} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                              {act.type === "autoresponder" && "📧 Auto-Responder Email"}
                              {act.type === "webhook" && "🌐 Custom Webhook (HTTP POST)"}
                              {act.type === "slack" && "💬 Slack Block Kit Notification"}
                              {act.type === "discord" && "👾 Discord Embed Alert"}
                              {act.type === "google_sheets" && "📊 Google Sheets Row Append"}
                              {act.type === "tag" && "🏷️ Auto-Tag Submission"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = currentActions.filter((_, i) => i !== actIdx);
                                updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                              }}
                              className="text-xs text-slate-400 hover:text-rose-400"
                            >
                              Remove
                            </button>
                          </div>

                          {act.type === "autoresponder" && (
                            <div className="space-y-2 text-xs">
                              <div>
                                <label className="block text-slate-400 mb-1">Subject (supports merge tags)</label>
                                <input
                                  type="text"
                                  value={act.subject || ""}
                                  onChange={(e) => {
                                    const updated = [...currentActions];
                                    updated[actIdx].subject = e.target.value;
                                    updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                  }}
                                  placeholder="e.g. Thanks for your inquiry, {{name | 'Customer'}}!"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Email Body (supports merge tags like {"{{name}}"}, {"{{email}}"})</label>
                                <textarea
                                  rows={3}
                                  value={act.body || ""}
                                  onChange={(e) => {
                                    const updated = [...currentActions];
                                    updated[actIdx].body = e.target.value;
                                    updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                  }}
                                  placeholder="Write your confirmation message..."
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          )}

                          {act.type === "webhook" && (
                            <div className="space-y-2 text-xs">
                              <div>
                                <label className="block text-slate-400 mb-1">Webhook URL</label>
                                <input
                                  type="url"
                                  value={act.url || ""}
                                  onChange={(e) => {
                                    const updated = [...currentActions];
                                    updated[actIdx].url = e.target.value;
                                    updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                  }}
                                  placeholder="https://api.yourdomain.com/form-intake"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none font-mono text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Custom Payload Template (JSON with merge tags, leave empty for full payload)</label>
                                <textarea
                                  rows={2}
                                  value={act.payloadTemplate || ""}
                                  onChange={(e) => {
                                    const updated = [...currentActions];
                                    updated[actIdx].payloadTemplate = e.target.value;
                                    updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                  }}
                                  placeholder='{"lead": {"name": "{{name}}", "email": "{{email}}"}}'
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          )}

                          {(act.type === "slack" || act.type === "discord") && (
                            <div className="space-y-2 text-xs">
                              <div>
                                <label className="block text-slate-400 mb-1">{act.type === "slack" ? "Slack Webhook URL" : "Discord Webhook URL"}</label>
                                <input
                                  type="url"
                                  value={act.webhookUrl || ""}
                                  onChange={(e) => {
                                    const updated = [...currentActions];
                                    updated[actIdx].webhookUrl = e.target.value;
                                    updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                  }}
                                  placeholder={act.type === "slack" ? "https://hooks.slack.com/services/..." : "https://discord.com/api/webhooks/..."}
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none font-mono text-[11px]"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-400 mb-1">Alert Message</label>
                                <input
                                  type="text"
                                  value={act.message || ""}
                                  onChange={(e) => {
                                    const updated = [...currentActions];
                                    updated[actIdx].message = e.target.value;
                                    updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                  }}
                                  placeholder="🚀 New lead from {{name}} (Budget: ${{budget}})"
                                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {act.type === "google_sheets" && (
                            <div className="space-y-2 text-xs">
                              <label className="block text-slate-400 mb-1">Google Apps Script Web App URL</label>
                              <input
                                type="url"
                                value={act.gasUrl || form.gasUrl || ""}
                                onChange={(e) => {
                                  const updated = [...currentActions];
                                  updated[actIdx].gasUrl = e.target.value;
                                  updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                }}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none font-mono text-[11px]"
                              />
                            </div>
                          )}

                          {act.type === "tag" && (
                            <div className="space-y-2 text-xs">
                              <label className="block text-slate-400 mb-1">Tags to append (comma separated)</label>
                              <input
                                type="text"
                                value={act.tags || ""}
                                onChange={(e) => {
                                  const updated = [...currentActions];
                                  updated[actIdx].tags = e.target.value;
                                  updateCurrentWorkflow((w) => ({ ...w, actionsDefinition: JSON.stringify(updated) }));
                                }}
                                placeholder="VIP, High-Priority, Sales-Lead"
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-white placeholder-slate-600 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4: Interactive Live Simulator */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500">
                      <SparklesIcon className="w-3 h-3 text-white" />
                    </span>
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Test &amp; Live Simulation</h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunSimulation}
                    disabled={simulating}
                    className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition"
                  >
                    ▶ Run Simulation
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Mock Submission Payload (JSON)
                    </label>
                    <textarea
                      rows={6}
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/50 p-2.5 font-mono text-[11px] text-emerald-300 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Simulation Output
                    </label>
                    <div className="min-h-[140px] rounded-xl border border-white/10 bg-black/40 p-2.5 space-y-2 font-mono text-[11px]">
                      {simResults.length === 0 ? (
                        <span className="text-slate-500 italic">Click "Run Simulation" to test conditions and view merge tag outputs.</span>
                      ) : (
                        simResults.map((res, i) => (
                          <div key={i} className="border-b border-white/5 pb-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{res.step}</span>
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  res.status === "match" || res.status === "executed"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-slate-700 text-slate-400"
                                }`}
                              >
                                {res.status}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[10px] mt-0.5">{res.details}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
