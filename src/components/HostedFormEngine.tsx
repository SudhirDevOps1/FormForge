"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateRules, type FormRule } from "@/lib/rules";
import { TurnstileAltcha } from "@/components/TurnstileAltcha";
import { SignaturePad } from "@/components/SignaturePad";

export interface HostedField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

export interface HostedPrefill {
  fieldKey: string;
  paramName: string;
  isHidden: boolean;
}

export interface HostedFormEngineProps {
  formId: string;
  endpointId: string;
  name: string;
  description?: string | null;
  successMessage: string;
  redirectUrl?: string | null;
  altchaEnabled: boolean;
  otpEnabled: boolean;
  maxAttachmentSizeMb: number;
  allowedFileExtensions: string;
  fields: HostedField[];
  rules: FormRule[];
  prefills: HostedPrefill[];
  captureUtm: boolean;
  partialSubmissionsEnabled: boolean;
  formToken?: string | null;
  onOtpRequired?: (email: string) => void;
  onVerified?: (email: string) => void;
  otpVerified?: boolean;
}

type Values = Record<string, string>;

function computeTotalQuizScore(vals: Values): number {
  let sum = 0;
  for (const val of Object.values(vals)) {
    if (typeof val === "string") {
      const match = val.match(/(?:\[score:|\+|score:)(\d+)\]?/i);
      if (match) {
        sum += parseInt(match[1], 10) || 0;
      }
    }
  }
  return sum;
}

/**
 * Dynamic hosted form.
 *
 * Renders the owner-defined field list and applies the three client-side
 * conveniences that mirror the server:
 *
 *   • **Conditional logic** — fields are shown/hidden live as answers change.
 *     The server re-evaluates the same rules and strips anything hidden, so
 *     this is purely a UX layer.
 *   • **Prefill** — URL parameters fill matching fields. Hidden fields are
 *     injected server-side and never rendered.
 *   • **Save & resume** — progress can be stored and continued with a resume
 *     link.
 */
