"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TurnstileAltcha } from "@/components/TurnstileAltcha";

type User = { id: string; email: string; name: string; role: string };
type Form = {
  id: string;
  name: string;
  slug: string;
  endpointId: string;
  allowedOrigins: string;
  honeypotField: string;
  webhookUrl: string | null;
  emailTo: string | null;
  notifyEmail: boolean;
  successMessage: string;
  redirectUrl: string | null;
  submissionsCount: number;
  isActive: boolean;
  altchaEnabled?: boolean;
  autoresponderSubject: string | null;
  autoresponderBody: string | null;
  spamBlocklist: string | null;
  retentionDays: number;
  emailVerificationEnabled: boolean;
  storeIpHash: boolean;
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
  gasUrl?: string | null;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  ntfyTopic?: string | null;
  otpEnabled?: boolean;
  createdAt: string;
};
type Submission = {
  id: string;
  createdAt: string;
  status: string;
  email: string | null;
  spamScore: number;
  payload: string;
  referer: string | null;
  ipHash: string | null;
};
type ApiKey = { id: string; name: string; keyPrefix: string; scopes: string; createdAt: string; expiresAt: string | null };

function timeAgo(iso: string): string {
  let timeStr = iso;
  if (iso && !iso.includes("Z") && !iso.includes("+") && !iso.includes("-")) {
    timeStr = iso.replace(" ", "T") + "Z";
  }
  const diff = Date.now() - new Date(timeStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timeStr).toLocaleDateString();
}

function getEndpointBase() {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function CodeHighlight({ code, lang }: { code: string; lang: string }) {
  let html = code;
  if (lang === "html") {
    html = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Highlight tags and their attributes in a single pass to prevent nested replacement conflicts
    html = html.replace(/&lt;(\/?[a-zA-Z0-9-]+)(.*?)&gt;/g, (match, tagName, attrs) => {
      const highlightedAttrs = attrs.replace(/(\s[a-zA-Z0-9_-]+=)(["'].*?["'])/g, ' <span class="text-purple-300">$1</span><span class="text-emerald-400">$2</span>');
      return `&lt;<span class="text-sky-400">${tagName}</span>${highlightedAttrs}&gt;`;
    });
  } else if (lang === "js" || lang === "jsx") {
    html = code
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\b(const|let|var|function|return|import|from|export|default|await|async|new|if|else)\b/g, '<span class="text-purple-400">$1</span>')
      .replace(/\b(fetch|useState|JSON|stringify|FormData|console|log)\b/g, '<span class="text-sky-400">$1</span>')
      .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="text-emerald-400">$1</span>');
  } else if (lang === "python") {
    html = code
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\b(import|from|print|def|return|if|else|elif)\b/g, '<span class="text-purple-400">$1</span>')
      .replace(/(".*?"|'.*?')/g, '<span class="text-emerald-400">$1</span>');
  } else if (lang === "curl" || lang === "bash") {
    html = code
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\b(curl|-X|-H|-d|POST|GET)\b/g, '<span class="text-purple-400 font-semibold">$1</span>')
      .replace(/(".*?"|'.*?')/g, '<span class="text-emerald-400">$1</span>');
  } else if (lang === "sql") {
    html = code
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|DESC|ASC|COUNT|AVG|SUM|ROUND|OVER|AS|NOT NULL|AND|OR)\b/gi, '<span class="text-purple-400 font-semibold">$1</span>')
      .replace(/\b(read_csv_auto|date_trunc|regexp_extract)\b/g, '<span class="text-sky-400">$1</span>')
      .replace(/(".*?"|'.*?')/g, '<span class="text-emerald-400">$1</span>');
  }

  return (
    <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-xs font-mono text-slate-300 border border-white/5 leading-relaxed">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

/* ─────────────────── Root ─────────────────── */

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"forms" | "keys" | "settings">("forms");

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      if (data.ok) setUser(data.data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Dashboard — FormForge";
    loadMe();
  }, [loadMe]);

  if (loading) return <Spinner />;
  if (!user) return <AuthCard onAuthed={loadMe} />;

  return (
    <div className="min-h-screen">
      <DashHeader user={user} onLogout={() => setUser(null)} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-8">
        <div role="tablist" aria-label="Dashboard sections" className="mb-6 flex flex-wrap gap-1.5 rounded-xl bg-white/[0.02] border border-white/5 p-1 max-w-max">
          {(["forms", "keys", "settings"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`tabpanel-${t}`}
              onClick={() => setTab(t)}
              className={`rounded-lg px-5 py-2.5 text-xs font-semibold capitalize tracking-wide transition-all duration-200 ${tab === t ? "bg-sky-500 text-white shadow-md shadow-sky-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"}`}
            >
              {t === "keys" ? "API Keys" : t}
            </button>
          ))}
        </div>
        <div id={`tabpanel-${tab}`} role="tabpanel" aria-label={tab}>
          {tab === "forms" && <FormsTab />}
          {tab === "keys" && <KeysTab />}
          {tab === "settings" && <SettingsTab user={user} />}
        </div>
      </main>
    </div>
  );
}

/* ─────────────────── Header ─────────────────── */

function DashHeader({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="FormForge Home">
          <img src="/logo.svg" alt="FormForge Logo" className="h-9 w-9 rounded-xl shadow-md shadow-sky-500/10" />
          <span className="font-bold tracking-tight text-white flex items-center gap-1.5">
            FormForge
            <span className="rounded-md bg-gradient-to-r from-sky-500/20 to-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
              v2.0 Universal
            </span>
          </span>
        </Link>
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/20 px-3 py-1 text-xs font-semibold text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Zero-Card Free Tier Engine</span>
          <span className="text-[10px] text-emerald-400/60 font-mono">D1 • Turso • Neon • DuckDB</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-slate-400 sm:inline">{user.email}</span>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-full border border-white/15 p-2 sm:hidden animate-none"
          aria-label="Toggle Navigation Menu"
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); onLogout(); }} className="hidden rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10 sm:inline-flex">Sign out</button>
      </div>
      {menuOpen && (
        <div className="absolute inset-x-4 top-16 z-50 rounded-2xl border border-white/15 bg-slate-900/95 p-4 backdrop-blur-lg sm:hidden">
          <p className="mb-3 text-sm text-slate-400">{user.email}</p>
          <Link href="/" className="mb-2 block rounded-xl px-4 py-3 text-sm hover:bg-white/10">Home</Link>
          <a href="/docs.html" className="mb-2 block rounded-xl px-4 py-3 text-sm hover:bg-white/10">Docs</a>
          <a href="/guide.html" className="mb-2 block rounded-xl px-4 py-3 text-sm hover:bg-white/10">Guide</a>
          <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); onLogout(); setMenuOpen(false); }} className="w-full rounded-xl border border-rose-400/30 px-4 py-3 text-left text-sm text-rose-200 hover:bg-rose-400/10">Sign out</button>
        </div>
      )}
    </header>
  );
}

/* ─────────────────── Spinner ─────────────────── */

function Spinner() {
  return <div className="grid min-h-screen place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" /></div>;
}

/* ─────────────────── Auth ─────────────────── */

function AuthCard({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [altchaPayload, setAltchaPayload] = useState("");
  const [altchaVerified, setAltchaVerified] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!altchaVerified) {
      setError("Please complete human verification below before continuing.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, altcha: altchaPayload }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.message ?? "Something went wrong."); return; }
      onAuthed();
    } catch { setError("Network error. Is the Worker deployed and D1 bound?"); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12">
      <form onSubmit={submit} className="glass-panel w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.svg" alt="FormForge Logo" className="h-10 w-10 rounded-xl" />
          <span className="text-xl font-bold">FormForge</span>
        </div>
        <h1 className="text-2xl font-black text-white">{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-slate-400">Data stays in your own Cloudflare D1 — nobody else can see it.</p>

        <label htmlFor="auth-email" className="mt-5 block text-sm text-slate-300">Email</label>
        <input id="auth-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ff-input" placeholder="you@example.com" />

        {mode === "register" && (
          <>
            <label htmlFor="auth-name" className="mt-3 block text-sm text-slate-300">Name</label>
            <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} className="ff-input" placeholder="Your name" />
          </>
        )}

        <label htmlFor="auth-password" className="mt-3 block text-sm text-slate-300">Password (min 10 chars)</label>
        <div className="relative">
          <input id="auth-password" required minLength={10} type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="ff-input pr-12" placeholder="••••••••••" />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white" aria-live="polite">{showPw ? "Hide" : "Show"}</button>
        </div>

        {/* Turnstile-Styled ALTCHA Proof-of-Work Verification with Solve Timing */}
        <div className="mt-4">
          <TurnstileAltcha
            key={mode}
            challengeUrl="/api/altcha/challenge?maxnumber=20000"
            onVerified={(payload) => {
              setAltchaPayload(payload);
              setAltchaVerified(true);
              setError("");
            }}
          />
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error.includes("AUTH_SECRET") ? (
              <div>
                <p className="font-semibold">⚠️ AUTH_SECRET not configured</p>
                <p className="mt-2 text-rose-100/80">Your Worker needs this secret to create accounts.</p>
                <ol className="mt-2 list-decimal pl-4 text-rose-100/80">
                  <li>Open <a href="https://dash.cloudflare.com" target="_blank" className="underline text-white">Cloudflare Dashboard</a></li>
                  <li>Go to <strong>Workers &amp; Pages</strong> → click your Worker name</li>
                  <li>Go to <strong>Settings</strong> → <strong>Variables &amp; Secrets</strong></li>
                  <li>Click <strong>Add secret</strong> → Type: <code className="bg-black/30 px-1 rounded">AUTH_SECRET</code></li>
                  <li>Value: open terminal and run <code className="bg-black/30 px-1 rounded">openssl rand -hex 32</code></li>
                  <li>Paste the output, click <strong>Save</strong></li>
                  <li><strong>Redeploy</strong> your Worker (or just reload this page after 30s)</li>
                </ol>
              </div>
            ) : (
              error
            )}
          </div>
        )}

        <button disabled={busy || !altchaVerified} className="mt-5 w-full rounded-2xl bg-cyan-300 px-6 py-4 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); setAltchaVerified(false); setAltchaPayload(""); }} className="mt-3 w-full text-center text-sm text-cyan-200 hover:text-white">
          {mode === "register" ? "Already have an account? Sign in →" : "New here? Create an account →"}
        </button>
      </form>
    </div>
  );
}

/* ─────────────────── Forms Tab ─────────────────── */

