"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
};
type ApiKey = { id: string; name: string; keyPrefix: string; scopes: string; createdAt: string };

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
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/(&lt;\/?\w+)/g, '<span class="text-sky-400">$1</span>')
      .replace(/(\s\w+=)/g, '<span class="text-purple-300">$1</span>')
      .replace(/(".*?")/g, '<span class="text-emerald-400">$1</span>');
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
  }, []);

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
      <a href="/" className="flex items-center gap-3" aria-label="FormForge Home">
        <img src="/logo.svg" alt="FormForge Logo" className="h-9 w-9 rounded-xl" />
        <span className="font-bold tracking-tight">FormForge</span>
      </a>
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
          <a href="/" className="mb-2 block rounded-xl px-4 py-3 text-sm hover:bg-white/10">Home</a>
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, password }) });
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

        <button disabled={busy} className="mt-5 w-full rounded-2xl bg-cyan-300 px-6 py-4 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">
          {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }} className="mt-3 w-full text-center text-sm text-cyan-200 hover:text-white">
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
      if (initialLoad.current && data.data.forms.length > 0) {
        setSelectedId(data.data.forms[0].id);
        initialLoad.current = false;
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
            <button key={form.id} onClick={() => setSelectedId(form.id)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${selectedId === form.id ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-3 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
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
  const [view, setView] = useState<"submissions" | "analytics" | "settings">("submissions");
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const base = getEndpointBase();
  const endpoint = `${base}/api/submit/${form.endpointId}`;

  const loadSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/submissions?limit=${limit}&offset=${offset}`, { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setSubs(data.data.submissions);
        setTotal(data.data.pagination.total ?? data.data.submissions.length);
      }
    } finally {
      setLoading(false);
    }
  }, [form.id, offset]);

  useEffect(() => {
    setOffset(0);
  }, [form.id]);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const [snippetTab, setSnippetTab] = useState<"html" | "js" | "react" | "python">("html");

  const htmlSnippet = `<form method="POST" action="${endpoint}">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <input name="${form.honeypotField}" tabindex="-1" autocomplete="off" style="display:none" />
  <button type="submit">Send</button>
</form>`;

  const jsSnippet = `fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hello@example.com", message: "Hi!" })
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
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" required />
      <textarea name="message" required></textarea>
      <button type="submit">Send</button>
      {status === "success" && <p>Sent!</p>}
    </form>
  );
}`;

  const pythonSnippet = `import requests

url = "${endpoint}"
data = {
    "email": "user@example.com",
    "message": "Hello from Python!"
}

response = requests.post(url, json=data)
print(response.json())`;

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
    <section className="glass-panel space-y-5 overflow-hidden rounded-3xl">
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
          <a href={`/api/forms/${form.id}/export`} className="rounded-xl border border-white/15 px-4 py-3 text-xs hover:bg-white/10">⬇ CSV</a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        <StatCard label="Total" value={String(form.submissionsCount)} />
        <StatCard label="Accepted" value={String(accepted)} />
        <StatCard label="Spam blocked" value={String(spam)} />
        <StatCard label="Accept rate" value={subs.length > 0 ? `${Math.round((accepted / subs.length) * 100)}%` : "—"} />
      </div>

      {/* Endpoint & Snippets */}
      <div className="px-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Submission endpoint</p>
        <div className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2">
          <code className="flex-1 break-all text-sm text-cyan-200">{endpoint}</code>
          <button onClick={() => copy(endpoint, "url")} className="shrink-0 text-xs text-cyan-300 hover:text-white min-h-[44px] min-w-[44px]">{copied === "url" ? "✓" : "Copy"}</button>
        </div>
        
        {/* Code Snippet Tabs */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-1.5 border-b border-white/5 pb-2">
            {(["html", "js", "react", "python"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSnippetTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase transition ${snippetTab === tab ? "bg-white/10 text-white border border-white/10" : "text-slate-400 hover:text-slate-200"}`}
              >
                {tab === "js" ? "JS Fetch" : tab}
              </button>
            ))}
          </div>
          <div className="relative">
            {snippetTab === "html" && <CodeHighlight code={htmlSnippet} lang="html" />}
            {snippetTab === "js" && <CodeHighlight code={jsSnippet} lang="js" />}
            {snippetTab === "react" && <CodeHighlight code={reactSnippet} lang="js" />}
            {snippetTab === "python" && <CodeHighlight code={pythonSnippet} lang="python" />}
            <button
              onClick={() => {
                const text = snippetTab === "html" ? htmlSnippet : snippetTab === "js" ? jsSnippet : snippetTab === "react" ? reactSnippet : pythonSnippet;
                copy(text, "copy");
              }}
              className="absolute right-3 top-3 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              {copied === "copy" ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Form navigation" className="flex gap-2 border-b border-white/10 px-5">
        <button
          role="tab"
          aria-selected={view === "submissions"}
          aria-controls="view-submissions-panel"
          onClick={() => setView("submissions")}
          className={`border-b-2 px-3 pb-3 text-sm font-semibold ${view === "submissions" ? "border-cyan-300 text-white" : "border-transparent text-slate-400 hover:text-white"}`}
        >
          Submissions ({total})
        </button>
        <button
          role="tab"
          aria-selected={view === "analytics"}
          aria-controls="view-analytics-panel"
          onClick={() => setView("analytics")}
          className={`border-b-2 px-3 pb-3 text-sm font-semibold ${view === "analytics" ? "border-cyan-300 text-white" : "border-transparent text-slate-400 hover:text-white"}`}
        >
          Analytics
        </button>
        <button
          role="tab"
          aria-selected={view === "settings"}
          aria-controls="view-settings-panel"
          onClick={() => setView("settings")}
          className={`border-b-2 px-3 pb-3 text-sm font-semibold ${view === "settings" ? "border-cyan-300 text-white" : "border-transparent text-slate-400 hover:text-white"}`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        {view === "submissions" && (
          <div id="view-submissions-panel" role="tabpanel" aria-label="Submissions List">
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading submissions…</p>
            ) : subs.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <p className="text-4xl">📭</p>
                <p className="mt-2 text-sm">No submissions yet. Use the endpoint above to send a test.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {subs.map((sub) => <SubmissionRow key={sub.id} sub={sub} />)}
                
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
    </div>
  );
}

