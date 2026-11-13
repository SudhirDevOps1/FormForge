"use client";

import { useState } from "react";
import type { Form } from "@/db/schema";

export function EmbedWizardModal({
  form,
  endpoint,
  isOpen,
  onClose,
}: {
  form: { id: string; name: string; slug?: string; honeypotField?: string | null; successMessage?: string | null; [key: string]: any };
  endpoint: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"html" | "react" | "widget" | "iframe">("html");
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2500);
  };

  const htmlCode = `<!-- FormForge Zero-Dependency HTML Form -->
<form action="${endpoint}" method="POST" id="formforge-${form.slug}">
  <div>
    <label for="name">Your Name</label>
    <input type="text" name="name" id="name" required placeholder="Jane Doe" />
  </div>

  <div>
    <label for="email">Email Address</label>
    <input type="email" name="email" id="email" required placeholder="jane@example.com" />
  </div>

  <div>
    <label for="message">Message</label>
    <textarea name="message" id="message" required placeholder="How can we help?"></textarea>
  </div>

  <!-- Optional Anti-Spam Honeypot Trap -->
  <input type="text" name="${form.honeypotField || "website"}" style="display:none !important;" tabindex="-1" autocomplete="off" />

  <button type="submit">Send Message</button>
</form>

<script>
  document.getElementById("formforge-${form.slug}").addEventListener("submit", async function(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector("button[type=submit]");
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
      const response = await fetch("${endpoint}", {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: new FormData(form)
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message || "${form.successMessage || "Thanks! Your response has been received."}");
        form.reset();
      } else {
        alert("Error: " + (data.message || "Failed to submit form"));
      }
    } catch (err) {
      alert("Submission error. Please try again.");
    } finally {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  });
</script>`;

  const reactCode = `import { useState } from 'react';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch('${endpoint}', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Thanks! Response received.');
        (e.target as HTMLFormElement).reset();
      } else {
        setStatus('error');
        setMessage(data.message || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto p-6 bg-slate-900 rounded-2xl text-white">
      <div>
        <label className="block text-xs font-semibold mb-1">Name</label>
        <input name="name" type="text" required className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700" />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">Email</label>
        <input name="email" type="email" required className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700" />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">Message</label>
        <textarea name="message" required className="w-full px-3 py-2 bg-slate-800 rounded-lg border border-slate-700" rows={4} />
      </div>

      <button type="submit" disabled={status === 'loading'} className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 font-bold rounded-lg transition disabled:opacity-50">
        {status === 'loading' ? 'Sending...' : 'Send Message'}
      </button>

      {status === 'success' && <p className="text-emerald-400 text-xs mt-2">{message}</p>}
      {status === 'error' && <p className="text-rose-400 text-xs mt-2">{message}</p>}
    </form>
  );
}`;

  const widgetCode = `<!-- FormForge 1-Line Floating Bubble Widget -->
<script 
  src="${typeof window !== "undefined" ? window.location.origin : ""}/widget.js" 
  data-form-id="${form.id}"
  data-color="cyan"
  data-position="bottom-right"
  defer>
</script>`;

  const iframeCode = `<!-- FormForge Auto-Responsive Hosted Iframe -->
<iframe
  src="${typeof window !== "undefined" ? window.location.origin : ""}/f/${form.slug}"
  width="100%"
  height="600"
  style="border:none;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.2);"
  title="${form.name}">
</iframe>`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 font-bold text-lg">
              ⚡
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Embed &amp; Integration Wizard</h3>
              <p className="text-xs text-slate-400">Embed <span className="text-cyan-300 font-medium">{form.name}</span> into any website, React app, or blog with zero dependencies.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          {[
            { id: "html", label: "Pure HTML & AJAX", icon: "🌐" },
            { id: "react", label: "React / Next.js", icon: "⚛️" },
            { id: "widget", label: "1-Line Floating Widget", icon: "🎈" },
            { id: "iframe", label: "Responsive Iframe", icon: "🖼️" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                tab === item.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-hidden flex flex-col space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {tab === "html" && "Self-contained HTML form with async fetch and honeypot spam trap."}
              {tab === "react" && "Production-ready TypeScript React component with loading & error states."}
              {tab === "widget" && "Under 3KB standalone script that injects a glassmorphic floating modal."}
              {tab === "iframe" && "Clean embedded iframe pointing to your secure hosted endpoint."}
            </span>
            <button
              type="button"
              onClick={() => {
                const code = tab === "html" ? htmlCode : tab === "react" ? reactCode : tab === "widget" ? widgetCode : iframeCode;
                handleCopy(code, tab);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
            >
              {copied === tab ? "✓ Copied!" : "📋 Copy Code"}
            </button>
          </div>

          <pre className="flex-1 overflow-auto rounded-2xl border border-white/10 bg-black/60 p-4 font-mono text-[11px] text-cyan-200">
            <code>
              {tab === "html" && htmlCode}
              {tab === "react" && reactCode}
              {tab === "widget" && widgetCode}
              {tab === "iframe" && iframeCode}
            </code>
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
          <span>Endpoint: <code className="text-cyan-300 font-mono">{endpoint}</code></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
