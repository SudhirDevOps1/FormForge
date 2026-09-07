"use client";

import { useEffect, useState } from "react";

interface PublicStats {
  submissions: number;
  forms: number;
  users: number;
  fallback: boolean;
}

export function LiveStatsCard() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const res = await fetch("/api/public-stats");
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        if (isMounted && data.ok) {
          setStats({
            submissions: Number(data.submissions) || 0,
            forms: Number(data.forms) || 0,
            users: Number(data.users) || 0,
            fallback: Boolean(data.fallback),
          });
        }
      } catch {
        if (isMounted) {
          setStats({ submissions: 0, forms: 0, users: 0, fallback: true });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalSubmissions = stats?.submissions ?? 0;
  const totalForms = stats?.forms ?? 0;
  const totalUsers = stats?.users ?? 0;

  return (
    <div className="glass-panel rounded-[2rem] p-4 sm:p-6 animate-float">
      <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Production Telemetry</p>
            <h2 className="text-2xl font-bold text-white">System Status</h2>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {loading ? "Connecting..." : stats?.fallback ? "D1 Standby" : "D1 Live"}
          </span>
        </div>

        {/* Real Live Metrics */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">
            <strong className="block text-xl text-white">
              {loading ? "..." : totalSubmissions.toLocaleString()}
            </strong>
            <span className="text-xs text-slate-400">Total Submissions</span>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">
            <strong className="block text-xl text-white">
              {loading ? "..." : totalForms.toLocaleString()}
            </strong>
            <span className="text-xs text-slate-400">Active Forms</span>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">
            <strong className="block text-xl text-white">
              {loading ? "..." : totalUsers.toLocaleString()}
            </strong>
            <span className="text-xs text-slate-400">Registered Users</span>
          </div>
        </div>

        {/* Operational pipeline status */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white truncate text-sm">Cloudflare D1 SQLite</p>
                <span className="text-[10px] text-slate-500">Zero-latency Edge DB</span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {totalForms > 0
                  ? `${totalForms} form endpoints provisioned & accepting payloads`
                  : "Database ready. Create your first endpoint in /dashboard"}
              </p>
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-300/15 border border-emerald-300/30 text-emerald-200">
              Active
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white truncate text-sm">Spam Shield</p>
                <span className="text-[10px] text-slate-500">Free Self-Hosted</span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Native ALTCHA Proof-of-Work (SHA-256) + Honeypot verification
              </p>
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-300/15 border border-emerald-300/30 text-emerald-200">
              Shielded
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white truncate text-sm">Security & Privacy</p>
                <span className="text-[10px] text-slate-500">Zero Third-Party</span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                AES-256-GCM encryption, SHA-256 pseudonyms, no tracking cookies
              </p>
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium bg-cyan-300/15 border border-cyan-300/30 text-cyan-200">
              Encrypted
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Real-time counts directly from D1 storage</span>
          <a
            href="/dashboard"
            className="text-cyan-300 hover:text-cyan-200 font-semibold transition inline-flex items-center gap-1"
          >
            Manage Forms →
          </a>
        </div>
      </div>
    </div>
  );
}
