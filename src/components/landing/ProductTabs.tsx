"use client";

import { useEffect, useRef, useState } from "react";

interface Tab {
  id: string;
  label: string;
  heading: string;
  body: string;
  code: string;
  lang: string;
}

const TABS: Tab[] = [
  {
    id: "embed",
    label: "Any HTML form",
    heading: "Point any <form> at your endpoint.",
    body: "No SDK, no bundler, no framework lock-in. Works on Astro, Hugo, Eleventy, Jekyll, plain HTML, WordPress, Shopify and anything else that can POST.",
    lang: "html",
    code: `<form method="POST" action="https://your-worker.workers.dev/api/submit/endpoint_xxx">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <input name="website" tabindex="-1" autocomplete="off" hidden />
  <button>Send</button>
</form>`,
  },
  {
    id: "fetch",
    label: "fetch() / JSON",
    heading: "Send JSON and get a structured result.",
    body: "The same endpoint accepts application/json and application/x-www-form-urlencoded. You get back a submission id, the resolved status, and the form's success message.",
    lang: "javascript",
    code: `const res = await fetch("https://your-worker.workers.dev/api/submit/endpoint_xxx", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hi@example.com", message: "Hello" }),
});

const { ok, submissionId, status } = await res.json();`,
  },
  {
    id: "webhook",
    label: "Webhooks",
    heading: "Every submission, signed and verified.",
    body: "Each delivery carries an HMAC-SHA256 signature over the timestamp and body, a delivery id, and the event name. Verify it in three lines with the receiver snippets in your dashboard.",
    lang: "javascript",
    code: `// X-FormForge-Signature: t=1730000000,v1=<hmac>

const expected = hmacSHA256(
  \`\${timestamp}.\${rawBody}\`,
  process.env.WEBHOOK_SECRET
);

if (!timingSafeEqual(expected, signature)) {
  return new Response("bad signature", { status: 401 });
}`,
  },
  {
    id: "react",
    label: "React / Next.js",
    heading: "Or render the hosted page in your app.",
    body: "The hosted conversational form is available at /f/your-slug. Embed it with an iframe, or fetch its definition and render it with your own components.",
    lang: "tsx",
    code: `export default function Page() {
  return (
    <iframe
      src="https://your-worker.workers.dev/f/contact"
      className="h-[720px] w-full rounded-2xl border-0"
      title="Contact form"
    />
  );
}`,
  },
];

export function ProductTabs() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tab = TABS[active];

  useEffect(() => {
    setCopied(false);
  }, [active]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(tab.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — the code is still selectable */
    }
  }

  return (
    <section id="workflow" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
      <Revealish>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-aurora-400">
            Integrations
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Four ways in. One endpoint.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            The same private endpoint works for a static contact page, a React app, a
            webhook pipeline, or an embedded hosted form.
          </p>
        </div>
      </Revealish>

      <div className="mt-12 flex flex-wrap justify-center gap-2">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(index)}
            aria-selected={active === index}
            role="tab"
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
              active === index
                ? "border-aurora-400/40 bg-aurora-400/10 text-aurora-100 shadow-[0_0_28px_-12px_rgba(34,211,238,0.8)]"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        ref={panelRef}
        role="tabpanel"
        className="mt-8 grid gap-6 lg:grid-cols-[.85fr_1.15fr] lg:items-center"
      >
        <div className="surface-card p-7">
          <h3 className="text-2xl font-bold text-white">{tab.heading}</h3>
          <p className="mt-3 leading-7 text-slate-400">{tab.body}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip">Zero SDK</span>
            <span className="chip">CORS allowlist</span>
            <span className="chip">Spam scoring</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#04060d] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-mint-400/70" />
              <span className="ml-2 font-mono text-xs text-slate-500">{tab.id}</span>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-white/25 hover:text-white"
            >
              {copied ? "copied ✓" : "copy"}
            </button>
          </div>
          <pre
            key={tab.id}
            className="animate-fade-in overflow-x-auto p-5 font-mono text-[13px] leading-7 text-aurora-100"
          >
            <code>{tab.code}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

/** Local reveal wrapper so this file stays a single client island. */
function Revealish({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="animate-fade-in"
      style={{ animationDuration: "520ms", animationTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
    >
      {children}
    </div>
  );
}