export function HostedFormEngine(props: HostedFormEngineProps) {
  const {
    endpointId,
    description,
    successMessage,
    redirectUrl,
    altchaEnabled,
    otpEnabled,
    maxAttachmentSizeMb,
    allowedFileExtensions,
    fields,
    rules,
    prefills,
    partialSubmissionsEnabled,
    formToken,
    onOtpRequired,
    onVerified,
    otpVerified: otpVerifiedProp = false,
  } = props;

  const [values, setValues] = useState<Values>({});
  const totalQuizScore = computeTotalQuizScore(values);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [altchaPayload, setAltchaPayload] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(otpVerifiedProp);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [savingPartial, setSavingPartial] = useState(false);
  const [partialSaved, setPartialSaved] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const hydratedRef = useRef(false);

  /* ---------------------------------------------------------------- */
  /* Prefill + resume bootstrap                                       */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const search = new URLSearchParams(window.location.search);

    // Editable prefills fill the visible inputs.
    const seeded: Values = {};
    for (const prefill of prefills) {
      if (prefill.isHidden) continue;
      const value = search.get(prefill.paramName);
      if (value !== null) seeded[prefill.fieldKey] = value.slice(0, 512);
    }
    if (Object.keys(seeded).length) setValues(seeded);

    // Resume a saved partial submission.
    const resume = search.get("resume");
    if (resume) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/submit/${encodeURIComponent(endpointId)}/partial?token=${encodeURIComponent(resume)}`,
          );
          const json = await res.json();
          if (json?.ok && json.data?.payload) {
            setValues((prev) => ({ ...prev, ...(json.data.payload as Values) }));
            setResumeToken(resume);
            setResumed(true);
          }
        } catch {
          /* a stale resume link simply starts a fresh form */
        }
      })();
    }
  }, [endpointId, prefills]);

  /* ---------------------------------------------------------------- */
  /* Conditional logic                                                */
  /* ---------------------------------------------------------------- */

  const evaluation = useMemo(
    () => evaluateRules(rules, values as Record<string, unknown>),
    [rules, values],
  );
  const hiddenFields = useMemo(() => new Set(evaluation.hidden), [evaluation.hidden]);
  const requiredFields = useMemo(() => new Set(evaluation.required), [evaluation.required]);

  const visibleFields = useMemo(
    () => fields.filter((field) => !hiddenFields.has(field.key)),
    [fields, hiddenFields],
  );

  // Clear the value of a field that is hidden, so a stale answer is never
  // submitted.
  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of hiddenFields) {
        if (key in next) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [hiddenFields]);

  const setValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ---------------------------------------------------------------- */
  /* OTP                                                              */
  /* ---------------------------------------------------------------- */

  const emailValue = values.email ?? "";
  const emailField = fields.find((field) => field.key === "email");

  async function requestOtp() {
    if (!emailValue.includes("@")) {
      setOtpError("Enter a valid email address first.");
      return;
    }
    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await fetch(`/api/submit/${encodeURIComponent(endpointId)}/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.ok) {
        onOtpRequired?.(emailValue.trim().toLowerCase());
      } else {
        setOtpError(data.error || data.message || "Failed to send the verification code.");
      }
    } catch {
      setOtpError("Network error sending the verification code.");
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyOtp() {
    if (otpCode.trim().length !== 6) {
      setOtpError("Enter the complete 6-digit code.");
      return;
    }
    try {
      const res = await fetch(`/api/submit/${encodeURIComponent(endpointId)}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue.trim().toLowerCase(),
          code: otpCode.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok && data.verified) {
        setOtpVerified(true);
        setOtpError(null);
        onVerified?.(emailValue.trim().toLowerCase());
      } else {
        setOtpError(data.error || data.message || "Invalid or expired code.");
      }
    } catch {
      setOtpError("Network error verifying the code.");
    }
  }

  /* ---------------------------------------------------------------- */
  /* Save & resume                                                    */
  /* ---------------------------------------------------------------- */

  async function savePartial() {
    setSavingPartial(true);
    setPartialSaved(null);
    try {
      const res = await fetch(`/api/submit/${encodeURIComponent(endpointId)}/partial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: values,
          completedFieldKeys: Object.keys(values),
          token: resumeToken ?? undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResumeToken(data.data.resumeToken);
        setPartialSaved(data.data.resumeToken);
      } else {
        setSubmitError(data.message || "Could not save your progress.");
      }
    } catch {
      setSubmitError("Network error while saving your progress.");
    } finally {
      setSavingPartial(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Submit                                                           */
  /* ---------------------------------------------------------------- */

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (otpEnabled && !otpVerified) {
      setSubmitError("Verify your email address before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(values)) {
        if (hiddenFields.has(key)) continue;
        formData.append(key, value);
      }
      for (const [key, file] of Object.entries(files)) {
        if (hiddenFields.has(key)) continue;
        formData.append(key, file);
      }
      if (altchaPayload) formData.append("altcha", altchaPayload);
      if (otpCode) formData.append("otpCode", otpCode);

      const headers: Record<string, string> = {};
      if (formToken) headers["x-formforge-form-token"] = formToken;
      if (resumeToken) headers["x-formforge-partial-token"] = resumeToken;

      const res = await fetch(`/api/submit/${encodeURIComponent(endpointId)}`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok !== false) {
        setSubmitted(true);
        if (redirectUrl) {
          let target = redirectUrl;
          for (const [k, v] of Object.entries(values)) {
            if (typeof v === "string" && !k.startsWith("_") && !v.startsWith("data:")) {
              const regex = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
              target = target.replace(regex, encodeURIComponent(v));
            }
          }
          if (totalQuizScore > 0) {
            target = target.replace(/\{\{score\}\}/gi, String(totalQuizScore));
          }
          target = target.replace(/\{\{[^}]+\}\}/g, "");
          window.setTimeout(() => {
            window.location.href = target;
          }, 1500);
        }
      } else {
        setSubmitError(data?.message || data?.error || "Submission failed. Please try again.");
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Network error. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  if (submitted) {
    return (
      <div className="animate-fade-in space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-2xl text-emerald-400">
          ✓
        </div>
        <h3 className="text-xl font-bold text-white">Submission Received!</h3>
        <p className="text-sm leading-relaxed text-slate-300">{successMessage}</p>
        {totalQuizScore > 0 && (
          <div className="mx-auto max-w-xs rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-center">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Assessment / Quiz Score</span>
            <div className="text-2xl font-bold text-white mt-0.5">{totalQuizScore} Points</div>
          </div>
        )}
        {redirectUrl && <p className="text-xs text-cyan-400 animate-pulse">Redirecting you now…</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {description && <p className="text-sm leading-relaxed text-slate-400">{description}</p>}

      {resumed && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-300">
          Welcome back — we restored your saved progress.
        </div>
      )}

      {visibleFields.map((field) => (
        <DynamicField
          key={field.key}
          field={field}
          required={field.required || requiredFields.has(field.key)}
          value={values[field.key] ?? ""}
          file={files[field.key] ?? null}
          maxAttachmentSizeMb={maxAttachmentSizeMb}
          allowedFileExtensions={allowedFileExtensions}
          onChange={(value) => setValue(field.key, value)}
          onFile={(file) =>
            setFiles((prev) => {
              const next = { ...prev };
              if (file) next[field.key] = file;
              else delete next[field.key];
              return next;
            })
          }
        />
      ))}

      {/* OTP verification */}
      {otpEnabled && emailField && (
        <div className="space-y-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300">🔒 Email verification required</span>
            {otpVerified && (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                ✓ Verified
              </span>
            )}
          </div>

          {otpVerified ? (
            <p className="text-xs font-medium text-emerald-400">
              ✓ Email successfully verified. You can submit now.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={requestOtp}
                disabled={otpSending}
                className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
              >
                {otpSending ? "Sending…" : "Send verification code"}
              </button>
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  aria-label="6-digit verification code"
                  className="flex-1 rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                />
                <button
                  type="button"
                  onClick={verifyOtp}
                  className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                >
                  Verify
                </button>
              </div>
              {otpError && <p className="text-xs font-medium text-rose-400">{otpError}</p>}
            </>
          )}
        </div>
      )}

      {altchaEnabled && (
        <TurnstileAltcha onVerified={(payload) => setAltchaPayload(payload)} />
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300"
        >
          {submitError}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-4 font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:from-cyan-300 hover:to-sky-400 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {submitting ? "Sending…" : "Send"}
        </button>

        {partialSubmissionsEnabled && (
          <button
            type="button"
            onClick={savePartial}
            disabled={savingPartial}
            className="rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-sm font-semibold text-slate-300 transition hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-60"
          >
            {savingPartial ? "Saving…" : "Save & continue later"}
          </button>
        )}
      </div>

      {partialSaved && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-300">
          Progress saved. Resume link:{" "}
          <code className="break-all font-mono text-emerald-200">
            {typeof window !== "undefined"
              ? `${window.location.origin}${window.location.pathname}?resume=${partialSaved}`
              : partialSaved}
          </code>
        </div>
      )}

      <p className="pt-2 text-center text-[11px] text-slate-600">
        Secured by FormForge &bull; encrypted at rest &bull; no third-party trackers
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Individual field renderer                                          */
/* ------------------------------------------------------------------ */

function DynamicField({
  field,
  required,
  value,
  file,
  maxAttachmentSizeMb,
  allowedFileExtensions,
  onChange,
  onFile,
}: {
  field: HostedField;
  required: boolean;
  value: string;
  file: File | null;
  maxAttachmentSizeMb: number;
  allowedFileExtensions: string;
  onChange: (value: string) => void;
  onFile: (file: File | null) => void;
}) {
  const inputClass =
    "w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3.5 text-base text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition";

  const label = (
    <label htmlFor={`field-${field.key}`} className="block text-sm font-bold text-white mb-1.5">
      {field.label}
      {required && <span className="text-cyan-400"> *</span>}
    </label>
  );

  const type = (field.type || "text").toLowerCase();

  if (type === "textarea") {
    return (
      <div>
        {label}
        <textarea
          id={`field-${field.key}`}
          required={required}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      </div>
    );
  }

  if (type === "signature") {
    return (
      <div>
        <SignaturePad
          label={field.label}
          required={required}
          value={value}
          onChange={onChange}
        />
      </div>
    );
  }

  if (type === "file") {
    const accept = allowedFileExtensions
      ? allowedFileExtensions
          .split(",")
          .map((ext) => ext.trim().replace(/^\./, ""))
          .filter(Boolean)
          .map((ext) => `.${ext}`)
          .join(",")
      : undefined;

    return (
      <div>
        {label}
        <input
          id={`field-${field.key}`}
          type="file"
          required={required}
          accept={accept}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-slate-950"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Max {maxAttachmentSizeMb} MB
          {allowedFileExtensions ? ` · ${allowedFileExtensions}` : ""}
        </p>
        {file && <p className="mt-1 text-[11px] text-cyan-300">Selected: {file.name}</p>}
      </div>
    );
  }

  if (type === "select" || type === "radio") {
    const options = field.label.includes("|")
      ? field.label.split("|").map((option) => option.trim())
      : [];
    const cleanLabel = options.length ? field.label.split("|")[0].trim() : field.label;

    if (!options.length) {
      return (
        <div>
          <label className="block text-sm font-bold text-white mb-1.5">
            {cleanLabel}
            {required && <span className="text-cyan-400"> *</span>}
          </label>
          <input
            id={`field-${field.key}`}
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    }

    return (
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-white">
          {cleanLabel}
          {required && <span className="text-cyan-400"> *</span>}
        </legend>
        <div className="space-y-2">
          {options.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                value === option
                  ? "border-cyan-400/50 bg-cyan-400/10 text-white"
                  : "border-white/10 bg-black/30 text-slate-300 hover:border-white/25"
              }`}
            >
              <input
                type="radio"
                name={`field-${field.key}`}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="h-4 w-4 accent-cyan-400"
              />
              <span>{option.replace(/\[(?:score:)?\d+\]/gi, "").trim()}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (type === "checkbox") {
    return (
      <div>
        <label
          htmlFor={`field-${field.key}`}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-200"
        >
          <input
            id={`field-${field.key}`}
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="mt-0.5 h-4 w-4 accent-cyan-400"
          />
          {field.label}
        </label>
      </div>
    );
  }

  const inputType =
    type === "email"
      ? "email"
      : type === "number"
        ? "number"
        : type === "tel"
          ? "tel"
          : type === "url"
            ? "url"
            : type === "date"
              ? "date"
              : "text";

  return (
    <div>
      {label}
      <input
        id={`field-${field.key}`}
        type={inputType}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