function FormsTab() {
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const initialLoad = useRef(true);

  const loadForms = useCallback(async () => {
    const res = await fetch("/api/forms", { credentials: "include" });
    const data = await res.json();
    if (data.ok) {
      setForms(data.data.forms);
      const formsList = data.data.forms;
      if (initialLoad.current && formsList.length > 0) {
        setSelectedId(formsList[0].id);
        initialLoad.current = false;
      } else if (formsList.length > 0) {
        setSelectedId((current) => {
          if (current && formsList.some((f: Form) => f.id === current)) {
            return current;
          }
          return formsList[0].id;
        });
      } else {
        setSelectedId(null);
      }
    }
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);

  const filtered = forms.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.slug.toLowerCase().includes(search.toLowerCase()));
  const selected = forms.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* Sidebar */}
      <aside className="glass-panel space-y-4 rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Forms</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-cyan-300 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-200">{showCreate ? "Cancel" : "+ New"}</button>
        </div>
        {showCreate && <CreateFormInline onCreated={() => { setShowCreate(false); loadForms(); }} />}
        <input placeholder="Search forms…" value={search} onChange={(e) => setSearch(e.target.value)} className="ff-input text-sm" />
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No forms found.</p>}
          {filtered.map((form) => (
            <button key={form.id} onClick={() => setSelectedId(form.id)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition hover-lift ${selectedId === form.id ? "border-cyan-300/60 bg-cyan-300/10 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{form.name}</p>
                <p className="text-xs text-slate-400">{form.submissionsCount} submissions</p>
              </div>
              {!form.isActive && <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">off</span>}
            </button>
          ))}
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
          <StatCard label="Total forms" value={String(forms.length)} />
          <StatCard label="All submissions" value={String(forms.reduce((a, f) => a + f.submissionsCount, 0))} />
          <StatCard label="Active" value={String(forms.filter((f) => f.isActive).length)} />
          <StatCard label="Inactive" value={String(forms.filter((f) => !f.isActive).length)} />
        </div>
        <div className="text-[10px] text-slate-500 text-center border-t border-white/5 pt-3">
          FormForge Engine v2.1 Universal · D1 • Neon • Turso • DuckDB
        </div>
      </aside>

      {/* Detail */}
      {selected ? (
        <FormDetail form={selected} onChanged={loadForms} />
      ) : (
        <div className="glass-panel grid place-items-center rounded-3xl p-16 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <p className="mt-3">Select a form or create one</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent px-4 py-4 text-center hover-lift">
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function CreateFormInline({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/forms", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (!data.ok) { setError(data.message); return; }
      setName("");
      onCreated();
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-3">
      <label htmlFor="create-form-name" className="sr-only">Form Name</label>
      <input id="create-form-name" required placeholder="Form name" value={name} onChange={(e) => setName(e.target.value)} className="ff-input text-sm" autoFocus />
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-cyan-300 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">{busy ? "Creating…" : "Create"}</button>
    </form>
  );
}

/* ─────────────────── Form Detail ─────────────────── */

function FormDetail({ form, onChanged }: { form: Form; onChanged: () => void }) {
  const [view, setView] = useState<"submissions" | "connect" | "analytics" | "settings">("submissions");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [subStatus, setSubStatus] = useState<"all" | "accepted" | "spam" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [counts, setCounts] = useState({ all: 0, accepted: 0, spam: 0, pending: 0 });
  const limit = 20;

  const base = getEndpointBase();
  const endpoint = `${base}/api/submit/${form.endpointId}`;

  const loadSubs = useCallback(async (currentStatus = subStatus, currentQ = searchQuery, currentOffset = offset) => {
    setLoading(true);
    try {
      const qParam = currentQ.trim() ? `&q=${encodeURIComponent(currentQ.trim())}` : "";
      const statusParam = currentStatus !== "all" ? `&status=${currentStatus}` : "";
      const res = await fetch(`/api/forms/${form.id}/submissions?limit=${limit}&offset=${currentOffset}${statusParam}${qParam}`, { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setSubs(data.data.submissions);
        setTotal(data.data.pagination.total ?? data.data.submissions.length);
        if (data.data.counts) {
          setCounts(data.data.counts);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [form.id, limit, offset, subStatus, searchQuery]);

  useEffect(() => {
    setOffset(0);
  }, [form.id, subStatus, searchQuery]);

  useEffect(() => {
    loadSubs(subStatus, searchQuery, offset);
  }, [loadSubs, subStatus, searchQuery, offset]);

  const handleToggleStatus = async (subId: string, currentStatus: string) => {
    const newStatus = currentStatus === "spam" ? "accepted" : "spam";
    setSubs((prev) => prev.map((s) => (s.id === subId ? { ...s, status: newStatus } : s)));
    try {
      await fetch(`/api/submissions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      loadSubs();
    } catch (e) {
      console.error("Failed to toggle status", e);
    }
  };

  const handleDeleteSub = async (subId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this submission?")) return;
    setSubs((prev) => prev.filter((s) => s.id !== subId));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await fetch(`/api/submissions/${subId}`, { method: "DELETE" });
      onChanged();
      loadSubs();
    } catch (e) {
      console.error("Failed to delete submission", e);
    }
  };

  const handleClearSpam = async () => {
    if (!window.confirm(`Are you sure you want to delete all ${counts.spam} spam submissions?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/forms/${form.id}/submissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearSpam: true }),
      });
      onChanged();
      loadSubs();
    } catch (e) {
      console.error("Failed to clear spam", e);
    } finally {
      setLoading(false);
    }
  };

  const [snippetTab, setSnippetTab] = useState<"html" | "widget" | "react" | "js" | "python" | "curl">("html");
  const [connectSubView, setConnectSubView] = useState<"studio" | "docs" | "security">("studio");
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ status: number; ok: boolean; data: any } | null>(null);
  const [formTemplate, setFormTemplate] = useState<"plain" | "contact" | "glass" | "minimal" | "card" | "newsletter" | "feedback">("plain");
  const [formColor, setFormColor] = useState<"cyan" | "indigo" | "emerald" | "amber" | "rose">("cyan");
  const [widgetPosition, setWidgetPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [widgetBtnText, setWidgetBtnText] = useState("Feedback");
  const [snippetFields, setSnippetFields] = useState<string[]>(["email", "message"]);
  const [newFieldName, setNewFieldName] = useState("");

  const handleToggleSelectAll = () => {
    if (selectedSubIds.length === subs.length) {
      setSelectedSubIds([]);
    } else {
      setSelectedSubIds(subs.map(s => s.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedSubIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (selectedSubIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedSubIds.length} selected submissions?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/forms/${form.id}/submissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSubIds }),
      });
      setSelectedSubIds([]);
      onChanged();
      loadSubs();
    } catch (e) {
      console.error("Failed to bulk delete submissions", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunApiTest = async () => {
    setApiTestLoading(true);
    setApiTestResult(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Developer",
          email: "developer@example.com",
          message: "Testing FormForge API directly from dashboard interactive sandbox!",
          _source: "dashboard_api_tester",
        }),
      });
      const data = await res.json().catch(() => ({}));
      setApiTestResult({ status: res.status, ok: res.ok, data });
      onChanged();
      loadSubs();
    } catch (err) {
      setApiTestResult({ status: 500, ok: false, data: { error: String(err) } });
    } finally {
      setApiTestLoading(false);
    }
  };

  const addSnippetField = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFieldName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean && !snippetFields.includes(clean)) {
      setSnippetFields([...snippetFields, clean]);
      setNewFieldName("");
    }
  };

  const removeSnippetField = (field: string) => {
    setSnippetFields(snippetFields.filter(f => f !== field));
  };

  const hasAttachment = snippetFields.some(f => ["attachment", "file", "image", "upload"].includes(f));
  const enctype = hasAttachment ? ' enctype="multipart/form-data"' : "";

  // Color mapping definitions for Tailwind classes
  const colorMap = {
    cyan: { text: "text-cyan-500", border: "focus:border-cyan-500 focus:ring-cyan-500", bg: "bg-cyan-500", hover: "hover:bg-cyan-400", fromTo: "from-cyan-500 to-blue-600", hoverFromTo: "hover:from-cyan-400 hover:to-blue-500", fileBg: "file:bg-cyan-500/10 file:text-cyan-300 hover:file:bg-cyan-500/20", styleHex1: "#38bdf8", styleHex2: "#6366f1" },
    indigo: { text: "text-indigo-500", border: "focus:border-indigo-500 focus:ring-indigo-500", bg: "bg-indigo-500", hover: "hover:bg-indigo-400", fromTo: "from-indigo-500 to-purple-600", hoverFromTo: "hover:from-indigo-400 hover:to-purple-500", fileBg: "file:bg-indigo-500/10 file:text-indigo-300 hover:file:bg-indigo-500/20", styleHex1: "#6366f1", styleHex2: "#a855f7" },
    emerald: { text: "text-emerald-500", border: "focus:border-emerald-500 focus:ring-emerald-500", bg: "bg-emerald-500", hover: "hover:bg-emerald-400", fromTo: "from-emerald-500 to-teal-600", hoverFromTo: "hover:from-emerald-400 hover:to-teal-500", fileBg: "file:bg-emerald-500/10 file:text-emerald-300 hover:file:bg-emerald-500/20", styleHex1: "#10b981", styleHex2: "#06b6d4" },
    amber: { text: "text-amber-500", border: "focus:border-amber-500 focus:ring-amber-500", bg: "bg-amber-500", hover: "hover:bg-amber-400", fromTo: "from-amber-500 to-orange-600", hoverFromTo: "hover:from-amber-400 hover:to-orange-500", fileBg: "file:bg-amber-500/10 file:text-amber-300 hover:file:bg-amber-500/20", styleHex1: "#f59e0b", styleHex2: "#ea580c" },
    rose: { text: "text-rose-500", border: "focus:border-rose-500 focus:ring-rose-500", bg: "bg-rose-500", hover: "hover:bg-rose-400", fromTo: "from-rose-500 to-red-600", hoverFromTo: "hover:from-rose-400 hover:to-red-500", fileBg: "file:bg-rose-500/10 file:text-rose-300 hover:file:bg-rose-500/20", styleHex1: "#f43f5e", styleHex2: "#d946ef" },
  };

  const theme = colorMap[formColor];

  const altchaSnippet = form.altchaEnabled
    ? `\n  <!-- Turnstile-Styled ALTCHA Proof-of-Work Anti-Spam Widget -->\n  <style>\n    altcha-widget { --altcha-max-width: 100%; --altcha-border-radius: 12px; --altcha-color-base: #0f172a; --altcha-color-border: #334155; --altcha-color-text: #f8fafc; }\n  </style>\n  <script type="module" src="https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js" async defer></script>\n  <altcha-widget challengeurl="${endpoint}"></altcha-widget>\n  <div id="altcha-timer" style="font-family: monospace; font-size: 11px; color: #34d399; margin-top: 4px; display: none;"></div>\n  <script>\n    document.addEventListener("DOMContentLoaded", () => {\n      const w = document.querySelector("altcha-widget");\n      const t = document.getElementById("altcha-timer");\n      let s = 0;\n      if (w && t) {\n        w.addEventListener("statechange", (e) => {\n          if (e.detail.state === "verifying") s = performance.now();\n          if (e.detail.state === "verified") {\n            const ms = Math.round(performance.now() - s);\n            t.textContent = "⚡ Solved in " + ms + "ms (Proof-of-Work)";\n            t.style.display = "block";\n          }\n        });\n      }\n    });\n  </script>`
    : "";

  const htmlSnippet = formTemplate === "plain"
    ? `<form method="POST" action="${endpoint}"${enctype}>
${snippetFields.map(f => {
  if (["message", "comments", "description"].includes(f)) {
    return `  <textarea name="${f}" required placeholder="Your ${f}"></textarea>`;
  }
  if (["attachment", "file", "image", "upload"].includes(f)) {
    return `  <input name="${f}" type="file" required />`;
  }
  return `  <input name="${f}" type="${f === "email" ? "email" : "text"}" required placeholder="Your ${f}" />`;
}).join("\n")}
  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />${altchaSnippet}
  <button type="submit">Send</button>
</form>`
    : formTemplate === "contact"
    ? `<!-- FormForge Contact Form (Tailwind CSS) -->
<form method="POST" action="${endpoint}"${enctype} class="max-w-md mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl text-left">
${snippetFields.map(f => {
  const label = f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  if (["message", "comments", "description"].includes(f)) {
    return `  <div>
    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">${label}</label>
    <textarea name="${f}" required placeholder="Type your ${f} here..." rows="4" class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-${formColor}-500 focus:ring-1 focus:ring-${formColor}-500 transition"></textarea>
  </div>`;
  }
  if (["attachment", "file", "image", "upload"].includes(f)) {
    return `  <div>
    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">${label}</label>
    <input name="${f}" type="file" required class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white ${theme.fileBg} focus:outline-none focus:border-${formColor}-500 focus:ring-1 focus:ring-${formColor}-500 transition" />
  </div>`;
  }
  return `  <div>
    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">${label}</label>
    <input name="${f}" type="${f === "email" ? "email" : "text"}" required placeholder="Enter ${f}" class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-${formColor}-500 focus:ring-1 focus:ring-${formColor}-500 transition" />
  </div>`;
}).join("\n")}
  <!-- Honeypot Bot Trap -->
  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />${altchaSnippet}
  <button type="submit" class="w-full py-3 px-4 bg-gradient-to-r ${theme.fromTo} text-white font-semibold rounded-xl ${theme.hoverFromTo} transition-all">
    Send Message
  </button>
</form>`
    : formTemplate === "newsletter"
    ? `<!-- FormForge Newsletter Signup (Tailwind CSS) -->
<form method="POST" action="${endpoint}" class="max-w-lg mx-auto p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-6 shadow-2xl text-left">
  <div class="space-y-2">
    <h3 class="text-xl font-bold text-white">Subscribe to our newsletter</h3>
    <p class="text-sm text-slate-400">Get the latest updates and developer news right in your inbox.</p>
  </div>
  <div class="flex flex-col sm:flex-row gap-2">
    <input name="email" type="email" required placeholder="Enter your email" class="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-${formColor}-500 focus:ring-1 focus:ring-${formColor}-500 transition" />
    <!-- Honeypot Bot Trap -->
    <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />
    <button type="submit" class="py-3 px-6 ${theme.bg} text-white font-semibold rounded-xl ${theme.hover} transition">
      Subscribe
    </button>
  </div>
</form>`
    : formTemplate === "glass"
    ? `<!-- FormForge Glassmorphic Cyber Dark Card -->
<style>
  .ff-glass { max-width: 460px; margin: 2rem auto; padding: 2rem; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.12); border-radius: 1.5rem; font-family: 'Inter', system-ui, sans-serif; color: #f8fafc; box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 30px ${theme.styleHex1}20; text-align: left; }
  .ff-glass h3 { font-size: 1.35rem; font-weight: 800; margin: 0 0 0.25rem; color: #fff; }
  .ff-glass p { font-size: 0.85rem; color: #94a3b8; margin: 0 0 1.5rem; }
  .ff-glass label { display: block; font-size: 0.75rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem; }
  .ff-glass input, .ff-glass textarea, .ff-glass select { width: 100%; padding: 0.75rem 1rem; background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(255,255,255,0.12); border-radius: 0.75rem; color: #fff; font-size: 0.875rem; outline: none; transition: all 0.2s; margin-bottom: 1.1rem; box-sizing: border-box; }
  .ff-glass input:focus, .ff-glass textarea:focus { border-color: ${theme.styleHex1}; box-shadow: 0 0 15px ${theme.styleHex1}35; background: rgba(2, 6, 23, 0.85); }
  .ff-glass button[type="submit"] { width: 100%; padding: 0.85rem; background: linear-gradient(135deg, ${theme.styleHex1}, ${theme.styleHex2}); color: #fff; font-weight: 700; font-size: 0.9rem; border: none; border-radius: 0.75rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 8px 20px -4px ${theme.styleHex1}50; }
  .ff-glass button[type="submit"]:hover { filter: brightness(1.1); transform: translateY(-1px); }
</style>
<form method="POST" action="${endpoint}"${enctype} class="ff-glass">
  <h3>✨ Get in Touch</h3>
  <p>Leave a message and we'll reply right away.</p>
${snippetFields.map(f => {
  const label = f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  if (["message", "comments", "description"].includes(f)) {
    return `  <div>\n    <label>${label}</label>\n    <textarea name="${f}" required rows="4" placeholder="Your message..."></textarea>\n  </div>`;
  }
  if (["attachment", "file", "image", "upload"].includes(f)) {
    return `  <div>\n    <label>${label}</label>\n    <input name="${f}" type="file" required />\n  </div>`;
  }
  return `  <div>\n    <label>${label}</label>\n    <input name="${f}" type="${f === "email" ? "email" : "text"}" required placeholder="Enter ${label.toLowerCase()}" />\n  </div>`;
}).join("\n")}
  <!-- Honeypot Bot Trap -->
  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />${altchaSnippet}
  <button type="submit">Send Secure Message ➔</button>
</form>`
    : formTemplate === "minimal"
    ? `<!-- FormForge Clean Minimal Line Style -->
<style>
  .ff-minimal { max-width: 440px; margin: 2rem auto; padding: 2rem; background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; text-align: left; }
  .ff-minimal h3 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
  .ff-minimal p { font-size: 0.875rem; color: #64748b; margin: 0 0 2rem; }
  .ff-minimal .ff-group { position: relative; margin-bottom: 1.75rem; }
  .ff-minimal label { display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.25rem; }
  .ff-minimal input, .ff-minimal textarea { width: 100%; padding: 0.6rem 0; background: transparent; border: none; border-bottom: 1px solid #334155; color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s; box-sizing: border-box; border-radius: 0; }
  .ff-minimal input:focus, .ff-minimal textarea:focus { border-bottom-color: ${theme.styleHex1}; }
  .ff-minimal button[type="submit"] { width: 100%; margin-top: 1rem; padding: 0.85rem; background: #fff; color: #020617; font-weight: 700; font-size: 0.875rem; border: none; border-radius: 9999px; cursor: pointer; transition: all 0.2s; }
  .ff-minimal button[type="submit"]:hover { background: #e2e8f0; transform: translateY(-1px); }
</style>
<form method="POST" action="${endpoint}"${enctype} class="ff-minimal">
  <h3>Let's Connect</h3>
  <p>Fill out the form below and we will get back to you shortly.</p>
${snippetFields.map(f => {
  const label = f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  if (["message", "comments", "description"].includes(f)) {
    return `  <div class="ff-group">\n    <label>${label}</label>\n    <textarea name="${f}" required rows="3" placeholder="Write your message..."></textarea>\n  </div>`;
  }
  if (["attachment", "file", "image", "upload"].includes(f)) {
    return `  <div class="ff-group">\n    <label>${label}</label>\n    <input name="${f}" type="file" required />\n  </div>`;
  }
  return `  <div class="ff-group">\n    <label>${label}</label>\n    <input name="${f}" type="${f === "email" ? "email" : "text"}" required placeholder="${label}" />\n  </div>`;
}).join("\n")}
  <!-- Honeypot Bot Trap -->
  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />${altchaSnippet}
  <button type="submit">Submit ➔</button>
</form>`
    : formTemplate === "card"
    ? `<!-- FormForge Modern SaaS Floating Card -->
<div style="max-width: 460px; margin: 2rem auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 1.5rem; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); font-family: 'Inter', system-ui, sans-serif; text-align: left;">
  <div style="background: linear-gradient(135deg, ${theme.styleHex1}25, ${theme.styleHex2}15); padding: 1.75rem; border-bottom: 1px solid #1e293b;">
    <span style="display: inline-block; padding: 0.25rem 0.75rem; background: ${theme.styleHex1}25; color: ${theme.styleHex1}; border: 1px solid ${theme.styleHex1}40; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Online Inquiry</span>
    <h3 style="font-size: 1.25rem; font-weight: 800; color: #ffffff; margin: 0 0 0.25rem;">Contact ${form.name}</h3>
    <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">We typically respond within 24 hours.</p>
  </div>
  <form method="POST" action="${endpoint}"${enctype} style="padding: 1.75rem; display: flex; flex-direction: column; gap: 1rem;">
${snippetFields.map(f => {
  const label = f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  if (["message", "comments", "description"].includes(f)) {
    return `    <div>\n      <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.35rem;">${label}</label>\n      <textarea name="${f}" required rows="4" placeholder="Your message..." style="width: 100%; padding: 0.65rem 0.85rem; background: #020617; border: 1px solid #334155; border-radius: 0.75rem; color: #fff; font-size: 0.85rem; box-sizing: border-box; outline: none;"></textarea>\n    </div>`;
  }
  if (["attachment", "file", "image", "upload"].includes(f)) {
    return `    <div>\n      <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.35rem;">${label}</label>\n      <input name="${f}" type="file" required style="width: 100%; padding: 0.65rem 0.85rem; background: #020617; border: 1px solid #334155; border-radius: 0.75rem; color: #fff; font-size: 0.85rem; box-sizing: border-box;" />\n    </div>`;
  }
  return `    <div>\n      <label style="display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.35rem;">${label}</label>\n      <input name="${f}" type="${f === "email" ? "email" : "text"}" required placeholder="Enter ${label.toLowerCase()}" style="width: 100%; padding: 0.65rem 0.85rem; background: #020617; border: 1px solid #334155; border-radius: 0.75rem; color: #fff; font-size: 0.85rem; box-sizing: border-box; outline: none;" />\n    </div>`;
}).join("\n")}
    <!-- Honeypot Bot Trap -->
    <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />${altchaSnippet}
    <button type="submit" style="width: 100%; padding: 0.85rem; background: ${theme.styleHex1}; color: #020617; font-weight: 700; font-size: 0.875rem; border: none; border-radius: 0.75rem; cursor: pointer; box-shadow: 0 4px 14px ${theme.styleHex1}40; margin-top: 0.5rem;">
      Send Message
    </button>
  </form>
