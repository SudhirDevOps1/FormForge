"use client";

import { useCallback, useEffect, useState } from "react";

interface SessionRow {
  id: string;
  device: string;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

interface AuditRow {
  id: number;
  formId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Security centre.
 *
 * Two panels that turn previously invisible data into something actionable:
 *
 *   • **Active sessions** — every signed-in device, so a stolen session can
 *     be revoked the moment it is noticed. The IP is stored as a daily
 *     rotating hash, never in the clear.
 *   • **Audit trail** — every administrative action with the actor and a
 *     timestamp.
 */
export function SecurityPanel() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionRes, auditRes] = await Promise.all([
        fetch("/api/user/sessions", { credentials: "include" }),
        fetch("/api/user/audit-logs?limit=60", { credentials: "include" }),
      ]);

      const sessionData = await sessionRes.json();
      if (sessionData.ok) setSessions(sessionData.data.sessions ?? []);

      const auditData = await auditRes.json();
      if (auditData.ok) setAudit(auditData.data.entries ?? []);
    } catch {
      setMessage({ tone: "error", text: "Could not load security data." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeSession(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/user/sessions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.ok) {
        setSessions((prev) => prev.filter((session) => session.id !== id));
        setMessage({ tone: "ok", text: "Session revoked." });
      } else {
        setMessage({ tone: "error", text: data.message || "Could not revoke the session." });
      }
    } catch {
      setMessage({ tone: "error", text: "Network error while revoking the session." });
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll(keepCurrent: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/user/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepCurrent }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ tone: "ok", text: `${data.data.revoked} session(s) revoked.` });
        await load();
      } else {
        setMessage({ tone: "error", text: data.message || "Could not revoke sessions." });
      }
    } catch {
      setMessage({ tone: "error", text: "Network error while revoking sessions." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-64 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Active sessions */}
      <section className="surface-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Active sessions</h2>
            <p className="mt-1 text-xs text-slate-400">
              Revoke any device you do not recognise. IPs are stored as a daily
              rotating hash.
            </p>
          </div>
          <button
            type="button"
            onClick={() => revokeAll(true)}
            disabled={busy}
            className="btn btn-danger btn-sm shrink-0"
          >
            Revoke others
          </button>
        </div>

        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center text-xs text-slate-500">
            No active sessions.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    {session.device}
                    {session.current && (
                      <span className="badge badge-success !text-[10px]">This device</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                    {session.ipHash ? `${session.ipHash.slice(0, 16)}…` : "ip unknown"} · last
                    seen {timeAgo(session.lastSeenAt)}
                  </p>
                </div>
                {!session.current && (
                  <button
                    type="button"
                    onClick={() => revokeSession(session.id)}
                    disabled={busy}
                    className="btn btn-ghost btn-sm shrink-0 !text-rose-300"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit trail */}
      <section className="surface-card p-5">
        <div className="mb-4">
          <h2 className="text-base font-bold text-white">Audit trail</h2>
          <p className="mt-1 text-xs text-slate-400">
            Every administrative action, newest first.
          </p>
        </div>

        {audit.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/12 px-4 py-6 text-center text-xs text-slate-500">
            No recorded actions yet.
          </p>
        ) : (
          <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-white/[0.03]"
              >
                <span className="min-w-0 truncate font-medium text-slate-200">
                  {entry.action}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">
                  {timeAgo(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <div
          role="status"
          className={`lg:col-span-2 rounded-xl border px-4 py-2.5 text-xs font-medium ${
            message.tone === "ok"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/25 bg-rose-500/10 text-rose-300"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
