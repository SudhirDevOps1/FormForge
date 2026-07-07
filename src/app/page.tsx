const features = [
  "HTML form + JSON submissions",
  "Unlimited forms on your own D1 database",
  "CSV export and submission dashboard APIs",
  "Honeypot, origin allowlist, optional proof-of-work",
  "Webhook and optional email notifications",
  "No DATABASE_URL, no localhost build failure",
  "OpenNext-ready Cloudflare Workers deployment",
  "Privacy-first: hashed IPs, no third-party analytics",
];

const advanced = [
  { title: "D1 native", text: "Drizzle uses the Cloudflare D1 binding at request time only, so builds never initialize a database." },
  { title: "Own every record", text: "Forms, submissions, sessions, API keys, audit logs, and notifications stay in the deployer's Cloudflare account." },
  { title: "Static-site friendly", text: "Drop the endpoint into Netlify, GitHub Pages, Astro, Hugo, Next export, or any plain HTML page." },
  { title: "Export anytime", text: "CSV exports are built in because privacy-first also means zero vendor lock-in." },
  { title: "Optional integrations", text: "Webhook and Resend-compatible email are off by default and work only when the owner configures secrets." },
  { title: "2026 deploy flow", text: "Wrangler, OpenNext, D1 migrations, nodejs_compat, assets binding, and docs are already wired." },
];