</div>`
    : `<!-- FormForge Customer Feedback Form (Glassmorphism CSS) -->
<style>
  .ff-feedback { max-width: 480px; margin: 2rem auto; padding: 2rem; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); border-radius: 1.5rem; font-family: 'Inter', system-ui, sans-serif; color: #f1f5f9; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
  .ff-feedback h3 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.25rem; }
  .ff-feedback p { font-size: 0.875rem; color: #94a3b8; margin: 0 0 1.5rem; }
  .ff-feedback label { display: block; font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.375rem; }
  .ff-feedback input, .ff-feedback textarea, .ff-feedback select { width: 100%; padding: 0.625rem 0.875rem; background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; color: #fff; font-size: 0.875rem; outline: none; transition: border-color 0.2s; margin-bottom: 1rem; box-sizing: border-box; }
  .ff-feedback input:focus, .ff-feedback textarea:focus, .ff-feedback select:focus { border-color: ${theme.styleHex1}; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.15); }
  .ff-feedback .ff-stars { display: flex; gap: 0.375rem; margin-bottom: 1rem; }
  .ff-feedback .ff-stars label { cursor: pointer; font-size: 1.5rem; color: #334155; transition: color 0.15s; text-transform: none; letter-spacing: normal; margin: 0; }
  .ff-feedback .ff-stars input { display: none; }
  .ff-feedback .ff-stars label:hover, .ff-feedback .ff-stars label:hover ~ label { color: #fbbf24; }
  .ff-feedback .ff-stars input:checked ~ label { color: #334155; }
  .ff-feedback .ff-stars :has(input:checked) label, .ff-feedback .ff-stars label:has(~ input:checked) { color: #fbbf24; }
  .ff-feedback button[type="submit"] { width: 100%; padding: 0.75rem; background: linear-gradient(135deg, ${theme.styleHex1}, ${theme.styleHex2}); color: #fff; font-weight: 600; font-size: 0.875rem; border: none; border-radius: 0.75rem; cursor: pointer; transition: opacity 0.2s; }
  .ff-feedback button[type="submit"]:hover { opacity: 0.9; }
</style>
<form method="POST" action="${endpoint}" class="ff-feedback">
  <h3>Share Your Feedback</h3>
  <p>We value your opinion. Help us improve!</p>
  <label>Your Name</label>
  <input name="name" type="text" required placeholder="Enter your name" />
  <label>Email</label>
  <input name="email" type="email" required placeholder="you@example.com" />
  <label>Rating</label>
  <div class="ff-stars" style="direction: rtl; justify-content: flex-end;">
    <label>⭐<input type="radio" name="rating" value="5" /></label>
    <label>⭐<input type="radio" name="rating" value="4" /></label>
    <label>⭐<input type="radio" name="rating" value="3" /></label>
    <label>⭐<input type="radio" name="rating" value="2" /></label>
    <label>⭐<input type="radio" name="rating" value="1" /></label>
  </div>
  <label>Your Feedback</label>
  <textarea name="message" rows="4" required placeholder="Tell us what you think..."></textarea>
  <!-- Honeypot Bot Trap -->
  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />
  <button type="submit">Submit Feedback</button>
</form>`;

  const jsSnippet = `fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
${snippetFields.map(f => `    ${f}: "your_${f}_value"`).join(",\n")}
  })
}).then(r => r.json()).then(console.log);`;

  const reactSnippet = `import { useState } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("submitting");
    const res = await fetch("${endpoint}", {
      method: "POST",
      body: new FormData(e.target),
    });
    if (res.ok) setStatus("success");
    else setStatus("failed");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
${snippetFields.map(f => {
  if (["message", "comments", "description"].includes(f)) {
    return `      <textarea name="${f}" required placeholder="${f}" className="border p-2 rounded w-full bg-slate-900 text-white" />`;
  }
  if (["attachment", "file", "image", "upload"].includes(f)) {
    return `      <input type="file" name="${f}" required className="border p-2 rounded w-full bg-slate-900 text-white" />`;
  }
  return `      <input type="${f === "email" ? "email" : "text"}" name="${f}" required placeholder="${f}" className="border p-2 rounded w-full bg-slate-900 text-white" />`;
}).join("\n")}
${form.altchaEnabled ? `      {/* ALTCHA Free Anti-Spam Widget */}\n      <altcha-widget challengeurl="${endpoint}"></altcha-widget>\n` : ""}      <button type="submit" className="bg-sky-500 px-4 py-2 text-white font-bold rounded">Send</button>
      {status === "success" && <p className="text-emerald-400 mt-2">Sent successfully!</p>}
      {status === "failed" && <p className="text-rose-400 mt-2">Submission failed.</p>}
    </form>
  );
}`;

  const pythonSnippet = `import requests

url = "${endpoint}"
data = {
${snippetFields.map(f => `    "${f}": "value_here"`).join(",\n")}
}

response = requests.post(url, json=data)
print(response.json())`;

  const widgetSnippet = `<!-- FormForge Floating Feedback & Contact Widget -->
<!-- Paste right before </body> on any static HTML, WordPress, Webflow, Shopify, or React app -->
<script
  src="${base}/widget.js"
  data-endpoint="${endpoint}"
  data-position="${widgetPosition}"
  data-color="${theme.styleHex1}"
  data-title="Contact ${form.name}"
  data-btn-text="${widgetBtnText || "Feedback"}"
  defer
