"use client";

import { useCallback, useEffect, useState } from "react";

export interface PrefillRow {
  id: string;
  fieldKey: string;
  paramName: string;
  isHidden: boolean;
  position: number;
}

/**
 * URL prefill + hidden-field editor.
 *
 * A *visible* prefill fills a field from the URL and the respondent can
 * change it. A *hidden* field is injected server-side and never rendered, so
 * the respondent can neither read nor modify it — use it for campaign IDs
 * and tenant keys.
 */
export function PrefillsEditor({
  formId,
  fieldKeys,
  onSaved,
}: {
  formId: string;
  fieldKeys: string[];
  onSaved?: (count: number) => void;
}) {
  const [rows, setRows] = useState<PrefillRow[]>([]);
  const [captureUtm, setCaptureUtm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/prefills`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setRows(data.data.prefills ?? []);
        setCaptureUtm(Boolean(data.data.captureUtm));
      }
    } catch {
      setMessage({ tone: "error", text: "Could not load prefill mappings." });
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
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}/prefills`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefills: rows, captureUtm }),
      });
      const data = await res.json();
      if (data.ok) {
        setRows(data.data.prefills ?? []);
        setMessage({ tone: "ok", text: `${data.data.count} mapping(s) saved.` });
        onSaved?.(data.data.count);
      } else {
        setMessage({ tone: "error", text: data.message || "Failed to save mappings." });
      }
    } catch {
      setMessage({ tone: "error", text: "Network error while saving mappings." });
    } finally {
      setSaving(false);
    }
  }

  function updateRow(id: string, patch: Partial<PrefillRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-xs leading-5 text-slate-400">
        Map a URL query parameter onto a form field. Hidden fields are injected
        server-side and are never rendered, so the respondent cannot change them.
      </p>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <input
          type="checkbox"
          checked={captureUtm}
          onChange={(e) => setCaptureUtm(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-sky-400"
        />
        <span>
          <span className="block text-sm font-semibold text-white">Capture UTM parameters</span>
          <span className="mt-0.5 block text-xs text-slate-400">
            Records <code className="text-slate-300">utm_source</code>,{" "}
            <code className="text-slate-300">utm_medium</code>,{" "}
            <code className="text-slate-300">utm_campaign</code>,{" "}
            <code className="text-slate-300">utm_term</code> and{" "}
            <code className="text-slate-300">utm_content</code> automatically as hidden
            fields.
          </span>
        </span>
      </label>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 sm:grid-cols-[1fr_1fr_auto_auto]"
          >
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                URL parameter
              </span>
              <input
                value={row.paramName}
                onChange={(e) => updateRow(row.id, { paramName: e.target.value })}
                placeholder="utm_campaign"
                className="ff-input !py-2 !text-xs"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Field
              </span>
              <select
                value={row.fieldKey}
                onChange={(e) => updateRow(row.id, { fieldKey: e.target.value })}
                className="ff-input !py-2 !text-xs"
              >
                <option value="" className="bg-slate-900">
                  Select a field
                </option>
                {(fieldKeys.length ? fieldKeys : ["name", "email", "subject", "message"]).map(
                  (key) => (
                    <option key={key} value={key} className="bg-slate-900">
                      {key}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={row.isHidden}
                onChange={(e) => updateRow(row.id, { isHidden: e.target.checked })}
                className="h-4 w-4 accent-sky-400"
              />
              <span className="whitespace-nowrap text-xs text-slate-400">Hidden</span>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                aria-label="Remove mapping"
                className="btn btn-danger btn-sm !px-3"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                id: `new-${prev.length}-${Math.random().toString(36).slice(2, 8)}`,
                fieldKey: "",
                paramName: "",
                isHidden: false,
                position: prev.length,
              },
            ])
          }
          className="btn btn-ghost btn-sm"
        >
          + Add mapping
        </button>
        <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? "Saving…" : "Save mappings"}
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
