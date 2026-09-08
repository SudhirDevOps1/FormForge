"use client";

import { useEffect, useState, use } from "react";
import { TurnstileAltcha } from "@/components/TurnstileAltcha";

interface FormPublicData {
  id: string;
  name: string;
  slug: string;
  endpointId: string;
  description: string | null;
  successMessage: string;
  redirectUrl: string | null;
  altchaEnabled: boolean;
  maxAttachmentSizeMb: number;
  allowedFileExtensions: string;
  isClosed: boolean;
}

export default function HostedFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormPublicData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form input states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [altchaPayload, setAltchaPayload] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function loadForm() {
      try {
        const res = await fetch(`/api/f/${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (json.ok && json.data) {
          setForm(json.data);
        } else {
          setError(json.message || "Form not found or inactive.");
        }
      } catch (err: any) {
        setError("Failed to load form details. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    loadForm();
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      if (subject) formData.append("subject", subject);
      formData.append("message", message);
      if (honeypot) formData.append("website", honeypot);
      if (file) formData.append("attachment", file);
      if (altchaPayload) formData.append("altcha", altchaPayload);

      const res = await fetch(`/api/submit/${form.endpointId}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok !== false) {
        setSubmitted(true);
        if (form.redirectUrl) {
          setTimeout(() => {
            window.location.href = form.redirectUrl!;
          }, 1500);
        }
      } else {
        setSubmitError(data?.message || "Submission failed. Please try again.");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-cyan-400 font-mono text-sm">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading form…</span>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-2xl text-rose-400">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Form Unavailable</h1>
          <p className="text-sm text-slate-400">{error || "This form is currently not accepting responses."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200 flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-cyan-500 selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[300px] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-xl my-auto">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl">
          {/* Header */}
          <div className="border-b border-white/10 pb-6 mb-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Verified FormForge Form
              </span>
              {form.isClosed && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
                  Closed
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{form.name}</h1>
            {form.description && (
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{form.description}</p>
            )}
          </div>

          {form.isClosed ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center space-y-2">
              <span className="text-3xl">🛑</span>
              <h3 className="text-base font-bold text-white">Submissions Closed</h3>
              <p className="text-xs text-slate-400">
                This form has reached its designated response quota and is no longer accepting new submissions.
              </p>
            </div>
          ) : submitted ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center space-y-3 animate-fade-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-2xl text-emerald-400">
                ✓
              </div>
              <h3 className="text-xl font-bold text-white">Submission Received!</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{form.successMessage}</p>
              {form.redirectUrl && (
                <p className="text-xs text-cyan-400 animate-pulse">Redirecting you now…</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Invisible Honeypot */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              {/* Name & Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="hf-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Your Name <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    id="hf-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Smith"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                  />
                </div>
                <div>
                  <label htmlFor="hf-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    id="hf-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="hf-subject" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subject (Optional)
                </label>
                <input
                  id="hf-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Inquiry or project details"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="hf-message" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Message <span className="text-cyan-400">*</span>
                </label>
                <textarea
                  id="hf-message"
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message here…"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition leading-relaxed resize-y"
                />
              </div>

              {/* File Attachment Dropzone */}
              <div>
                <label htmlFor="hf-file" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Attachment (Optional)
                </label>
                <div className="relative rounded-2xl border border-dashed border-white/15 bg-black/30 p-4 text-center hover:border-cyan-400/50 hover:bg-cyan-500/5 transition group">
                  <input
                    id="hf-file"
                    type="file"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {file ? (
                    <div className="flex items-center justify-between text-xs text-slate-200">
                      <span className="truncate max-w-[240px] font-mono text-cyan-300 font-semibold">{file.name}</span>
                      <span className="text-slate-400 text-[11px]">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-lg">📁</div>
                      <div className="text-xs font-medium text-slate-300">
                        Click or drag a file here to attach
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Max size: {form.maxAttachmentSizeMb || 10}MB
                        {form.allowedFileExtensions ? ` • Allowed: ${form.allowedFileExtensions}` : ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ALTCHA Proof of Work */}
              {form.altchaEnabled && (
                <div className="pt-2">
                  <TurnstileAltcha
                    challengeUrl="/api/altcha/challenge"
                    onVerified={(token: string) => setAltchaPayload(token)}
                  />
                </div>
              )}

              {/* Submit Error */}
              {submitError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-medium">
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 py-3.5 px-6 font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-sky-400 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Sending Response…</span>
                  </>
                ) : (
                  <span>Submit Response →</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-3">
          <span>Powered by <strong>FormForge</strong></span>
          <span>•</span>
          <span>Privacy-First &amp; Encrypted</span>
        </div>
      </main>
    </div>
  );
}