const envRows = [
  ["AUTH_SECRET", "Required for auth/session HMAC. Generate with openssl rand -hex 32 or jwtsecrets.com."],
  ["RESEND_API_KEY", "Optional. Leave blank to disable email notifications."],
  ["RESEND_FROM", "Optional sender like FormForge <forms@example.com>. Required only when RESEND_API_KEY is used."],
  ["DB", "Cloudflare D1 binding name. Do not add this as a secret; configure it in wrangler.jsonc / Cloudflare bindings."],
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="grid-mask pointer-events-none absolute inset-x-0 top-0 h-[38rem] opacity-80" />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="FormForge home">
          <img src="/logo.svg" alt="" className="h-11 w-11 rounded-2xl shadow-lg shadow-blue-950/40" />
          <span className="text-lg font-bold tracking-tight">FormForge</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a className="hover:text-white" href="#features">Features</a>
          <a className="hover:text-white" href="#deploy">Deploy</a>
          <a className="hover:text-white" href="/docs.html">Docs</a>
          <a className="hover:text-white" href="/guide.html">Guide</a>
          <a className="hover:text-white" href="/dashboard">Dashboard</a>
          <a className="rounded-full border border-cyan-300/30 px-4 py-2 text-cyan-100 hover:bg-cyan-300/10" href="https://github.com/SudhirDevOps1/FormForge">GitHub ↗</a>
        </nav>
        {/* Mobile menu */}
        <details className="group relative md:hidden">
          <summary className="list-none rounded-xl border border-white/15 p-2 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </summary>
          <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/15 bg-slate-900/95 p-3 backdrop-blur-lg">
            <a className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10" href="#features">Features</a>
            <a className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10" href="#deploy">Deploy</a>
            <a className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10" href="/docs.html">Docs</a>
            <a className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10" href="/guide.html">Guide</a>
            <a className="block rounded-xl px-4 py-3 text-sm hover:bg-white/10" href="/dashboard">Dashboard</a>
            <a className="block rounded-xl px-4 py-3 text-sm text-cyan-200 hover:bg-white/10" href="https://github.com/SudhirDevOps1/FormForge">GitHub ↗</a>
          </div>
        </details>
      </header>

      <section id="top" className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:pt-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            <span>🔓 Forever free</span>
            <span className="h-1 w-1 rounded-full bg-cyan-200" />
            <span>📀 Own your D1 data</span>
            <span className="h-1 w-1 rounded-full bg-cyan-200" />
            <span>⚡ Deploy fast</span>
          </div>

          <h1 className="mt-8 max-w-4xl text-balance text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
            Open-source form backend forged for Cloudflare Workers + D1.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            FormForge is a FormZero-inspired, privacy-first backend for contact forms, waitlists, surveys, lead capture, and newsletter signups. No PostgreSQL localhost URL, no paid database, no SaaS lock-in.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge" className="inline-flex items-center justify-center rounded-2xl bg-cyan-300 px-6 py-4 font-bold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:bg-cyan-200">
              Deploy to Cloudflare
            </a>
            <a href="/docs.html" className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10">
              Read full docs
            </a>
            <a href="/dashboard" className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/30 px-6 py-4 font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-300/10">
              Open dashboard
            </a>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {["D1", "Drizzle", "OpenNext", "Tailwind"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-slate-200">{item}</div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-4 sm:p-6">
          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-sm text-slate-400">Dashboard preview</p>
                <h2 className="text-2xl font-bold text-white">Submissions</h2>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm text-emerald-200">D1 bound</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["2,418 total", "99.2% accepted", "0 paid limits"].map((metric) => (
                <div key={metric} className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">
                  <strong className="block text-xl text-white">{metric.split(" ")[0]}</strong>
                  {metric.split(" ").slice(1).join(" ")}
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Contact form", "accepted", "New project inquiry"],
                ["Waitlist", "accepted", "Beta signup from static site"],
                ["Survey", "spam", "Honeypot filled"],
              ].map(([form, status, text]) => (
                <div key={`${form}-${text}`} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <p className="font-semibold text-white">{form}</p>
                    <p className="text-sm text-slate-400">{text}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${status === "spam" ? "bg-amber-300/15 text-amber-200" : "bg-emerald-300/15 text-emerald-200"}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Why FormForge?</p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">Everything a static-site form backend needs.</h2>
            <p className="mt-5 text-slate-300">Designed for open-source maintainers, indie hackers, agencies, and teams that want production-grade form handling without paying per submission.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-slate-200">✓ {feature}</div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {advanced.map((item) => (
            <article key={item.title} className="glass-panel rounded-3xl p-6">
              <h3 className="text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="deploy" className="relative mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <div className="glass-panel overflow-hidden rounded-[2rem] p-6 sm:p-10">
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">One-click deploy</p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">Deploys into the user&apos;s Cloudflare account, not yours.</h2>
              <p className="mt-5 leading-8 text-slate-300">
                The deploy button asks the deployer to log in to their own Cloudflare and GitHub/GitLab account. They choose their Worker name, create or connect a D1 database, set their own secrets, and own the generated project.
              </p>
              <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge" className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-bold text-slate-950 hover:bg-cyan-100">Deploy your own FormForge</a>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
              <ol className="space-y-4 text-slate-300">
                <li><strong className="text-white">1.</strong> Click Deploy to Cloudflare → it asks <em>you</em> to log in to <em>your</em> Cloudflare account.</li>
                <li><strong className="text-white">2.</strong> Choose a project name (e.g. <code className="rounded bg-white/10 px-2 py-1">formforge</code>).</li>
                <li><strong className="text-white">3.</strong> Cloudflare auto-creates the D1 database <code className="rounded bg-white/10 px-2 py-1">formforge-db</code> for you.</li>
                <li><strong className="text-white">4.</strong> Set <code className="rounded bg-white/10 px-2 py-1">AUTH_SECRET</code> (generate: <code className="rounded bg-white/10 px-2 py-1">openssl rand -hex 32</code>). Leave Resend vars blank.</li>
                <li><strong className="text-white">5.</strong> Deploy. On first request, FormForge auto-creates its tables. Open <code className="rounded bg-white/10 px-2 py-1">/dashboard</code> to register.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-2xl font-black text-white">Environment variables</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              {envRows.map(([name, help]) => (
                <div key={name} className="grid gap-2 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[12rem_1fr]">
                  <code className="font-bold text-cyan-200">{name}</code>
                  <p className="text-sm leading-6 text-slate-300">{help}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-2xl font-black text-white">Use in HTML</h2>
            <pre className="mt-5 overflow-x-auto rounded-2xl bg-black/50 p-5 text-sm leading-7 text-cyan-100"><code>{`<form method="POST" action="https://your-worker.workers.dev/api/submit/endpoint_xxx">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <input name="website" tabindex="-1" autocomplete="off" hidden />
  <button>Send</button>
</form>`}</code></pre>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/10 px-5 py-10 text-center text-sm text-slate-400 sm:px-8">
        <p>FormForge is open-source, self-hosted, and designed for Cloudflare&apos;s free tier. Read <a className="text-cyan-200 hover:text-white" href="/docs.html">docs.html</a> for complete setup.</p>
      </footer>
    </main>
  );
}
