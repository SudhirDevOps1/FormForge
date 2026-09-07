"use client";

import React, { useState, useRef, useCallback } from "react";

export interface TurnstileAltchaProps {
  challengeUrl?: string;
  onVerified?: (payload: string, elapsedMs: number) => void;
  className?: string;
}

export function TurnstileAltcha({
  challengeUrl = "/api/altcha/challenge?maxnumber=20000",
  onVerified,
  className = "",
}: TurnstileAltchaProps) {
  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "error">("idle");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const isSolvingRef = useRef(false);

  const solveChallenge = useCallback(async () => {
    if (isSolvingRef.current || status === "verified") return;
    isSolvingRef.current = true;
    setStatus("verifying");
    setErrorMsg("");

    const startTime = performance.now();

    try {
      // 1. Fetch live challenge
      const res = await fetch(challengeUrl, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Unable to fetch challenge.");
      }
      const data = await res.json();
      const { challenge, maxnumber = 20000, salt, signature, algorithm } = data;

      if (!challenge || !salt || !signature) {
        throw new Error("Invalid challenge received.");
      }

      // 2. Parallel batched WebCrypto SHA-256 solver
      const { subtle } = crypto;
      const encoder = new TextEncoder();
      const targetHex = challenge.toLowerCase();

      function bufToHex(buf: ArrayBuffer): string {
        const bytes = new Uint8Array(buf);
        let hex = "";
        for (let i = 0; i < bytes.length; i++) {
          hex += bytes[i].toString(16).padStart(2, "0");
        }
        return hex;
      }

      let solvedNumber = -1;
      const batchSize = 250;
      const limit = Math.min(Number(maxnumber) || 20000, 100000);

      for (let batch = 0; batch <= limit; batch += batchSize) {
        const promises: Promise<{ i: number; hex: string }>[] = [];
        const batchEnd = Math.min(batch + batchSize, limit + 1);

        for (let i = batch; i < batchEnd; i++) {
          promises.push(
            subtle.digest("SHA-256", encoder.encode(`${salt}${i}`)).then((buf) => ({
              i,
              hex: bufToHex(buf),
            }))
          );
        }

        const results = await Promise.all(promises);
        const match = results.find((r) => r.hex === targetHex);
        if (match) {
          solvedNumber = match.i;
          break;
        }
      }

      if (solvedNumber === -1) {
        throw new Error("Failed to compute solution in range.");
      }

      // 3. Construct standard ALTCHA payload
      const payloadObj = {
        algorithm: algorithm || "SHA-256",
        challenge,
        number: solvedNumber,
        salt,
        signature,
      };

      const base64Payload = btoa(JSON.stringify(payloadObj));
      const totalElapsed = Math.max(1, Math.round(performance.now() - startTime));

      setElapsedMs(totalElapsed);
      setStatus("verified");
      onVerified?.(base64Payload, totalElapsed);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Verification failed");
    } finally {
      isSolvingRef.current = false;
    }
  }, [challengeUrl, onVerified, status]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/90 p-3.5 shadow-lg backdrop-blur-md transition-all hover:border-slate-600 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Interactive State */}
        <div className="flex items-center gap-3 min-w-0">
          {status === "idle" && (
            <button
              type="button"
              onClick={solveChallenge}
              className="group flex items-center gap-2.5 text-left focus:outline-none"
              aria-label="Verify you are human"
            >
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-slate-500 bg-slate-800/80 transition-all group-hover:border-cyan-400 group-hover:shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                <span className="h-1.5 w-1.5 rounded-sm bg-transparent group-hover:bg-cyan-400/40" />
              </span>
              <span className="text-sm font-medium text-slate-200 transition-colors group-hover:text-white">
                Verify you are human
              </span>
            </button>
          )}

          {status === "verifying" && (
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                <span className="absolute h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-cyan-300 animate-pulse">
                  Verifying...
                </span>
                <span className="text-[10px] text-slate-400">
                  Computing in-browser Proof-of-Work
                </span>
              </div>
            </div>
          )}

          {status === "verified" && (
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                <svg className="h-3.5 w-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-emerald-400">
                  Verification successful
                </span>
                {elapsedMs !== null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300">
                    <span>⚡</span> Solved in <strong>{elapsedMs}ms</strong> (Proof-of-Work)
                  </span>
                )}
              </div>
            </div>
          )}

          {status === "error" && (
            <button
              type="button"
              onClick={solveChallenge}
              className="flex items-center gap-2.5 text-left text-rose-300 hover:text-rose-200"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-400">
                ✕
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Verification failed</span>
                <span className="text-[10px] text-rose-400/80">{errorMsg || "Click to retry"}</span>
              </div>
            </button>
          )}
        </div>

        {/* Right Turnstile-style Emblem */}
        <div className="flex shrink-0 flex-col items-end border-l border-slate-700/60 pl-3">
          <div className="flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5 text-cyan-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.54-3.15 8.79-7 9.9-3.85-1.11-7-5.36-7-9.9V6.3l7-3.12z" />
            </svg>
            <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              ALTCHA
            </span>
          </div>
          <span className="text-[9px] text-slate-500">
            Privacy &bull; Free PoW
          </span>
        </div>
      </div>
    </div>
  );
}
