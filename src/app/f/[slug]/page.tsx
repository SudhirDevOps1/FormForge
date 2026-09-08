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
  otpEnabled?: boolean;
  maxAttachmentSizeMb: number;
  allowedFileExtensions: string;
  displayMode?: string;
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

  // OTP Verification states
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    if (otpVerified || otpSent || otpCode) {
      setOtpVerified(false);
      setOtpSent(false);
      setOtpCode("");
      setOtpSuccess(null);
      setOtpError(null);
    }
  };

  async function handleSendOtp() {
    if (!form || !email.includes("@")) {
      setOtpError("Please enter a valid email address first.");
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const res = await fetch(`/api/submit/${form.endpointId}/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.ok) {
        setOtpSent(true);
        setOtpSuccess("6-digit verification code sent to " + email.trim() + "!");
      } else {
        setOtpError(data.error || data.message || "Failed to send verification code. Please try again.");
      }
    } catch {
      setOtpError("Network error sending OTP code. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    if (!form || !email.includes("@") || otpCode.trim().length !== 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }
    setOtpVerifying(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const res = await fetch(`/api/submit/${form.endpointId}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.verified) {
        setOtpVerified(true);
        setOtpSuccess("Email verified successfully! ✓");
      } else {
        setOtpError(data.error || data.message || "Invalid or expired OTP code.");
      }
    } catch {
      setOtpError("Network error verifying OTP code.");
    } finally {
      setOtpVerifying(false);
    }
  }

  // Conversational multi-step state
  const [step, setStep] = useState(0);

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

    if (form.otpEnabled && !otpVerified) {
      setSubmitError("Email verification is required. Please verify your email with the 6-digit code before submitting.");
      return;
    }

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
      if (otpCode) formData.append("otpCode", otpCode);

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
        setSubmitError(data?.message || data?.error || "Submission failed. Please try again.");
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
          ) : form.displayMode === "conversational" ? (
            /* Conversational Step-by-Step Mode */
            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Progress Bar & Step Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-cyan-400 font-semibold tracking-wider uppercase text-[10px]">
                    Step {step + 1} of 5
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {Math.round(((step + 1) / 5) * 100)}% Complete
                  </span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-sky-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${((step + 1) / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Step 0: Name */}
              {step === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label htmlFor="conv-name" className="block text-lg sm:text-xl font-bold text-white mb-1">
                      What is your name? <span className="text-cyan-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400">Please enter your full or preferred name.</p>
                  </div>
                  <input
                    id="conv-name"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && name.trim()) {
                        e.preventDefault();
                        setStep(1);
                      }
                    }}
                    placeholder="e.g. Alex Morgan"
                    className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3.5 text-base text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
                  />
                </div>
              )}

              {/* Step 1: Email */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label htmlFor="conv-email" className="block text-lg sm:text-xl font-bold text-white mb-1">
                      What is your email address? <span className="text-cyan-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400">
                      {form.otpEnabled
                        ? "Enter your email address and verify with the 6-digit OTP code."
                        : "We will use this address to respond to you."}
                    </p>
                  </div>
                  <input
                    id="conv-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && email.includes("@") && (!form.otpEnabled || otpVerified)) {
                        e.preventDefault();
                        setStep(2);
                      }
                    }}
                    placeholder="alex@example.com"
                    className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3.5 text-base text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
                  />

                  {/* If OTP is enabled on this form */}
                  {form.otpEnabled && (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                          <span>🔒</span> 6-Digit Email Verification Required
                        </span>
                        {otpVerified && (
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                            ✓ Verified
                          </span>
                        )}
                      </div>

                      {otpVerified ? (
                        <p className="text-xs text-emerald-400 font-medium">
                          ✓ Email successfully verified! You can proceed to the next step.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-400">
                            We will send a 6-digit one-time passcode to <strong className="text-white">{email || "your email"}</strong>.
                          </p>
                          <div className="flex gap-2">
                            {!otpSent ? (
                              <button
                                type="button"
                                disabled={otpSending || !email.includes("@")}
                                onClick={handleSendOtp}
                                className="rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition disabled:opacity-50"
                              >
                                {otpSending ? "Sending OTP…" : "Send Verification Code"}
                              </button>
                            ) : (
                              <div className="w-full space-y-2">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    maxLength={6}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Enter 6-digit OTP"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                    className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-center font-mono tracking-widest text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={otpVerifying || otpCode.length !== 6}
                                    onClick={handleVerifyOtp}
                                    className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition disabled:opacity-50 shrink-0"
                                  >
                                    {otpVerifying ? "Checking…" : "Verify"}
                                  </button>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="text-slate-400">Didn&apos;t get the code?</span>
                                  <button
                                    type="button"
                                    disabled={otpSending}
                                    onClick={handleSendOtp}
                                    className="text-cyan-400 hover:underline"
                                  >
                                    {otpSending ? "Resending…" : "Resend Code"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {otpError && (
                        <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 p-2 text-xs text-rose-300">
                          {otpError}
                        </div>
                      )}
                      {otpSuccess && !otpVerified && (
                        <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2 text-xs text-emerald-300">
                          {otpSuccess}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Subject */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label htmlFor="conv-subject" className="block text-lg sm:text-xl font-bold text-white mb-1">
                      What is this inquiry about?
                    </label>
                    <p className="text-xs text-slate-400">Brief summary or topic (optional).</p>
                  </div>
                  <input
                    id="conv-subject"
                    autoFocus
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setStep(3);
                      }
                    }}
                    placeholder="e.g. Partnership inquiry, project quote…"
                    className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3.5 text-base text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition"
                  />
                </div>
              )}

              {/* Step 3: Message */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label htmlFor="conv-message" className="block text-lg sm:text-xl font-bold text-white mb-1">
                      How can we help you? <span className="text-cyan-400">*</span>
                    </label>
                    <p className="text-xs text-slate-400">Please provide full details or requirements.</p>
                  </div>
                  <textarea
                    id="conv-message"
                    required
                    autoFocus
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && message.trim()) {
                        e.preventDefault();
                        setStep(4);
                      }
                    }}
                    placeholder="Type your message here…"
                    className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition leading-relaxed resize-y"
                  />
                  <div className="text-[11px] text-slate-500 text-right">Tip: Press Ctrl + Enter to advance</div>
                </div>
              )}

              {/* Step 4: Attachment & Review & Submit */}
              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                      Almost done! Add attachments &amp; submit
                    </h3>
                    <p className="text-xs text-slate-400">
                      Upload any supporting files if needed, complete verification, and submit.
                    </p>
                  </div>

                  {/* Summary preview */}
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-semibold text-white truncate max-w-[220px]">{name}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-500">Email:</span>
                      <span className="font-mono text-cyan-300 truncate max-w-[220px]">{email}</span>
                    </div>
                    {subject && (
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-500">Subject:</span>
                        <span className="text-white truncate max-w-[220px]">{subject}</span>
                      </div>
                    )}
                  </div>

                  {/* File Attachment */}
                  <div className="relative rounded-2xl border border-dashed border-white/15 bg-black/30 p-4 text-center hover:border-cyan-400/50 hover:bg-cyan-500/5 transition group">
                    <input
                      id="conv-file"
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
                          Attach document or file (optional)
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Max: {form.maxAttachmentSizeMb || 10}MB
                          {form.allowedFileExtensions ? ` • Allowed: ${form.allowedFileExtensions}` : ""}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ALTCHA */}
                  {form.altchaEnabled && (
                    <div className="pt-2">
                      <TurnstileAltcha
                        challengeUrl="/api/altcha/challenge"
                        onVerified={(token: string) => setAltchaPayload(token)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Submit Error */}
              {submitError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-medium">
                  {submitError}
                </div>
              )}

              {/* Conversational Navigation Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0 || submitting}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Back
                </button>

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 0 && !name.trim()) return;
                      if (step === 1 && (!email.includes("@") || (form.otpEnabled && !otpVerified))) return;
                      if (step === 3 && !message.trim()) return;
                      setStep((s) => s + 1);
                    }}
                    disabled={
                      (step === 0 && !name.trim()) ||
                      (step === 1 && (!email.includes("@") || (form.otpEnabled && !otpVerified))) ||
                      (step === 3 && !message.trim())
                    }
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-sky-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <span>{step === 1 && form.otpEnabled && !otpVerified ? "Verify OTP to Continue" : "Continue"}</span>
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || !name.trim() || !email.includes("@") || !message.trim() || (form.otpEnabled && !otpVerified)}
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-sky-400 active:scale-[0.99] transition disabled:opacity-60 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Submitting…</span>
                      </>
                    ) : (
                      <span>Submit Response ✓</span>
                    )}
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* Classic One-Page Mode */
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
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="alex@example.com"
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                  />
                </div>
              </div>

              {/* Form Submitter Email OTP Verification Card */}
              {form.otpEnabled && (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <span>🔒</span> 6-Digit Email Verification Required
                    </span>
                    {otpVerified && (
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                        ✓ Verified
                      </span>
                    )}
                  </div>

                  {otpVerified ? (
                    <p className="text-xs text-emerald-400 font-medium">
                      ✓ Email successfully verified ({email})! You can now submit this form.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-400">
                        To prevent spam and verify authenticity, please verify <strong className="text-white">{email || "your email address"}</strong> with a 6-digit passcode.
                      </p>
                      <div className="flex gap-2">
                        {!otpSent ? (
                          <button
                            type="button"
                            disabled={otpSending || !email.includes("@")}
                            onClick={handleSendOtp}
                            className="rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 transition disabled:opacity-50"
                          >
                            {otpSending ? "Sending OTP…" : "Send Verification Code"}
                          </button>
                        ) : (
                          <div className="w-full space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="Enter 6-digit OTP"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-center font-mono tracking-widest text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={otpVerifying || otpCode.length !== 6}
                                onClick={handleVerifyOtp}
                                className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition disabled:opacity-50 shrink-0"
                              >
                                {otpVerifying ? "Checking…" : "Verify"}
                              </button>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400">Didn&apos;t get the code?</span>
                              <button
                                type="button"
                                disabled={otpSending}
                                onClick={handleSendOtp}
                                className="text-cyan-400 hover:underline"
                              >
                                {otpSending ? "Resending…" : "Resend Code"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {otpError && (
                    <div className="rounded-lg bg-rose-500/15 border border-rose-500/30 p-2 text-xs text-rose-300">
                      {otpError}
                    </div>
                  )}
                  {otpSuccess && !otpVerified && (
                    <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 p-2 text-xs text-emerald-300">
                      {otpSuccess}
                    </div>
                  )}
                </div>
              )}

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
                disabled={submitting || (form.otpEnabled && !otpVerified)}
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