></script>`;

  const curlSnippet = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
${snippetFields.map(f => `    "${f}": "test_${f}_value"`).join(",\n")}
  }'`;

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function toggleActive() {
    const confirmation = window.confirm(form.isActive ? "Are you sure you want to pause this form? Submissions will be blocked." : "Resume accepting submissions for this form?");
    if (!confirmation) return;
    await fetch(`/api/forms/${form.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !form.isActive }) });
    onChanged();
  }

  async function deleteForm() {
    const confirmation = window.confirm("🚨 CRITICAL: Are you sure you want to delete/deactivate this form? This cannot be undone.");
    if (!confirmation) return;
    await fetch(`/api/forms/${form.id}`, { method: "DELETE", credentials: "include" });
    onChanged();
  }

  const accepted = subs.filter((s) => s.status === "accepted").length;
  const spam = subs.filter((s) => s.status === "spam").length;

  return (
    <section className="glass-panel space-y-5 overflow-hidden rounded-3xl animate-slide-up">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-bold text-white">{form.name}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${form.isActive ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}>{form.isActive ? "active" : "inactive"}</span>
          </div>
          <p className="text-sm text-slate-400">/{form.slug} · Created {timeAgo(form.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleActive} className="rounded-xl border border-white/15 px-4 py-3 text-xs hover:bg-white/10">{form.isActive ? "Pause" : "Resume"}</button>
          <button onClick={deleteForm} className="rounded-xl border border-rose-400/30 text-rose-200 px-4 py-3 text-xs hover:bg-rose-400/10">Delete</button>
          <div className="relative group">
            <button className="rounded-xl border border-white/15 px-4 py-3 text-xs hover:bg-white/10 flex items-center gap-1.5 text-slate-300">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export</span>
              <svg className="w-2.5 h-2.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="absolute right-0 mt-1 hidden group-hover:block bg-slate-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[130px]">
              <a href={`/api/forms/${form.id}/export?format=csv`} className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition">CSV Format</a>
              <a href={`/api/forms/${form.id}/export?format=json`} className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition border-t border-white/5">JSON Format</a>
              <a href={`/api/forms/${form.id}/export?format=txt`} className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition border-t border-white/5">TXT Report</a>
              <a href={`/api/forms/${form.id}/export?format=pdf`} target="_blank" className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition border-t border-white/5">PDF Report (Print)</a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        <StatCard label="Total" value={String(form.submissionsCount)} color="text-sky-400" />
        <StatCard label="Accepted" value={String(accepted)} color="text-emerald-400" />
        <StatCard label="Spam blocked" value={String(spam)} color="text-amber-400" />
        <StatCard label="Accept rate" value={subs.length > 0 ? `${Math.round((accepted / subs.length) * 100)}%` : "—"} color="text-purple-400" />
      </div>

      {/* Primary Navigation Tabs */}
      <div role="tablist" aria-label="Form navigation" className="flex items-center gap-1 border-b border-white/10 px-5 pt-1 overflow-x-auto">
        <button
          role="tab"
          aria-selected={view === "submissions"}
          aria-controls="view-submissions-panel"
          onClick={() => setView("submissions")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            view === "submissions"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7z"/><path d="M5.45 5.11L2 12v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
          <span>Submissions</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-mono font-medium ${
            view === "submissions" ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30" : "bg-white/5 text-slate-400"
          }`}>
            {total}
          </span>
        </button>

        <button
          role="tab"
          aria-selected={view === "connect"}
          aria-controls="view-connect-panel"
          onClick={() => setView("connect")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            view === "connect"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Connect &amp; Snippets</span>
          <span className="rounded-full bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-300 font-medium">Embed</span>
        </button>

        <button
          role="tab"
          aria-selected={view === "analytics"}
          aria-controls="view-analytics-panel"
          onClick={() => setView("analytics")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            view === "analytics"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <span>Analytics &amp; DuckDB</span>
        </button>

        <button
          role="tab"
          aria-selected={view === "settings"}
          aria-controls="view-settings-panel"
          onClick={() => setView("settings")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            view === "settings"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Settings</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="px-5 pb-5">
        {/* Connect & Snippets Tab */}
        {view === "connect" && (
          <div id="view-connect-panel" role="tabpanel" aria-label="Connect and Code Snippets" className="space-y-5 pt-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Submission endpoint</p>
              <div className="flex items-center gap-2 rounded-xl bg-black/50 border border-white/10 px-4 py-3">
                <code className="flex-1 break-all text-sm font-mono text-cyan-300 select-all">{endpoint}</code>
                <button
                  onClick={() => copy(endpoint, "url")}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 px-3 py-1.5 text-xs font-medium transition min-h-[36px]"
                >
                  {copied === "url" ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span className="text-emerald-300">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-Navigation Switcher for Connect & Snippets */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setConnectSubView("studio")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  connectSubView === "studio"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span>⚡ Visual Studio &amp; Snippets</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectSubView("docs")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  connectSubView === "docs"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg className="w-4 h-4 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                <span>📖 API Guide &amp; Reference</span>
                <span className="rounded-full bg-cyan-400/20 text-cyan-300 text-[10px] px-2 py-0.5 font-mono">Documentation</span>
              </button>
              <button
                type="button"
                onClick={() => setConnectSubView("security")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  connectSubView === "security"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>🛡️ Spam &amp; Security Architecture</span>
              </button>
            </div>

            {connectSubView === "studio" && (
              <>
                {/* Dynamic Fields Embed Generator Selector */}
                <div className="mt-5 rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              <span>Form Fields Generator (Customize HTML / React fields)</span>
            </p>
            <span className="text-[10px] text-slate-500 font-mono">Active fields dynamically update templates & previews</span>
          </div>

          {/* Quick-add presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">⚡ Quick-Add Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: "name", label: "👤 Name" },
                { name: "email", label: "📧 Email" },
                { name: "phone", label: "📞 Phone" },
                { name: "message", label: "💬 Message" },
                { name: "subject", label: "📌 Subject" },
                { name: "company", label: "🏢 Company" },
                { name: "website", label: "🌐 Website" },
                { name: "attachment", label: "📎 Attachment/File" },
                { name: "rating", label: "⭐ Rating" },
                { name: "country", label: "🌍 Country" },
                { name: "terms", label: "☑️ Terms Checkbox" },
              ].map((preset) => {
                const isActive = snippetFields.includes(preset.name);
                return (
                  <button
                    key={preset.name}
                    type="button"
                    disabled={isActive}
                    onClick={() => {
                      if (!snippetFields.includes(preset.name)) {
                        setSnippetFields([...snippetFields, preset.name]);
                      }
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs transition border ${
                      isActive
                        ? "bg-white/5 border-white/5 text-slate-600 cursor-not-allowed"
                        : "bg-slate-950 hover:bg-slate-900 border-white/10 text-slate-300 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">📋 Active Fields:</span>
            <div className="flex flex-wrap gap-2 items-center min-h-[36px] p-2 bg-black/20 rounded-xl border border-white/5">
              {snippetFields.length === 0 ? (
                <span className="text-xs text-slate-500 italic pl-1">No fields. Click presets or add custom fields below.</span>
              ) : (
                snippetFields.map(f => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-lg bg-slate-950 border border-white/10 pl-2.5 pr-1 py-0.5 text-xs text-slate-200">
                    <span className="font-mono">{f}</span>
                    <button
                      type="button"
                      onClick={() => removeSnippetField(f)}
                      className="text-slate-500 hover:text-rose-400 font-bold ml-1 text-sm leading-none h-5 w-5 flex items-center justify-center rounded-md hover:bg-white/5 transition"
                      title={`Remove ${f}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <form onSubmit={addSnippetField} className="flex gap-2 max-w-sm">
            <input
              required
              placeholder="Or add custom (e.g. age, address)"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="ff-input text-xs py-1.5 px-3 rounded-lg"
            />
            <button type="submit" className="rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 text-xs transition shrink-0">
              + Add Custom
            </button>
          </form>
        </div>

        {/* Code Snippet Tabs */}
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {(["html", "widget", "react", "js", "python", "curl"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSnippetTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition ${snippetTab === tab ? "bg-white/10 text-white border border-white/10" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {tab === "js" ? "JS Fetch" : tab === "widget" ? "Floating Widget" : tab}
                </button>
              ))}
            </div>
            {/* Color Customizer */}
            <div className="flex items-center gap-1.5 bg-black/25 p-1 rounded-xl border border-white/5">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-1.5">Color:</span>
              {(["cyan", "indigo", "emerald", "amber", "rose"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFormColor(c)}
                  className={`h-4 w-4 rounded-full border border-white/10 transition-transform hover:scale-125 ${
                    c === "cyan" ? "bg-cyan-500" :
                    c === "indigo" ? "bg-indigo-500" :
                    c === "emerald" ? "bg-emerald-500" :
                    c === "amber" ? "bg-amber-500" : "bg-rose-500"
                  } ${formColor === c ? "ring-2 ring-white scale-110" : ""}`}
                  title={c}
                />
              ))}
            </div>
          </div>

          {snippetTab === "html" && (
            <div className="flex flex-wrap gap-1 bg-black/25 p-1 rounded-xl w-fit border border-white/5">
              {(["plain", "contact", "glass", "minimal", "card", "newsletter", "feedback"] as const).map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setFormTemplate(tpl)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold flex items-center gap-1.5 transition ${formTemplate === tpl ? `bg-${formColor === "rose" ? "rose" : formColor === "emerald" ? "emerald" : formColor === "amber" ? "amber" : formColor === "indigo" ? "indigo" : "cyan"}-500 text-slate-950 font-bold` : "text-slate-400 hover:text-slate-200"}`}
                >
                  {tpl === "plain" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  )}
                  {tpl === "contact" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  )}
                  {tpl === "glass" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                  )}
                  {tpl === "minimal" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                  )}
                  {tpl === "card" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></svg>
                  )}
                  {tpl === "newsletter" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  )}
                  {tpl === "feedback" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  )}
                  <span>{tpl === "plain" ? "Plain HTML" : tpl === "contact" ? "Contact Form" : tpl === "glass" ? "Cyber Glass" : tpl === "minimal" ? "Minimal Line" : tpl === "card" ? "SaaS Card" : tpl === "newsletter" ? "Newsletter" : "Feedback"}</span>
                </button>
              ))}
            </div>
          )}

          {snippetTab === "widget" && (
            <div className="flex flex-wrap items-center gap-3 bg-black/25 p-2 rounded-xl border border-white/5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">Position:</span>
                <div className="flex gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-white/5">
                  <button
                    type="button"
                    onClick={() => setWidgetPosition("bottom-right")}
                    className={`px-2.5 py-1 rounded-md font-medium text-xs transition ${widgetPosition === "bottom-right" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                  >
                    Bottom-Right
                  </button>
                  <button
                    type="button"
                    onClick={() => setWidgetPosition("bottom-left")}
                    className={`px-2.5 py-1 rounded-md font-medium text-xs transition ${widgetPosition === "bottom-left" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                  >
                    Bottom-Left
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">Button Label:</span>
                <input
                  type="text"
                  value={widgetBtnText}
                  onChange={(e) => setWidgetBtnText(e.target.value)}
                  placeholder="Feedback"
                  className="px-2.5 py-1 bg-slate-950 border border-white/10 rounded-lg text-white text-xs w-28 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Grid Layout: Code on Left, Live Preview on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="relative">
              {snippetTab === "html" && <CodeHighlight code={htmlSnippet} lang="html" />}
              {snippetTab === "widget" && <CodeHighlight code={widgetSnippet} lang="html" />}
              {snippetTab === "js" && <CodeHighlight code={jsSnippet} lang="js" />}
              {snippetTab === "react" && <CodeHighlight code={reactSnippet} lang="js" />}
              {snippetTab === "python" && <CodeHighlight code={pythonSnippet} lang="python" />}
              {snippetTab === "curl" && <CodeHighlight code={curlSnippet} lang="curl" />}
              <button
                onClick={() => {
                  const text = snippetTab === "html" ? htmlSnippet : snippetTab === "widget" ? widgetSnippet : snippetTab === "js" ? jsSnippet : snippetTab === "react" ? reactSnippet : snippetTab === "python" ? pythonSnippet : curlSnippet;
                  copy(text, "copy");
                }}
                className="absolute right-3 top-3 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10"
              >
                {copied === "copy" ? "✓ Copied" : "Copy"}
              </button>
            </div>

            {/* Live Interactive Preview Box */}
            {snippetTab === "html" && (
              <div className="flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-slate-950/60 min-h-[300px]">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-cyan-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>
                    <span>Interactive Template Live Preview</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">sandbox (simulated action)</span>
                </div>
                <div className="flex-1 p-4 flex items-center justify-center bg-slate-900/40 relative">
                  <iframe
                    title="Form Template Preview"
                    sandbox="allow-scripts"
                    className="w-full h-full min-h-[280px] border-0 rounded-xl bg-transparent"
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <script>
                            // Suppress Tailwind Play CDN production advisory inside preview sandbox
                            (function() {
                              const _cw = console.warn;
                              console.warn = function(...args) {
                                if (args[0] && typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
                                _cw.apply(console, args);
                              };
                            })();
                          </script>
                          <script src="https://cdn.tailwindcss.com"></script>
                          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                          <style>
                            body { font-family: 'Inter', sans-serif; background: #0b1329; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; margin: 0; }
                            /* Star ratings script helper */
                            .ff-stars label { cursor: pointer; }
                            .ff-stars label:hover, .ff-stars label:hover ~ label { color: #fbbf24 !important; }
                          </style>
                        </head>
                        <body>
                          <div class="w-full">
                            ${htmlSnippet
                              .replace(`action="${endpoint}"`, 'action="javascript:alert(\'🚀 Success! Submission received (Live Sandbox Simulation).\')"')
                              .replace(/from-cyan-500 to-blue-600/g, 
                                formColor === "indigo" ? "from-indigo-500 to-purple-600" :
                                formColor === "emerald" ? "from-emerald-500 to-teal-600" :
                                formColor === "amber" ? "from-amber-500 to-orange-600" :
                                formColor === "rose" ? "from-rose-500 to-red-600" : "from-cyan-500 to-blue-600"
                              )
                              .replace(/bg-cyan-500/g, 
                                formColor === "indigo" ? "bg-indigo-500" :
                                formColor === "emerald" ? "bg-emerald-500" :
                                formColor === "amber" ? "bg-amber-500" :
                                formColor === "rose" ? "bg-rose-500" : "bg-cyan-500"
                              )
                              .replace(/hover:bg-cyan-400/g, 
                                formColor === "indigo" ? "hover:bg-indigo-400" :
                                formColor === "emerald" ? "hover:bg-emerald-400" :
                                formColor === "amber" ? "hover:bg-amber-400" :
                                formColor === "rose" ? "hover:bg-rose-400" : "hover:bg-cyan-400"
                              )
                              .replace(/#38bdf8/g, 
                                formColor === "indigo" ? "#6366f1" :
                                formColor === "emerald" ? "#10b981" :
                                formColor === "amber" ? "#f59e0b" :
                                formColor === "rose" ? "#f43f5e" : "#38bdf8"
                              )
                              .replace(/#6366f1/g, 
                                formColor === "indigo" ? "#a855f7" :
                                formColor === "emerald" ? "#06b6d4" :
                                formColor === "amber" ? "#ea580c" :
                                formColor === "rose" ? "#d946ef" : "#6366f1"
                              )
                            }
                          </div>
                        </body>
                      </html>
                    `}
                  />
                </div>
              </div>
            )}

            {/* Floating Widget Live Interactive Preview */}
            {snippetTab === "widget" && (
              <div className="flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-slate-950/60 min-h-[300px]">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Floating Widget Live Preview</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">zero dependencies</span>
                </div>
                <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-900/40 relative min-h-[280px] text-center">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-lg" style={{ background: `${theme.styleHex1}25`, border: `1px solid ${theme.styleHex1}50` }}>
                    💬
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">Instant Floating Popup Bubble</h4>
                  <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
                    Paste this 1 script line on any Webflow, WordPress, Shopify, Astro, or static HTML site to get a floating feedback & contact bubble.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        const existing = document.getElementById("formforge-widget-root");
                        if (existing) existing.remove();
                        const s = document.createElement("script");
                        s.src = "/widget.js";
                        s.setAttribute("data-endpoint", endpoint);
                        s.setAttribute("data-color", theme.styleHex1);
                        s.setAttribute("data-title", `Contact ${form.name}`);
                        s.setAttribute("data-position", widgetPosition);
                        s.setAttribute("data-btn-text", widgetBtnText || "Feedback");
                        document.body.appendChild(s);
                      }
                    }}
                    className="rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:scale-105"
                    style={{ background: theme.styleHex1 }}
                  >
                    ⚡ Test Floating Widget On This Page
                  </button>
                  <span className="text-[10px] text-slate-500 mt-3">Spawns {widgetPosition} bubble with glassmorphic modal</span>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}

      {connectSubView === "docs" && (
        <ApiDocumentationView
          endpoint={endpoint}
          form={form}
          apiTestLoading={apiTestLoading}
          apiTestResult={apiTestResult}
          onRunApiTest={handleRunApiTest}
          copy={copy}
          copied={copied}
        />
      )}

      {connectSubView === "security" && (
        <SecurityArchitectureView
          endpoint={endpoint}
          form={form}
        />
      )}
    </div>
  )}

    {/* Submissions Tab */}
    {view === "submissions" && (
          <div id="view-submissions-panel" role="tabpanel" aria-label="Submissions List">
            {/* Submissions Toolbar: Search, Status Filter Pills & Export Controls */}
            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Status Pills */}
                <div className="flex flex-wrap items-center gap-1.5 bg-white/[0.02] border border-white/10 rounded-xl p-1">
                  {(
                    [
                      { id: "all", label: "All", count: counts.all },
                      { id: "accepted", label: "Inbox", count: counts.accepted },
                      { id: "spam", label: "Spam", count: counts.spam },
                      { id: "pending", label: "Pending", count: counts.pending },
                    ] as const
                  ).map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setSubStatus(filter.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        subStatus === filter.id
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-slate-400 hover:text-white border border-transparent"
                      }`}
                    >
                      {filter.label} <span className="text-[10px] opacity-75">({filter.count})</span>
                    </button>
                  ))}
                  {subs.length > 0 && (
                    <label className="flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 cursor-pointer hover:bg-white/10 transition">
                      <input
                        type="checkbox"
                        checked={subs.length > 0 && selectedSubIds.length === subs.length}
                        onChange={handleToggleSelectAll}
                        className="h-3.5 w-3.5 rounded accent-cyan-400 cursor-pointer"
                      />
                      <span>Select All</span>
                    </label>
                  )}
                </div>

                {/* Export & Actions Toolbar */}
                <div className="flex items-center gap-2">
                  {counts.spam > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSpam}
                      className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-500/20 transition"
                    >
                      🗑️ Clear All Spam ({counts.spam})
                    </button>
                  )}
                  <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs text-slate-300">
                    <span className="px-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider">Export</span>
                    <a
                      href={`/api/forms/${form.id}/export?format=csv`}
                      download
                      className="px-2 py-1 hover:text-white hover:bg-white/10 rounded transition"
                      title="Download CSV"
                    >
                      CSV
                    </a>
                    <a
                      href={`/api/forms/${form.id}/export?format=json`}
                      download
                      className="px-2 py-1 hover:text-white hover:bg-white/10 rounded transition"
                      title="Download JSON"
                    >
                      JSON
                    </a>
                    <a
                      href={`/api/forms/${form.id}/export?format=pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 hover:text-white hover:bg-white/10 rounded transition"
                      title="Print / PDF Report"
                    >
                      PDF
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadSubs()}
                    className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-white/10 transition"
                    title="Refresh submissions list"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {/* Bulk Action Bar when items are selected */}
              {selectedSubIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-xs shadow-xl shadow-cyan-950/30">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                      {selectedSubIds.length} Selected
                    </span>
                    <span className="text-slate-400">of {subs.length} on this page</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold hover:bg-rose-500/30 transition shadow-sm"
                    >
                      🗑️ Delete Selected ({selectedSubIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSubIds([])}
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                    >
                      ✕ Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {/* Real-time Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search submissions by email, field name, or payload content..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading submissions…</p>
            ) : subs.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <p className="text-4xl">📭</p>
                <p className="mt-2 text-sm">{searchQuery || subStatus !== "all" ? "No matching submissions found for this filter." : "No submissions yet. Use the endpoint above to send a test."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {subs.map((sub) => (
                  <SubmissionRow
                    key={sub.id}
                    sub={sub}
                    onToggleStatus={handleToggleStatus}
                    onDelete={handleDeleteSub}
                    isSelected={selectedSubIds.includes(sub.id)}
                    onSelect={() => handleToggleSelectOne(sub.id)}
                  />
                ))}
                
                {/* Pagination Controls */}
                {total > limit && (
                  <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-4">
                    <button
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      className="rounded-xl border border-white/15 px-4 py-3 text-xs hover:bg-white/10 disabled:opacity-50 min-h-[44px]"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs text-slate-400">
                      Showing {offset + 1} - {Math.min(offset + limit, total)} of {total}
                    </span>
                    <button
                      disabled={offset + limit >= total}
                      onClick={() => setOffset(offset + limit)}
                      className="rounded-xl border border-white/15 px-4 py-3 text-xs hover:bg-white/10 disabled:opacity-50 min-h-[44px]"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {view === "analytics" && (
          <div id="view-analytics-panel" role="tabpanel" aria-label="Form Analytics">
            <FormAnalyticsPanel form={form} />
          </div>
        )}
        {view === "settings" && (
          <div id="view-settings-panel" role="tabpanel" aria-label="Form Settings">
            <FormSettingsPanel form={form} onSaved={onChanged} />
          </div>
        )}
      </div>
    </section>
  );
}

function FormAnalyticsPanel({ form }: { form: Form }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedDuckDb, setCopiedDuckDb] = useState(false);
  const [selectedQueryIndex, setSelectedQueryIndex] = useState(0);
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/forms/${form.id}/analytics`, { credentials: "include" });
        const resJson = await res.json();
        if (resJson.ok) setData(resJson.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [form.id]);

  if (loading) return <p className="py-6 text-center text-sm text-slate-500">Loading analytics…</p>;
  if (!data) return <p className="py-6 text-center text-sm text-slate-500">Failed to load analytics data.</p>;

  // Prepare timeline dates
  const timelineDates = Array.from(new Set(data.timeline.map((t: any) => t.date))).slice(-10); // last 10 days
  const maxVal = Math.max(...data.timeline.map((t: any) => t.count), 1);

  return (
    <div className="space-y-6">
      {/* Timeline Chart */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Submission Timeline (Last 30 Days)</h3>
        {data.timeline.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No data available for timeline.</p>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="flex h-48 items-end gap-3 pt-6 min-w-[500px] md:min-w-full">
              {timelineDates.map((date: any) => {
                const accepted = data.timeline.find((t: any) => t.date === date && t.status === "accepted")?.count ?? 0;
                const spam = data.timeline.find((t: any) => t.date === date && t.status === "spam")?.count ?? 0;
                const total = accepted + spam;
                const acceptedHeight = (accepted / maxVal) * 100;
                const spamHeight = (spam / maxVal) * 100;

                return (
                  <div key={date} className="group relative flex flex-1 flex-col items-center gap-1">
                    <div className="relative w-full flex flex-col justify-end h-36 bg-white/[0.03] rounded-t-lg overflow-hidden">
                      <div style={{ height: `${acceptedHeight}%` }} className="w-full bg-cyan-400" title={`Accepted: ${accepted}`} />
                      <div style={{ height: `${spamHeight}%` }} className="w-full bg-amber-400" title={`Spam: ${spam}`} />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">{date.slice(5)}</span>
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-lg bg-slate-950 border border-white/10 p-2 text-xs text-white group-hover:block z-10">
                      <p className="font-semibold">{date}</p>
                      <p className="text-cyan-300">Accepted: {accepted}</p>
                      <p className="text-amber-300">Spam: {spam}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Referrers */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Referrers</h3>
          {data.referrers.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No referrers detected.</p>
          ) : (
            <div className="space-y-2">
              {data.referrers.map((ref: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="truncate text-slate-300 max-w-[200px]" title={ref.referer}>{ref.referer}</span>
                  <span className="rounded-full bg-cyan-400/10 text-cyan-300 px-2 py-0.5">{ref.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submitters */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Top Submitters</h3>
          {data.submitters.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No submitters detected.</p>
          ) : (
            <div className="space-y-2">
              {data.submitters.map((sub: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="truncate text-slate-300 max-w-[200px]" title={sub.email}>{sub.email}</span>
                  <span className="rounded-full bg-cyan-400/10 text-cyan-300 px-2 py-0.5">{sub.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DuckDB / In-Browser Zero-Cost SQL Analytics Suite */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🦆</span>
            <div>
              <h3 className="text-sm font-bold text-emerald-300">DuckDB Client-Side Analytics & SQL Engine</h3>
              <p className="text-[11px] text-slate-400">Run instant analytics directly in your browser with zero server compute and zero database costs.</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 w-fit">
            ⚡ 0 Backend Reads
          </span>
        </div>

        {/* Quick Analytical Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
            <span className="block text-[10px] uppercase font-bold text-slate-500">Total Analyzed</span>
            <span className="text-lg font-bold text-white">{data.timeline.reduce((acc: number, t: any) => acc + (t.count || 0), 0)}</span>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
            <span className="block text-[10px] uppercase font-bold text-slate-500">Accepted Rate</span>
            <span className="text-lg font-bold text-emerald-400">
              {(() => {
                const acc = data.timeline.filter((t: any) => t.status === "accepted").reduce((s: number, t: any) => s + t.count, 0);
                const tot = data.timeline.reduce((s: number, t: any) => s + t.count, 0);
                return tot > 0 ? `${Math.round((acc / tot) * 100)}%` : "100%";
              })()}
            </span>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
            <span className="block text-[10px] uppercase font-bold text-slate-500">Spam Filtered</span>
            <span className="text-lg font-bold text-amber-400">
              {data.timeline.filter((t: any) => t.status === "spam").reduce((s: number, t: any) => s + t.count, 0)}
            </span>
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
            <span className="block text-[10px] uppercase font-bold text-slate-500">Unique Referrers</span>
            <span className="text-lg font-bold text-sky-400">{data.referrers.length}</span>
          </div>
        </div>

        {/* Interactive DuckDB Live SQL Query Studio */}
        <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">🦆 Live SQL Studio</span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Client-Side Engine</span>
            </div>
            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Daily Volume", query: "timeline" },
                { label: "Top Referrers", query: "referrers" },
                { label: "Top Submitters", query: "submitters" },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedQueryIndex(idx);
                    setQueryResult(null);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition border ${
                    selectedQueryIndex === idx
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <CodeHighlight
              code={
                selectedQueryIndex === 0
                  ? `SELECT date, status, sum(count) as total\nFROM read_csv_auto('${origin}/api/forms/${form.id}/export?format=csv')\nGROUP BY 1, 2\nORDER BY 1 DESC;`
                  : selectedQueryIndex === 1
                  ? `SELECT referer, count\nFROM read_csv_auto('${origin}/api/forms/${form.id}/export?format=csv')\nGROUP BY 1\nORDER BY 2 DESC\nLIMIT 10;`
                  : `SELECT email, count\nFROM read_csv_auto('${origin}/api/forms/${form.id}/export?format=csv')\nGROUP BY 1\nORDER BY 2 DESC\nLIMIT 10;`
              }
              lang="sql"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (selectedQueryIndex === 0) {
                  setQueryResult(data.timeline || []);
                } else if (selectedQueryIndex === 1) {
                  setQueryResult(data.referrers || []);
                } else {
                  setQueryResult(data.submitters || []);
                }
              }}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              ▶️ Run Query in Browser
            </button>
            <button
              type="button"
              onClick={async () => {
                const cmd = `duckdb -c "SELECT * FROM read_csv_auto('${origin}/api/forms/${form.id}/export?format=csv');"`;
                await navigator.clipboard.writeText(cmd);
                setCopiedDuckDb(true);
                setTimeout(() => setCopiedDuckDb(false), 2000);
              }}
              className="rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5"
            >
              {copiedDuckDb ? "✓ Copied CLI Command" : "🦆 Copy DuckDB Shell CLI"}
            </button>
            <button
              type="button"
              onClick={async () => {
                const sql = `CREATE TABLE ${form.slug.replace(/[^a-z0-9_]/g, "_")}_submissions AS SELECT * FROM read_csv_auto('${origin}/api/forms/${form.id}/export?format=csv');`;
                await navigator.clipboard.writeText(sql);
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2000);
              }}
              className="rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5"
            >
              {copiedSql ? "✓ Copied MotherDuck SQL" : "🦆 Copy MotherDuck SQL"}
            </button>
          </div>

          {/* Tabular Result View */}
          {queryResult && (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 mt-3 animate-slide-up">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                  ✓ Query Executed Locally • {queryResult.length} Rows Processed
                </span>
                <span className="text-[10px] text-slate-500 font-mono">0ms latency · 0 server cost</span>
              </div>
              {queryResult.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No matching records found in dataset.</p>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-400 font-mono">
                      {Object.keys(queryResult[0]).map((col) => (
                        <th key={col} className="py-2 px-3 font-semibold text-sky-300 capitalize">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        {Object.entries(row).map(([k, v]: any) => (
                          <td key={k} className="py-2 px-3 text-slate-200 font-mono text-[11px]">
                            {String(v ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Quick Export Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
          <a
            href={`/api/forms/${form.id}/submissions?format=csv`}
            download={`${form.slug}-submissions.csv`}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition flex items-center gap-1.5"
          >
            📥 Export CSV
          </a>
          <a
            href={`/api/forms/${form.id}/submissions?format=json`}
            download={`${form.slug}-submissions.json`}
            className="rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition flex items-center gap-1.5"
          >
            📋 Export JSON
          </a>
          <button
            type="button"
            onClick={async () => {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const cmd = `duckdb -c "SELECT * FROM read_csv_auto('${origin}/api/forms/${form.id}/export?format=csv');"`;
              await navigator.clipboard.writeText(cmd);
              setCopiedDuckDb(true);
              setTimeout(() => setCopiedDuckDb(false), 2000);
            }}
            className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition flex items-center gap-1.5"
          >
            {copiedDuckDb ? "✓ Copied CLI Command" : "🦆 Copy DuckDB Query"}
          </button>
          <span className="text-[11px] text-slate-500 self-center ml-auto">
            Compatible with DuckDB, MotherDuck, Excel & Pandas.
          </span>
        </div>
      </div>
    </div>
  );
}

function SubmissionRow({
  sub,
  onToggleStatus,
  onDelete,
  isSelected,
  onSelect,
}: {
  sub: Submission;
  onToggleStatus?: (subId: string, currentStatus: string) => void;
  onDelete?: (subId: string) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewType, setViewType] = useState<"table" | "json">("table");
  const [copiedJson, setCopiedJson] = useState(false);
  
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(sub.payload) as Record<string, unknown>;
  } catch {
    payload = { raw: sub.payload };
  }

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };
  
  const preview = Object.entries(payload).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(" · ");

  return (
    <div className={`rounded-2xl border transition ${isSelected ? "border-cyan-500/50 bg-cyan-500/[0.07]" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"}`}>
      <div className="flex items-center gap-2 px-3 py-1">
        {onSelect && (
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={onSelect}
            className="h-4 w-4 rounded accent-cyan-400 cursor-pointer shrink-0 ml-1"
            title="Select submission"
          />
        )}
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
          <span className={`h-2 w-2 shrink-0 rounded-full ${sub.status === "spam" ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden="true" />
          <span className="sr-only">Status: {sub.status}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-300">{preview || "(empty)"}</p>
            <p className="text-xs text-slate-500">{timeAgo(sub.createdAt)}{sub.email ? ` · ${sub.email}` : ""}{sub.spamScore > 0 ? ` · spam:${sub.spamScore}` : ""}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${sub.status === "spam" ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>{sub.status}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 px-4 py-4 space-y-3">
          {/* Tab Selector & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setViewType("table")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewType === "table" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                📋 Table View
              </button>
              <button
                type="button"
                onClick={() => setViewType("json")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewType === "json" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                💻 Raw JSON
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyPayload}
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                {copiedJson ? "✓ Copied" : "📋 Copy"}
              </button>
              {onToggleStatus && (
                <button
                  type="button"
                  onClick={() => onToggleStatus(sub.id, sub.status)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    sub.status === "spam"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  }`}
                >
                  {sub.status === "spam" ? "Inbox ✓" : "Flag Spam ⚠️"}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(sub.id)}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/20 transition"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>

          {viewType === "table" ? (
            <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20 p-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400">
                    <th className="py-2 px-3 font-semibold">Field</th>
                    <th className="py-2 px-3 font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(payload).map(([k, v]) => (
                    <tr key={k} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01]">
                      <td className="py-2.5 px-3 font-bold text-sky-300 font-mono">{k}</td>
                      <td className="py-2.5 px-3 text-slate-200 break-all select-all">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="overflow-x-auto text-xs leading-6 text-slate-300 rounded-xl border border-white/5 bg-black/20 p-4">
              <code>{JSON.stringify(payload, null, 2)}</code>
            </pre>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[10px] text-slate-500">
            {sub.referer && <span>Referer: <a href={sub.referer} target="_blank" className="hover:underline text-slate-400">{sub.referer}</a></span>}
            {sub.ipHash && (
              <span>
                IP: <code className="select-all">
                  {sub.ipHash.length === 64 ? `${sub.ipHash.slice(0, 8)}... (Hashed)` : sub.ipHash}
                </code>
              </span>
            )}
            <span>ID: <code className="select-all">{sub.id}</code></span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Form Settings ─────────────────── */

function FormSettingsPanel({ form, onSaved }: { form: Form; onSaved: () => void }) {
  const [name, setName] = useState(form.name);
  const [slug, setSlug] = useState(form.slug);
  const [allowedOrigins, setAllowedOrigins] = useState(form.allowedOrigins);
  const [honeypot, setHoneypot] = useState(form.honeypotField);
  const [successMsg, setSuccessMsg] = useState(form.successMessage);
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl ?? "");
  const [webhookUrl, setWebhookUrl] = useState(form.webhookUrl ?? "");
  const [emailTo, setEmailTo] = useState(form.emailTo ?? "");
  const [notifyEmail, setNotifyEmail] = useState(form.notifyEmail);
  const [altchaEnabled, setAltchaEnabled] = useState(form.altchaEnabled ?? false);
  const [autoresponderSubject, setAutoresponderSubject] = useState(form.autoresponderSubject ?? "");
  const [autoresponderBody, setAutoresponderBody] = useState(form.autoresponderBody ?? "");
  const [spamBlocklist, setSpamBlocklist] = useState(form.spamBlocklist ?? "");
  const [retentionDays, setRetentionDays] = useState(form.retentionDays ?? 0);
  const [customDays, setCustomDays] = useState((form.retentionDays && ![0, 30, 60, 90].includes(form.retentionDays)) ? form.retentionDays : 15);
  const [isCustom, setIsCustom] = useState((form.retentionDays && ![0, 30, 60, 90].includes(form.retentionDays)) ? true : false);
  const [storeIpHash, setStoreIpHash] = useState(form.storeIpHash ?? true);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(form.emailVerificationEnabled ?? false);
  const [smtpEnabled, setSmtpEnabled] = useState(form.smtpEnabled ?? false);
  const [smtpHost, setSmtpHost] = useState(form.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(form.smtpPort?.toString() ?? "587");
  const [smtpUser, setSmtpUser] = useState(form.smtpUser ?? "");
  const [smtpPass, setSmtpPass] = useState(form.smtpPass ?? "");
  const [smtpFrom, setSmtpFrom] = useState(form.smtpFrom ?? "");
  const [gasUrl, setGasUrl] = useState(form.gasUrl ?? "");
  const [showGasScript, setShowGasScript] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState(form.telegramBotToken ?? "");
  const [telegramChatId, setTelegramChatId] = useState(form.telegramChatId ?? "");
  const [ntfyTopic, setNtfyTopic] = useState(form.ntfyTopic ?? "");
  const [otpEnabled, setOtpEnabled] = useState(form.otpEnabled ?? false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  async function runTest(target: "webhook" | "gas" | "telegram" | "ntfy") {
    setTestingTarget(target);
    try {
      const res = await fetch(`/api/forms/${form.id}/test-webhook`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          url: target === "webhook" ? webhookUrl : gasUrl,
          token: telegramBotToken,
          chatId: telegramChatId,
          topic: ntfyTopic,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResults((prev) => ({
          ...prev,
          [target]: {
            ok: true,
            message: `✓ Delivered (${data.data.status || 200}, ${data.data.elapsedMs}ms)`,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [target]: { ok: false, message: `❌ ${data.message || "Failed"}` },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [target]: { ok: false, message: `❌ ${err instanceof Error ? err.message : String(err)}` },
      }));
    } finally {
      setTestingTarget(null);
    }
  }

  useEffect(() => {
    setName(form.name);
    setSlug(form.slug);
    setAllowedOrigins(form.allowedOrigins);
    setHoneypot(form.honeypotField);
    setSuccessMsg(form.successMessage);
    setRedirectUrl(form.redirectUrl ?? "");
    setWebhookUrl(form.webhookUrl ?? "");
    setEmailTo(form.emailTo ?? "");
    setNotifyEmail(form.notifyEmail);
    setAltchaEnabled(form.altchaEnabled ?? false);
    setAutoresponderSubject(form.autoresponderSubject ?? "");
    setAutoresponderBody(form.autoresponderBody ?? "");
    setSpamBlocklist(form.spamBlocklist ?? "");
    setRetentionDays(form.retentionDays ?? 0);
    setStoreIpHash(form.storeIpHash ?? true);
    setEmailVerificationEnabled(form.emailVerificationEnabled ?? false);
    setSmtpEnabled(form.smtpEnabled ?? false);
    setSmtpHost(form.smtpHost ?? "");
    setSmtpPort(form.smtpPort?.toString() ?? "587");
    setSmtpUser(form.smtpUser ?? "");
    setSmtpPass(form.smtpPass ?? "");
    setSmtpFrom(form.smtpFrom ?? "");
    setGasUrl(form.gasUrl ?? "");
    setTelegramBotToken(form.telegramBotToken ?? "");
    setTelegramChatId(form.telegramChatId ?? "");
    setNtfyTopic(form.ntfyTopic ?? "");
    setOtpEnabled(form.otpEnabled ?? false);
    const custom = (form.retentionDays && ![0, 30, 60, 90].includes(form.retentionDays)) ? true : false;
    setIsCustom(custom);
    if (custom) {
      setCustomDays(form.retentionDays);
    }
  }, [form]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          allowedOrigins,
          honeypotField: honeypot,
          successMessage: successMsg,
          redirectUrl: redirectUrl || null,
          webhookUrl: webhookUrl || null,
          emailTo: emailTo || null,
          notifyEmail,
          altchaEnabled,
          autoresponderSubject: autoresponderSubject || null,
          autoresponderBody: autoresponderBody || null,
          spamBlocklist: spamBlocklist || null,
          retentionDays: isCustom ? Number(customDays) : Number(retentionDays),
          emailVerificationEnabled,
          storeIpHash,
          smtpEnabled,
          smtpHost: smtpHost || null,
          smtpPort: smtpPort ? Number(smtpPort) : null,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
          smtpFrom: smtpFrom || null,
          gasUrl: gasUrl || null,
          telegramBotToken: telegramBotToken || null,
          telegramChatId: telegramChatId || null,
          ntfyTopic: ntfyTopic || null,
          otpEnabled,
        }),
      });
      const data = await res.json();
      if (data.ok) { setMsg("Saved ✓"); onSaved(); } else { setMsg(data.message ?? "Error"); }
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {/* Section 1: General Settings */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">📝 General Settings</h4>
        <div>
          <label htmlFor="settings-name" className="mb-1 block text-xs text-slate-400">Form name</label>
          <input id="settings-name" required value={name} onChange={(e) => setName(e.target.value)} className="ff-input text-sm" />
        </div>
        <div>
          <label htmlFor="settings-slug" className="mb-1 block text-xs text-slate-400">Form slug (URL identifier)</label>
          <input id="settings-slug" required value={slug} onChange={(e) => setSlug(e.target.value)} className="ff-input text-sm font-mono" />
        </div>
        <div>
          <label htmlFor="settings-origins" className="mb-1 block text-xs text-slate-400">Allowed origins (* = any, or https://mysite.com)</label>
          <input id="settings-origins" value={allowedOrigins} onChange={(e) => setAllowedOrigins(e.target.value)} className="ff-input text-sm" />
        </div>
        <div>
          <label htmlFor="settings-success" className="mb-1 block text-xs text-slate-400">Success message (shown after submission)</label>
          <input id="settings-success" value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)} className="ff-input text-sm" />
        </div>
        <div>
          <label htmlFor="settings-redirect" className="mb-1 block text-xs text-slate-400">Redirect URL after submit (optional)</label>
          <input id="settings-redirect" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className="ff-input text-sm" placeholder="https://mysite.com/thanks" />
        </div>
        {/* Database Storage & Retention Policy */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="settings-retention" className="block text-xs font-bold text-white flex items-center gap-1.5">
              <span>💾 Database Storage &amp; Auto-Cleanup Policy</span>
            </label>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Zero Storage Bloat
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            FormForge runs automated background purging on every new submission. Submissions older than the specified duration are permanently deleted from Cloudflare D1 to ensure minimal database size and keep you 100% within free-tier quotas.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {[
              { days: 0, label: "Keep Forever", desc: "No auto-delete" },
              { days: 7, label: "7 Days", desc: "Ultra-lean free tier" },
              { days: 30, label: "30 Days", desc: "Recommended" },
              { days: 60, label: "60 Days", desc: "Bi-monthly clean" },
              { days: 90, label: "90 Days", desc: "Quarterly purge" },
            ].map((preset) => {
              const isSelected = !isCustom && retentionDays === preset.days;
              return (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => {
                    setIsCustom(false);
                    setRetentionDays(preset.days);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-500/15 text-white shadow-sm"
                      : "border-white/10 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>{preset.label}</span>
                    {isSelected && <span className="text-cyan-400 text-[10px]">✓</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCustom(!isCustom)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium"
            >
              {isCustom ? "Use standard presets above" : "Custom days limit..."}
            </button>
          </div>

          {isCustom && (
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
              <label htmlFor="settings-custom-retention" className="block text-xs font-semibold text-slate-300">
                Specify Custom Days:
              </label>
              <input
                id="settings-custom-retention"
                type="number"
                min="1"
                max="3650"
                value={customDays}
                onChange={(e) => setCustomDays(Number(e.target.value))}
                className="ff-input text-sm"
                placeholder="e.g. 15, 45, 180"
              />
              <p className="text-[10px] text-slate-500">Submissions older than {customDays || "X"} days will be automatically deleted from D1.</p>
            </div>
          )}
        </div>
        <div className="border-t border-white/5 pt-4">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={emailVerificationEnabled} onChange={() => setEmailVerificationEnabled(!emailVerificationEnabled)} className="h-4 w-4 rounded" />
            Enable Submitter Email Verification (Double Opt-in)
          </label>
          <p className="text-[10px] text-slate-500 pl-6 mt-1">If enabled, submitters must verify their email address via a confirmation link sent by FormForge before notifications are triggered and the submission is accepted.</p>
        </div>
        <div className="border-t border-white/5 pt-4">
          <label className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <input type="checkbox" checked={otpEnabled} onChange={() => setOtpEnabled(!otpEnabled)} className="h-4 w-4 rounded text-sky-500" />
            🔐 Require 6-Digit OTP Verification for Submissions
          </label>
          <p className="text-[10px] text-slate-500 pl-6 mt-1">If enabled, submitters receive an instant 6-digit OTP code to verify their email address before the submission is accepted. Zero card / zero cost.</p>
        </div>
      </div>

      {/* Section 2: Spam & Security */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">🛡️ Spam & Security</h4>
        <div>
          <label htmlFor="settings-honeypot" className="mb-1 block text-xs text-slate-400">Honeypot field name (hidden trap for bots)</label>
          <input id="settings-honeypot" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="ff-input text-sm" />
        </div>

        <div>
          <label htmlFor="settings-blocklist" className="mb-1 block text-xs text-slate-400">Custom Spam Blocklist Words (comma-separated, e.g. crypto, spam, viagra)</label>
          <input id="settings-blocklist" value={spamBlocklist} onChange={(e) => setSpamBlocklist(e.target.value)} className="ff-input text-sm" placeholder="crypto, casino, lottery" />
        </div>
        
        {/* ALTCHA Proof-of-Work Anti-Spam (100% Free, Zero-Config, Self-Hosted) */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={altchaEnabled}
                  onChange={() => setAltchaEnabled(!altchaEnabled)}
                  className="h-4 w-4 rounded accent-cyan-400"
                />
                <span>Enable ALTCHA Proof-of-Work Anti-Spam (100% Free &amp; Self-Hosted)</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1 pl-6 leading-relaxed">
                Zero cookies, privacy-first, and zero external dependencies. Eliminates bot spam via silent in-browser Proof-of-Work. No Cloudflare Turnstile, no Google reCAPTCHA, and zero secret keys required.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
              Free &bull; Self-Hosted
            </span>
          </div>

          {altchaEnabled && (
            <div className="ml-6 mt-2 rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Challenge URL for widget:</span>
                <span className="text-[10px] text-emerald-400 font-mono">Ready to use</span>
              </div>
              <code className="block break-all text-xs font-mono text-cyan-300 bg-white/5 p-2 rounded-lg select-all">
                {typeof window !== "undefined" ? `${window.location.origin}/api/altcha/challenge` : "/api/altcha/challenge"}
              </code>
              <p className="text-[10px] text-slate-500">
                The official <code className="text-cyan-400">&lt;altcha-widget&gt;</code> will automatically fetch challenges and include the solved token in your form submissions.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-white/5 pt-4 space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={!storeIpHash} onChange={() => setStoreIpHash(!storeIpHash)} className="h-4 w-4 rounded" />
            Collect and show Client IP addresses in submissions
          </label>
          <p className="text-[10px] text-slate-500 pl-6">If enabled, the submitter&apos;s raw IP address (e.g. 44.22.181.5) will be stored and displayed on the dashboard instead of a secure anonymized hash.</p>
        </div>
      </div>

      {/* Section 3: Webhook & Integrations */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">💬 Notifications & Webhooks</h4>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="settings-webhook" className="block text-xs text-slate-400">Webhook URL (Slack / Discord / Custom endpoint)</label>
            <button
              type="button"
              disabled={!webhookUrl || testingTarget === "webhook"}
              onClick={() => runTest("webhook")}
              className="rounded-lg bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-40 transition"
            >
              {testingTarget === "webhook" ? "⚡ Testing..." : "⚡ Test Webhook"}
            </button>
          </div>
          <input id="settings-webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="ff-input text-sm" placeholder="https://hooks.slack.com/... or discord.com/api/webhooks/..." />
          {testResults.webhook && (
            <p className={`text-[11px] mt-1.5 font-medium ${testResults.webhook.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {testResults.webhook.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="settings-email" className="mb-1 block text-xs text-slate-400">Email notification address (optional)</label>
          <input id="settings-email" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="ff-input text-sm" placeholder="notify@example.com" />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={notifyEmail} onChange={() => setNotifyEmail(!notifyEmail)} className="h-4 w-4 rounded" />
          Enable email alerts (requires RESEND_API_KEY config or SMTP below)
        </label>

        {notifyEmail && (
          <div className="border-t border-white/5 pt-4 space-y-4">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={smtpEnabled} onChange={() => setSmtpEnabled(!smtpEnabled)} className="h-4 w-4 rounded" />
              Use Custom SMTP Server (instead of Resend API)
            </label>

            {smtpEnabled && (
              <div className="space-y-4 pl-4 border-l-2 border-sky-500/30 mt-2">
                <div>
                  <label htmlFor="smtp-email" className="mb-1 block text-xs text-slate-400">Your Email / SMTP Username</label>
                  <input id="smtp-email" value={smtpUser} onChange={(e) => {
                    const val = e.target.value;
                    setSmtpUser(val);
                    if (val.trim().toLowerCase().endsWith("@gmail.com")) {
                      setSmtpHost("smtp.gmail.com");
                      setSmtpPort("587");
                    }
                  }} className="ff-input text-sm" placeholder="your.email@example.com" />
                </div>
                <div>
                  <label htmlFor="smtp-password" className="mb-1 block text-xs text-slate-400">SMTP Password</label>
                  <input id="smtp-password" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="ff-input text-sm" placeholder={smtpUser.trim().toLowerCase().endsWith("@gmail.com") ? "Enter your 16-character Gmail App Password" : "Enter your SMTP password"} />
                  {smtpUser.trim().toLowerCase().endsWith("@gmail.com") && (
                    <p className="text-[10px] text-slate-500 mt-1">For Gmail, use a 16-character Gmail App Password instead of your regular password. Go to Google Account → Security → 2-Step Verification → App passwords.</p>
                  )}
                </div>
                {!smtpUser.trim().toLowerCase().endsWith("@gmail.com") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="smtp-host" className="mb-1 block text-xs text-slate-400">SMTP Host</label>
                      <input id="smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="ff-input text-sm" placeholder="smtp.example.com" />
                    </div>
                    <div>
                      <label htmlFor="smtp-port" className="mb-1 block text-xs text-slate-400">SMTP Port</label>
                      <input id="smtp-port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} className="ff-input text-sm" placeholder="587" />
                    </div>
                  </div>
                )}
                <div>
                  <label htmlFor="smtp-from" className="mb-1 block text-xs text-slate-400">Sender Email (From)</label>
                  <input id="smtp-from" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} className="ff-input text-sm" placeholder="your.email@example.com" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" disabled={busy || !smtpUser || !smtpPass} onClick={async () => {
                    setBusy(true);
                    setMsg("");
                    try {
                      const res = await fetch(`/api/forms/${form.id}/test-smtp`, {
                        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom })
                      });
                      const data = await res.json();
                      if (data.ok) {
                        setMsg("✓ Test email sent successfully! Please check your inbox.");
                      } else {
                        setMsg(`❌ Test failed: ${data.message || "Unknown error"}`);
                      }
                    } catch (err) {
                      setMsg(`❌ Error sending test: ${err instanceof Error ? err.message : String(err)}`);
                    } finally {
                      setBusy(false);
                    }
                  }} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/5 transition disabled:opacity-50">
                    Send test email
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Autoresponder */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">📧 Submitter Autoresponder</h4>
        <div>
          <label htmlFor="settings-auto-subject" className="mb-1 block text-xs text-slate-400">Email Subject</label>
          <input id="settings-auto-subject" value={autoresponderSubject} onChange={(e) => setAutoresponderSubject(e.target.value)} className="ff-input text-sm" placeholder="Thank you for contacting us!" />
        </div>
        <div>
          <label htmlFor="settings-auto-body" className="mb-1 block text-xs text-slate-400">Email Message (Use {`{field}`} e.g. {`{name}`} to customize body text)</label>
          <textarea id="settings-auto-body" value={autoresponderBody} onChange={(e) => setAutoresponderBody(e.target.value)} rows={4} className="ff-input text-sm" placeholder="Hi {name},&#10;&#10;We received your message! We will get back to you soon." />
        </div>
      </div>

      {/* Section 5: 100% Free-Tier Realtime Integrations */}
      <div className="rounded-2xl border border-sky-500/20 bg-sky-950/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-sky-300 flex items-center gap-2">⚡ 100% Free-Tier Realtime Integrations</h4>
          <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-semibold text-sky-400">Zero Credit Card</span>
        </div>
        
        {/* Google Apps Script Relay */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="settings-gas-url" className="block text-xs font-semibold text-white">
              📊 Google Apps Script (GAS) Webhook URL
            </label>
            <button
              type="button"
              onClick={() => setShowGasScript(!showGasScript)}
              className="text-[11px] text-sky-400 hover:text-sky-300 underline font-medium"
            >
              {showGasScript ? "Hide Script Code" : "📜 Get Free Google Apps Script Code"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="settings-gas-url"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              className="ff-input text-sm flex-1"
              placeholder="https://script.google.com/macros/s/.../exec"
            />
            <button
              type="button"
              disabled={!gasUrl || testingTarget === "gas"}
              onClick={() => runTest("gas")}
              className="rounded-xl bg-sky-500/15 border border-sky-500/30 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-40 transition shrink-0"
            >
              {testingTarget === "gas" ? "Testing..." : "⚡ Test GAS Relay"}
            </button>
          </div>
          {testResults.gas && (
            <p className={`text-[11px] mt-1 font-medium ${testResults.gas.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {testResults.gas.message}
            </p>
          )}
          <p className="text-[10px] text-slate-400">
            Sends submission data to your Google Apps Script Web App. Allows <strong>1,500 free emails/day</strong> via your Gmail + automatically logs rows into Google Sheets!
          </p>

          {showGasScript && (
            <div className="rounded-xl border border-white/10 bg-slate-950 p-4 space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs text-slate-300 font-semibold">
                <span>Google Apps Script Code (Paste in script.google.com)</span>
                <span className="text-[10px] text-sky-400">Deploy as Web App (Anyone)</span>
              </div>
              <pre className="text-[11px] font-mono bg-slate-900 p-3 rounded-lg overflow-x-auto text-slate-300 select-all max-h-48 whitespace-pre">
{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // 1. Send free email via Gmail (500-1500/day free)
    if (data.emailTo) {
      MailApp.sendEmail({
        to: data.emailTo,
        subject: "New FormForge Submission: " + (data.form ? data.form.name : "Form"),
        body: JSON.stringify(data.payload, null, 2)
      });
    }
    
    // 2. Append to Google Sheet (optional)
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    if (sheet) {
      var row = [new Date(), data.form ? data.form.name : "", data.submission ? data.submission.id : ""];
      for (var key in data.payload) { row.push(data.payload[key]); }
      sheet.getActiveSheet().appendRow(row);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
              </pre>
            </div>
          )}
        </div>

        {/* Telegram Bot Notification */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-white flex items-center gap-1.5">
              <span>✈️ Telegram Bot Instant Push Notifications</span>
              <span className="text-[10px] text-slate-400 font-normal">(100% Free & Unlimited)</span>
            </label>
            <button
              type="button"
              disabled={!telegramBotToken || !telegramChatId || testingTarget === "telegram"}
              onClick={() => runTest("telegram")}
              className="rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-40 transition"
            >
              {testingTarget === "telegram" ? "Testing..." : "⚡ Test Telegram Bot"}
            </button>
          </div>
          {testResults.telegram && (
            <p className={`text-[11px] font-medium ${testResults.telegram.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {testResults.telegram.message}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-tg-token" className="mb-1 block text-[10px] text-slate-400">Telegram Bot Token (from @BotFather)</label>
              <input
                id="settings-tg-token"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className="ff-input text-xs font-mono"
                placeholder="123456789:ABCdefGHI..."
              />
            </div>
            <div>
              <label htmlFor="settings-tg-chat" className="mb-1 block text-[10px] text-slate-400">Chat ID (from @userinfobot)</label>
              <input
                id="settings-tg-chat"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="ff-input text-xs font-mono"
                placeholder="e.g. 987654321"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500">Create a bot in 30 seconds via @BotFather on Telegram. You will receive instant mobile push notifications with form submission data.</p>
        </div>

        {/* ntfy.sh Push */}
        <div className="border-t border-white/5 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="settings-ntfy" className="block text-xs font-semibold text-white flex items-center gap-1.5">
              <span>🔔 ntfy.sh Instant Mobile Push (Zero-Account Required)</span>
            </label>
            <button
              type="button"
              disabled={!ntfyTopic || testingTarget === "ntfy"}
              onClick={() => runTest("ntfy")}
              className="rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-40 transition"
            >
              {testingTarget === "ntfy" ? "Testing..." : "⚡ Test ntfy Push"}
            </button>
          </div>
          {testResults.ntfy && (
            <p className={`text-[11px] font-medium ${testResults.ntfy.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {testResults.ntfy.message}
            </p>
          )}
          <input
            id="settings-ntfy"
            value={ntfyTopic}
            onChange={(e) => setNtfyTopic(e.target.value)}
            className="ff-input text-sm"
            placeholder="e.g. my-private-form-topic-9928"
          />
          <p className="text-[10px] text-slate-400">
            Subscribe to this topic in the free ntfy mobile app or visit <code className="text-sky-400">https://ntfy.sh/{ntfyTopic || "your-topic"}</code> in any browser to get instant alerts.
          </p>
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.includes("✓") ? "text-emerald-400 font-semibold" : "text-rose-400"}`}>{msg}</p>}
      <button disabled={busy} className="rounded-2xl bg-sky-500 px-6 py-4 font-bold text-white hover:bg-sky-400 transition disabled:opacity-60 min-h-[44px] shadow-lg shadow-sky-500/10">{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm text-slate-400">{label}</label>{children}</div>;
}

/* ─────────────────── API Keys Tab ─────────────────── */

function KeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("0");
  const [created, setCreated] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formsList, setFormsList] = useState<{ id: string, name: string }[]>([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [apiTab, setApiTab] = useState("curl");

  const copyKey = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/api-keys", { credentials: "include" });
    const data = await res.json();
    if (data.ok) setKeys(data.data.apiKeys);
  }, []);

  useEffect(() => {
    load();
    const fetchForms = async () => {
      try {
        const res = await fetch("/api/forms", { credentials: "include" });
        const data = await res.json();
        if (data.ok && data.data.forms && data.data.forms.length > 0) {
          setFormsList(data.data.forms);
          setSelectedFormId(data.data.forms[0].id);
        }
      } catch (err) {
        console.error("Failed to load forms list", err);
      }
    };
    fetchForms();
  }, [load]);


  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, expiresInDays: Number(expiresInDays) })
      });
      const data = await res.json();
      if (data.ok) {
        setCreated(data.data.apiKey);
        setName("");
        setExpiresInDays("0");
        await load();
      }
    } finally { setBusy(false); }
  }

  async function revokeKey(id: string) {
    const confirmation = window.confirm("Are you sure you want to revoke this API key? Applications using this key will immediately fail.");
    if (!confirmation) return;
    await fetch(`/api/api-keys?id=${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">API Keys</h2>
        <p className="mt-1 text-sm text-slate-400">Use API keys to read forms and submissions programmatically.</p>
      </div>

      <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="create-key-name" className="block text-xs text-slate-400 mb-1">Key Name</label>
          <input id="create-key-name" required placeholder="Production API Key" value={name} onChange={(e) => setName(e.target.value)} className="ff-input text-sm" />
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="create-key-expiry" className="block text-xs text-slate-400 mb-1">Expiration</label>
          <select
            id="create-key-expiry"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            className="ff-input text-sm bg-slate-900 text-white border border-white/10"
          >
            <option value="0" className="bg-slate-950 text-white">Never Expire</option>
            <option value="30" className="bg-slate-950 text-white">30 Days</option>
            <option value="90" className="bg-slate-950 text-white">90 Days</option>
            <option value="365" className="bg-slate-950 text-white">365 Days</option>
          </select>
        </div>
        <button disabled={busy} className="rounded-2xl bg-sky-500 px-5 py-3.5 text-sm font-bold text-white hover:bg-sky-400 transition disabled:opacity-60 min-h-[44px] shadow-lg shadow-sky-500/10">{busy ? "Creating…" : "Create key"}</button>
      </form>

      {created && (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-amber-200">⚠️ Copy this key now — it will NOT be shown again:</p>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2">
              <code className="flex-1 break-all text-sm text-amber-100">{created}</code>
              <button
                onClick={() => copyKey(created)}
                className="shrink-0 text-xs rounded-lg bg-amber-500/20 border border-amber-300/30 px-3 py-2 text-amber-200 hover:bg-amber-500/30 transition min-h-[44px]"
              >
                {keyCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">📖 API Integration Guide</h4>
            <p className="text-xs text-slate-300 leading-5">
              <strong>What is this for?</strong> Use this API to retrieve and load form submissions programmatically into your external website, mobile app, or custom backend service.
            </p>

            {/* Step 1: Select Form */}
            <div className="rounded-xl bg-black/20 p-3 space-y-2 border border-white/5">
              <label className="block text-xs font-semibold text-slate-300">1. Select Form ID:</label>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
              >
                <option value="">-- Choose a Form --</option>
                {formsList.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">Choosing a form dynamically pre-fills its ID and your API Key inside the code snippet below.</p>
            </div>

            {/* Step 2: Code Snippets with Tabs */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">2. Copy Code Snippet:</label>
              <div className="flex gap-1.5 border-b border-white/5 pb-2">
                {[
                  { id: "curl", name: "cURL (Terminal)" },
                  { id: "js", name: "JavaScript (Fetch)" },
                  { id: "python", name: "Python" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setApiTab(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${apiTab === tab.id ? "bg-white/10 text-white border border-white/10" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              <div className="relative">
                {apiTab === "curl" && (
                  <pre className="text-[11px] bg-slate-950 p-3.5 rounded-lg text-slate-300 font-mono whitespace-pre-wrap break-all leading-5">
                    curl -H &quot;Authorization: Bearer {created}&quot; \<br />
                    &nbsp;&nbsp;&quot;{typeof window !== "undefined" ? window.location.origin : ""}/api/forms/{selectedFormId || "YOUR_FORM_ID"}/submissions"
                  </pre>
                )}

                {apiTab === "js" && (
                  <pre className="text-[11px] bg-slate-950 p-3.5 rounded-lg text-slate-300 font-mono whitespace-pre-wrap break-all leading-5">
                    {`fetch("${typeof window !== "undefined" ? window.location.origin : ""}/api/forms/${selectedFormId || "YOUR_FORM_ID"}/submissions", {
  method: "GET",
  headers: {
    "Authorization": "Bearer ${created}"
  }
})
  .then(res => res.json())
  .then(data => console.log(data));`}
                  </pre>
                )}

                {apiTab === "python" && (
                  <pre className="text-[11px] bg-slate-950 p-3.5 rounded-lg text-slate-300 font-mono whitespace-pre-wrap break-all leading-5">
                    {`import requests

url = "${typeof window !== "undefined" ? window.location.origin : ""}/api/forms/${selectedFormId || "YOUR_FORM_ID"}/submissions"
headers = {
    "Authorization": "Bearer ${created}"
}

response = requests.get(url, headers=headers)
print(response.json())`}
                  </pre>
                )}

                <button
                  onClick={() => {
                    const code = apiTab === "curl" 
                      ? `curl -H "Authorization: Bearer ${created}" "${typeof window !== "undefined" ? window.location.origin : ""}/api/forms/${selectedFormId || "YOUR_FORM_ID"}/submissions"`
                      : apiTab === "js"
                      ? `fetch("${typeof window !== "undefined" ? window.location.origin : ""}/api/forms/${selectedFormId || "YOUR_FORM_ID"}/submissions", { method: "GET", headers: { "Authorization": "Bearer ${created}" } }).then(res => res.json()).then(console.log);`
                      : `import requests\nurl = "${typeof window !== "undefined" ? window.location.origin : ""}/api/forms/${selectedFormId || "YOUR_FORM_ID"}/submissions"\nheaders = { "Authorization": "Bearer ${created}" }\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
                    copyKey(code);
                  }}
                  className="absolute right-2.5 top-2.5 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
                >
                  {keyCopied ? "✓ Copied" : "Copy Code"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {keys.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No API keys yet.</p>}
        {keys.map((key) => {
          const isExpired = key.expiresAt ? new Date(key.expiresAt).getTime() < Date.now() : false;
          return (
            <div key={key.id} className={`rounded-2xl border px-4 py-3 flex items-center justify-between transition ${isExpired ? "border-rose-500/20 bg-rose-500/5 opacity-60" : "border-white/5 bg-white/[0.02]"}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{key.name}</p>
                  <span className="text-[10px] text-slate-500">{timeAgo(key.createdAt)}</span>
                  {isExpired && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] text-rose-300 font-bold uppercase">Expired</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5"><code>{key.keyPrefix}…</code> · {key.scopes}</p>
                {key.expiresAt && !isExpired && (
                  <p className="text-[10px] text-slate-500 mt-1">Expires: {new Date(key.expiresAt).toLocaleDateString()}</p>
                )}
              </div>
              <button
                onClick={() => revokeKey(key.id)}
                className="rounded-xl border border-rose-400/30 text-rose-200 px-3 py-2 text-xs hover:bg-rose-400/10 shrink-0 min-h-[44px]"
              >
                Revoke
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────── In-Dashboard API Documentation & Guides Hub ─────────────────── */

function ApiDocumentationView({
  endpoint,
  form,
  apiTestLoading,
  apiTestResult,
  onRunApiTest,
  copy,
  copied,
}: {
  endpoint: string;
  form: Form;
  apiTestLoading: boolean;
  apiTestResult: { status: number; ok: boolean; data: any } | null;
  onRunApiTest: () => Promise<void>;
  copy: (text: string, label: string) => Promise<void>;
  copied: string | null;
}) {
  const [docTab, setDocTab] = useState<"submit" | "pow" | "rest" | "forwarding" | "params">("submit");
  const [codeLang, setCodeLang] = useState<"html" | "fetch" | "react" | "python" | "curl">("html");

  return (
    <div className="space-y-6 pt-2">
      {/* Interactive Sandbox & Live Tester */}
      <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-slate-950 p-6 space-y-4 shadow-xl text-left">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-300 font-bold text-sm border border-cyan-400/40">
              ⚡
            </span>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Live Interactive API Sandbox
                <span className="rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                  Ready to Test
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Trigger a real HTTP POST submission directly to your endpoint to inspect response payloads, headers, and status codes.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={apiTestLoading}
            onClick={onRunApiTest}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-5 py-2.5 text-xs font-bold transition shadow-lg shadow-cyan-500/25 disabled:opacity-50 min-h-[40px]"
          >
            {apiTestLoading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75"/></svg>
                <span>Sending Test Request...</span>
              </>
            ) : (
              <>
                <span>🚀 Send Test Submission</span>
              </>
            )}
          </button>
        </div>

        {apiTestResult && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-4 space-y-2 animate-fade-in font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="flex items-center gap-2 text-slate-300">
                <span className={`h-2.5 w-2.5 rounded-full ${apiTestResult.ok ? "bg-emerald-400" : "bg-rose-400"} animate-pulse`} />
                <span>Response Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-md ${apiTestResult.ok ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"}`}>
                  HTTP {apiTestResult.status} {apiTestResult.ok ? "Accepted" : "Error"}
                </span>
              </span>
              <span className="text-[10px] text-slate-500">Live submission saved to D1</span>
            </div>
            <pre className="text-[11px] text-cyan-300 whitespace-pre-wrap break-all overflow-x-auto p-2 bg-black/40 rounded-xl">
              {JSON.stringify(apiTestResult.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Navigation Sub-Pills for API Reference */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-black/30 border border-white/5 rounded-2xl w-fit text-xs">
        {[
          { id: "submit", label: "1. Form Submission (Public POST)", badge: "Most Used" },
          { id: "pow", label: "2. Anti-Spam Challenge (GET)", badge: "PoW" },
          { id: "rest", label: "3. Management REST API", badge: "Bearer Key" },
          { id: "forwarding", label: "4. Webhooks & GAS vs SMTP", badge: "Architecture" },
          { id: "params", label: "5. Parameter Reference", badge: "Docs" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setDocTab(tab.id as any)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition ${
              docTab === tab.id
                ? "bg-white/10 text-white border border-white/10 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
              {tab.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Form Submission API */}
      {docTab === "submit" && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 space-y-5 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold">POST</span>
              <code className="text-sm font-mono text-cyan-300 select-all break-all">{endpoint}</code>
            </div>
            <h4 className="text-base font-bold text-white pt-2">What is this endpoint &amp; When to use it?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              This is the primary public submission URL for <strong>{form.name}</strong>. Use this endpoint whenever you have a form on a website, landing page, mobile application, or backend service that needs to collect responses. It accepts submissions in <strong>JSON</strong>, <strong>HTML Form-encoded</strong>, or <strong>Multipart (Files)</strong>, verifies spam protection, stores the record securely in Cloudflare D1, and asynchronously forwards alerts.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Where to put it</span>
              <p className="text-xs font-semibold text-white">Inside your HTML &lt;form&gt; tag</p>
              <p className="text-[11px] text-slate-400">
                Set <code className="text-cyan-300">&lt;form method=&quot;POST&quot; action=&quot;{endpoint}&quot;&gt;</code>. Works natively on Webflow, WordPress, Shopify, Astro, or static HTML.
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">AJAX / React fetch</span>
              <p className="text-xs font-semibold text-white">Single-Page &amp; Headless Apps</p>
              <p className="text-[11px] text-slate-400">
                Call <code className="text-purple-300">fetch(&quot;{endpoint}&quot;, &#123; method: &quot;POST&quot;, body: ... &#125;)</code> inside React modals or contact drawers without page reloads.
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Zero Setup Required</span>
              <p className="text-xs font-semibold text-white">Dynamic Field Ingestion</p>
              <p className="text-[11px] text-slate-400">
                You do NOT need to define fields beforehand. Any key you submit (e.g. <code className="text-emerald-300">company</code>, <code className="text-emerald-300">budget</code>, <code className="text-emerald-300">rating</code>) is automatically parsed and saved!
              </p>
            </div>
          </div>

          {/* Code Snippets Accordion */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Example Implementation:</span>
              <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
                {(["html", "fetch", "react", "python", "curl"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setCodeLang(lang)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition ${codeLang === lang ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"}`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <pre className="text-xs bg-slate-950 p-4 rounded-xl text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed overflow-x-auto border border-white/5">
                {codeLang === "html" && (
                  `<!-- Plain HTML Form -->
<form method="POST" action="${endpoint}">
  <input type="text" name="name" required placeholder="Your Name" />
  <input type="email" name="email" required placeholder="Your Email" />
  <textarea name="message" required placeholder="Your Message"></textarea>
  
  <!-- Hidden bot trap -->
  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />
  
  <button type="submit">Submit</button>
</form>`
                )}

                {codeLang === "fetch" && (
                  `// Modern JavaScript (Fetch API)
const response = await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Jane Doe",
    email: "jane@example.com",
    message: "I would like to inquire about your product."
  })
});

const result = await response.json();
console.log("Submission status:", result);`
                )}

                {codeLang === "react" && (
                  `// React / Next.js Component
import { useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("idle");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    const formData = new FormData(e.target);

    const res = await fetch("${endpoint}", {
      method: "POST",
      body: formData
    });

    if (res.ok) setStatus("success");
    else setStatus("error");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <button type="submit">Send</button>
      {status === "success" && <p>Response recorded!</p>}
    </form>
  );
}`
                )}

                {codeLang === "python" && (
                  `import requests

url = "${endpoint}"
payload = {
    "name": "Alex Developer",
    "email": "alex@example.com",
    "message": "Automated pipeline submission"
}

response = requests.post(url, json=payload)
print("Status Code:", response.status_code)
print("Response:", response.json())`
                )}

                {codeLang === "curl" && (
                  `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "message": "Hello from Terminal"
  }'`
                )}
              </pre>
              <button
                type="button"
                onClick={() => {
                  const text = codeLang === "html"
                    ? `<form method="POST" action="${endpoint}">\n  <input type="text" name="name" required placeholder="Your Name" />\n  <input type="email" name="email" required placeholder="Your Email" />\n  <textarea name="message" required placeholder="Your Message"></textarea>\n  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />\n  <button type="submit">Submit</button>\n</form>`
                    : codeLang === "fetch"
                    ? `const response = await fetch("${endpoint}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({\n    name: "Jane Doe",\n    email: "jane@example.com",\n    message: "I would like to inquire about your product."\n  })\n});\nconst result = await response.json();`
                    : codeLang === "react"
                    ? `const res = await fetch("${endpoint}", {\n  method: "POST",\n  body: new FormData(e.target)\n});`
                    : codeLang === "python"
                    ? `import requests\nresponse = requests.post("${endpoint}", json={"name": "Alex", "email": "alex@example.com", "message": "Test"})\nprint(response.json())`
                    : `curl -X POST "${endpoint}" -H "Content-Type: application/json" -d '{"name": "Jane", "email": "jane@example.com"}'`;
                  copy(text, `code_${codeLang}`);
                }}
                className="absolute right-3 top-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 px-2.5 py-1 text-[11px] text-slate-300"
              >
                {copied === `code_${codeLang}` ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: ALTCHA Anti-Spam Challenge API */}
      {docTab === "pow" && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 space-y-5 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold">GET</span>
              <code className="text-sm font-mono text-cyan-300 select-all break-all">{endpoint}</code>
            </div>
            <h4 className="text-base font-bold text-white pt-2">What is the Anti-Spam Challenge API?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              When an HTTP <code>GET</code> request is sent to your endpoint, FormForge dynamically generates a cryptographic <strong>SHA-256 Proof-of-Work puzzle</strong>. The official <code className="text-cyan-300">&lt;altcha-widget&gt;</code> fetches this challenge automatically, solves it locally on the visitor&apos;s machine in ~50ms using Web Workers, and includes the solved proof in the POST payload.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-2">
              <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span>🛡️ Why FormForge Proof-of-Work beats Google reCAPTCHA</span>
              </h5>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-4">
                <li><strong>Zero tracking cookies:</strong> No privacy policy popups or GDPR consent cookies needed.</li>
                <li><strong>Zero user friction:</strong> Users don&apos;t have to click on traffic lights, buses, or crosswalks.</li>
                <li><strong>100% Self-Hosted &amp; Free:</strong> Runs directly inside your Cloudflare Worker — no Google API keys, no monthly bills.</li>
                <li><strong>Cryptographic guarantee:</strong> Spam bots cannot bypass it without burning enormous CPU cycles.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Widget Embed Snippet:</span>
              <pre className="text-[11px] font-mono text-cyan-300 bg-slate-950 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
                {`<!-- Place inside your form -->
<script type="module" src="https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js" async defer></script>
<altcha-widget challengeurl="${endpoint}"></altcha-widget>`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Management REST API */}
      {docTab === "rest" && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 space-y-5 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono font-bold">GET</span>
              <code className="text-sm font-mono text-purple-300 select-all break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}/api/forms/{form.id}/submissions
              </code>
            </div>
            <h4 className="text-base font-bold text-white pt-2">Management &amp; Read REST API</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Use this authenticated JSON API to query, filter, search, or export submissions programmatically. Perfect for custom admin panels, Python analysis pipelines, Zapier, Make, and automated backups.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Authentication &amp; Headers</h5>
            <p className="text-xs text-slate-400">
              Pass your API key in the <code className="text-cyan-300">Authorization</code> header (create keys anytime in the <strong>API Keys</strong> tab above):
            </p>
            <pre className="text-[11px] font-mono text-cyan-300 bg-slate-950 p-3 rounded-xl whitespace-pre-wrap">
              {`Authorization: Bearer ff_live_your_api_key_here`}
            </pre>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Query Parameters</h5>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
                    <th className="py-2.5 px-3">Parameter</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[11px]">
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">limit</td>
                    <td className="py-2 px-3 text-slate-400">number</td>
                    <td className="py-2 px-3 text-slate-300">Maximum submissions to return (1-200)</td>
                    <td className="py-2 px-3 text-slate-400">?limit=50</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">offset</td>
                    <td className="py-2 px-3 text-slate-400">number</td>
                    <td className="py-2 px-3 text-slate-300">Pagination skip offset</td>
                    <td className="py-2 px-3 text-slate-400">?offset=100</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">status</td>
                    <td className="py-2 px-3 text-slate-400">string</td>
                    <td className="py-2 px-3 text-slate-300">Filter by &quot;accepted&quot;, &quot;spam&quot;, or &quot;pending&quot;</td>
                    <td className="py-2 px-3 text-slate-400">?status=accepted</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-cyan-300 font-bold">q</td>
                    <td className="py-2 px-3 text-slate-400">string</td>
                    <td className="py-2 px-3 text-slate-300">Full-text search by email or payload content</td>
                    <td className="py-2 px-3 text-slate-400">?q=john</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Webhooks & GAS vs SMTP Architecture */}
      {docTab === "forwarding" && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 space-y-5 text-left">
          <div>
            <h4 className="text-base font-bold text-white">Why Google Apps Script (GAS) &amp; Webhooks Beat SMTP</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Many developers wonder why SMTP causes issues on serverless edge networks like Cloudflare Workers. Here is the technical explanation:
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2">
              <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>⚠️ The Problem with SMTP on Edge Workers</span>
              </h5>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                SMTP requires opening a direct TCP socket and performing an 8-step conversational protocol:
                <br />
                <code>connect() &rarr; EHLO &rarr; STARTTLS handshake &rarr; AUTH LOGIN &rarr; MAIL FROM &rarr; RCPT TO &rarr; DATA stream &rarr; QUIT</code>
              </p>
              <p className="text-[11px] text-slate-400">
                This keeps the Cloudflare Worker socket open for <strong>1.5 to 3.5 seconds</strong>. Under burst traffic, workers hit connection concurrency limits, freezing execution or causing HTTP 524 timeouts.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
              <h5 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span>⚡ The Advantage of Google Apps Script (GAS) &amp; Webhooks</span>
              </h5>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                FormForge dispatches GAS and webhook alerts via an asynchronous <strong>HTTPS POST</strong> in just <strong>50ms</strong> using Cloudflare&apos;s native <code>ctx.waitUntil()</code> execution context.
              </p>
              <p className="text-[11px] text-slate-400">
                The visitor gets an instant 0ms response, zero worker sockets freeze, and data is logged directly to Google Sheets or Slack without third-party services like Zapier!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Parameter Reference */}
      {docTab === "params" && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 space-y-5 text-left">
          <h4 className="text-base font-bold text-white">Form Parameters &amp; Reserved Fields</h4>
          <p className="text-xs text-slate-400">
            FormForge supports special reserved field names to control redirects, anti-spam, and notifications:
          </p>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-mono bg-white/[0.02]">
                  <th className="py-2.5 px-3">Field Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Purpose &amp; Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">_next / _redirect</td>
                  <td className="py-2 px-3 text-slate-400">string (URL)</td>
                  <td className="py-2 px-3 text-slate-300">Redirects submitter to this URL after successful submit (e.g. <code>https://mysite.com/thanks</code>). Supports template tags like <code>/thanks?name=&#123;name&#125;</code>!</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">{form.honeypotField}</td>
                  <td className="py-2 px-3 text-slate-400">hidden input</td>
                  <td className="py-2 px-3 text-slate-300">Invisible bot trap. Real users leave it blank; bots that autofill it are silently flagged as spam with zero disruption.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">email / replyTo</td>
                  <td className="py-2 px-3 text-slate-400">email string</td>
                  <td className="py-2 px-3 text-slate-300">The visitor&apos;s email address. Used to send submitter autoresponders, double opt-in confirmations, and fraud analysis.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">altcha / altcha-response</td>
                  <td className="py-2 px-3 text-slate-400">string (PoW)</td>
                  <td className="py-2 px-3 text-slate-300">Attached automatically by the &lt;altcha-widget&gt;. Contains mathematical proof that the visitor solved the computational challenge.</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">Any other key</td>
                  <td className="py-2 px-3 text-slate-400">any</td>
                  <td className="py-2 px-3 text-slate-300">Automatically saved into the submission payload JSON and rendered in the dashboard table and CSV exports.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Security Architecture Guide ─────────────────── */

function SecurityArchitectureView({
  endpoint,
  form,
}: {
  endpoint: string;
  form: Form;
}) {
  return (
    <div className="space-y-5 pt-2 text-left">
      <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-sm border border-emerald-500/40">
            🛡️
          </span>
          <div>
            <h3 className="text-base font-bold text-white">FormForge 6-Layer Security &amp; Anti-Spam Engine</h3>
            <p className="text-xs text-slate-400">Enterprise security designed for serverless edge workers, with zero third-party cookies.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Layer 1</span>
            <h5 className="text-xs font-bold text-white">Honeypot Bot Trap</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Invisible field (<code className="text-emerald-300">{form.honeypotField}</code>) hidden from real visitors. Automated scrapers fill every input and get instantly flagged with 100 spam score.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Layer 2</span>
            <h5 className="text-xs font-bold text-white">ALTCHA Proof-of-Work</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Cryptographic SHA-256 challenges solved in 50ms inside visitor browsers. Eliminates automated spam without irritating CAPTCHA images.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Layer 3</span>
            <h5 className="text-xs font-bold text-white">Token-Bucket Rate Limiter</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Enforces a strict 60 submissions / minute per IP ceiling to completely shut down Denial-of-Service (DoS) spam flooding.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">Layer 4</span>
            <h5 className="text-xs font-bold text-white">GDPR IP Pseudonymization</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Visitor IP addresses are salted per form and hashed with SHA-256 before storage. True IP addresses are never exposed or sold.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Layer 5</span>
            <h5 className="text-xs font-bold text-white">SSRF Defense Shield</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All webhooks and redirects are strictly validated to block private network IPs (10.0.0.0/8, 127.0.0.1) and AWS/GCP cloud metadata endpoints.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Layer 6</span>
            <h5 className="text-xs font-bold text-white">Disposable Email Filter</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Built-in blocklist covering 1,000+ temporary burner email providers (mailinator, 10minutemail, etc.) and live DNS MX validation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Settings Tab ─────────────────── */

function SettingsTab({ user }: { user: User }) {
  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6">
      <h2 className="text-xl font-bold text-white">Account</h2>
      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm text-slate-400">Email</p>
          <p className="font-semibold text-white">{user.email}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm text-slate-400">Name</p>
          <p className="font-semibold text-white">{user.name}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-sm text-slate-400">Role</p>
          <p className="font-semibold text-white capitalize">{user.role}</p>
        </div>
      </div>
      <h2 className="mt-8 text-xl font-bold text-white">Quick links</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a href="/docs.html" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10">📚 Full Documentation</a>
        <a href="/guide.html" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10">📖 Step-by-Step Deploy Guide</a>
        <a href="https://github.com/SudhirDevOps1/FormForge" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10">💻 GitHub Repository (Sudhir)</a>
        <a href="/api/health" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10">🏥 Health Check API</a>
        <a href="https://github.com/SudhirDevOps1" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10 col-span-1 sm:col-span-2 text-center font-bold">👤 Developer Profile: Sudhir</a>
      </div>
      <div className="mt-8 text-center text-xs text-slate-500 border-t border-white/5 pt-4">
        <p>&copy; 2026 Sudhir Singh. All Rights Reserved.</p>
        <p className="mt-1 text-[10px] text-slate-600">Self-hosted deployments must maintain original author credit and attribution links intact under the MIT License.</p>
      </div>
    </section>
  );
}