function SubmissionRow({ sub }: { sub: Submission }) {
  const [open, setOpen] = useState(false);
  
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(sub.payload) as Record<string, unknown>;
  } catch {
    payload = { raw: sub.payload };
  }
  
  const preview = Object.entries(payload).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(" · ");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.05]">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`h-2 w-2 shrink-0 rounded-full ${sub.status === "spam" ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden="true" />
        <span className="sr-only">Status: {sub.status}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-300">{preview || "(empty)"}</p>
          <p className="text-xs text-slate-500">{timeAgo(sub.createdAt)}{sub.email ? ` · ${sub.email}` : ""}{sub.spamScore > 0 ? ` · spam:${sub.spamScore}` : ""}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${sub.status === "spam" ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-200"}`}>{sub.status}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="border-t border-white/10 px-4 py-3">
          <pre className="overflow-x-auto text-xs leading-6 text-slate-300"><code>{JSON.stringify(payload, null, 2)}</code></pre>
          {sub.referer && <p className="mt-2 text-xs text-slate-500">Referer: {sub.referer}</p>}
          <p className="mt-1 text-xs text-slate-500">ID: {sub.id}</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Form Settings ─────────────────── */

function FormSettingsPanel({ form, onSaved }: { form: Form; onSaved: () => void }) {
  const [name, setName] = useState(form.name);
  const [allowedOrigins, setAllowedOrigins] = useState(form.allowedOrigins);
  const [honeypot, setHoneypot] = useState(form.honeypotField);
  const [successMsg, setSuccessMsg] = useState(form.successMessage);
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl ?? "");
  const [webhookUrl, setWebhookUrl] = useState(form.webhookUrl ?? "");
  const [emailTo, setEmailTo] = useState(form.emailTo ?? "");
  const [notifyEmail, setNotifyEmail] = useState(form.notifyEmail);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setName(form.name);
    setAllowedOrigins(form.allowedOrigins);
    setHoneypot(form.honeypotField);
    setSuccessMsg(form.successMessage);
    setRedirectUrl(form.redirectUrl ?? "");
    setWebhookUrl(form.webhookUrl ?? "");
    setEmailTo(form.emailTo ?? "");
    setNotifyEmail(form.notifyEmail);
  }, [form]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, allowedOrigins, honeypotField: honeypot, successMessage: successMsg, redirectUrl: redirectUrl || null, webhookUrl: webhookUrl || null, emailTo: emailTo || null, notifyEmail }),
      });
      const data = await res.json();
      if (data.ok) { setMsg("Saved ✓"); onSaved(); } else { setMsg(data.message ?? "Error"); }
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="settings-name" className="mb-1 block text-sm text-slate-400">Form name</label>
        <input id="settings-name" required value={name} onChange={(e) => setName(e.target.value)} className="ff-input text-sm" />
      </div>
      <div>
        <label htmlFor="settings-origins" className="mb-1 block text-sm text-slate-400">Allowed origins (* = any, or https://mysite.com)</label>
        <input id="settings-origins" value={allowedOrigins} onChange={(e) => setAllowedOrigins(e.target.value)} className="ff-input text-sm" />
      </div>
      <div>
        <label htmlFor="settings-honeypot" className="mb-1 block text-sm text-slate-400">Honeypot field name (hidden trap for bots)</label>
        <input id="settings-honeypot" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="ff-input text-sm" />
      </div>
      <div>
        <label htmlFor="settings-success" className="mb-1 block text-sm text-slate-400">Success message (shown after submission)</label>
        <input id="settings-success" value={successMsg} onChange={(e) => setSuccessMsg(e.target.value)} className="ff-input text-sm" />
      </div>
      <div>
        <label htmlFor="settings-redirect" className="mb-1 block text-sm text-slate-400">Redirect URL after submit (optional)</label>
        <input id="settings-redirect" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className="ff-input text-sm" placeholder="https://mysite.com/thanks" />
      </div>
      <div>
        <label htmlFor="settings-webhook" className="mb-1 block text-sm text-slate-400">Webhook URL (optional — receives JSON POST)</label>
        <input id="settings-webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="ff-input text-sm" placeholder="https://hooks.example.com/form" />
      </div>
      <div>
        <label htmlFor="settings-email" className="mb-1 block text-sm text-slate-400">Email notification address (optional)</label>
        <input id="settings-email" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="ff-input text-sm" placeholder="notify@example.com" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={notifyEmail} onChange={() => setNotifyEmail(!notifyEmail)} className="h-4 w-4 rounded" />
        Enable email notifications (requires RESEND_API_KEY)
      </label>
      {msg && <p className={`text-sm ${msg.includes("✓") ? "text-emerald-300" : "text-rose-300"}`}>{msg}</p>}
      <button disabled={busy} className="rounded-2xl bg-cyan-300 px-6 py-4 font-bold text-slate-950 disabled:opacity-60 min-h-[44px]">{busy ? "Saving…" : "Save settings"}</button>
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
  const [created, setCreated] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/api-keys", { credentials: "include" });
    const data = await res.json();
    if (data.ok) setKeys(data.data.apiKeys);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/api-keys", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (data.ok) { setCreated(data.data.apiKey); setName(""); await load(); }
    } finally { setBusy(false); }
  }

  async function revokeKey(id: string) {
    const confirmation = window.confirm("Are you sure you want to revoke this API key? Applications using this key will immediately fail.");
    if (!confirmation) return;
    await fetch(`/api/api-keys?id=${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6">
      <h2 className="text-xl font-bold text-white">API Keys</h2>
      <p className="mt-1 text-sm text-slate-400">Use API keys to read forms and submissions programmatically.</p>
      <form onSubmit={create} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="create-key-name" className="sr-only">Key name</label>
          <input id="create-key-name" required placeholder="Key name" value={name} onChange={(e) => setName(e.target.value)} className="ff-input text-sm" />
        </div>
        <button disabled={busy} className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60 min-h-[44px]">{busy ? "Creating…" : "Create key"}</button>
      </form>
      {created && (
        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
          <p className="text-sm font-semibold text-amber-200">⚠️ Copy this key now — it will NOT be shown again:</p>
          <code className="mt-2 block break-all rounded-xl bg-black/40 px-3 py-2 text-sm text-amber-100">{created}</code>
        </div>
      )}
      <div className="mt-6 space-y-2">
        {keys.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No API keys yet.</p>}
        {keys.map((key) => (
          <div key={key.id} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white truncate">{key.name}</p>
                <span className="text-[10px] text-slate-500">{timeAgo(key.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-400"><code>{key.keyPrefix}…</code> · {key.scopes}</p>
            </div>
            <button
              onClick={() => revokeKey(key.id)}
              className="rounded-xl border border-rose-400/30 text-rose-200 px-3 py-2 text-xs hover:bg-rose-400/10 shrink-0 min-h-[44px]"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </section>
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
        <a href="/guide.html" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10">📖 Hinglish Deploy Guide</a>
        <a href="https://github.com/adrianak2026/FormForge" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10">💻 GitHub Repository</a>
        <a href="/api/health" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-cyan-200 hover:bg-white/10">🏥 Health Check API</a>
      </div>
    </section>
  );
}
