"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Is FormForge really free, or is that a trial?",
    a: "Really free. It runs entirely inside Cloudflare's free tier (or Neon, Turso, or a local SQLite file). There is no FormForge account, no seat, no submission cap, and no feature that unlocks after a trial. The project is MIT-licensed open source.",
  },
  {
    q: "Where does my data actually live?",
    a: "In the database you provision — a Cloudflare D1 database inside your own Cloudflare account, a Neon Postgres database, a Turso database, or a local SQLite file. FormForge's servers never touch it. IP addresses are hashed with a per-day rotating salt, and you can disable IP storage entirely.",
  },
  {
    q: "Does it need a DATABASE_URL to build?",
    a: "No. The schema is applied lazily at request time, so a Cloudflare, Vercel or Netlify build never initialises a database. On first request FormForge creates its tables and adds any new columns to an existing database automatically, with zero downtime.",
  },
  {
    q: "What stops spam without reCAPTCHA?",
    a: "Three layers that need no third party: a honeypot field, a configurable blocklist, and native ALTCHA proof-of-work solved in the visitor's browser. There is also a configurable spam score, per-IP rate limits, and optional six-digit email verification. Because nothing is loaded from a third-party domain, there is no tracker and no cookie consent banner.",
  },
  {
    q: "How are webhooks secured?",
    a: "Every delivery carries an X-FormForge-Signature header containing a timestamp and an HMAC-SHA256 of the body, plus a delivery id and event name. Failed deliveries retry automatically on an exponential backoff, and every attempt is logged with its status code and latency so you can audit or redeliver by hand.",
  },
  {
    q: "Can I migrate away later?",
    a: "Any time. It is plain SQLite/Postgres with a documented schema, and every form has a built-in CSV and JSON export. There is no proprietary format, no export fee, and no vendor lock-in by design.",
  },
  {
    q: "Do I need a credit card?",
    a: "No. Every dependency FormForge can run on has a cardless free tier: Cloudflare Workers + D1, Vercel, Netlify, Neon, Turso, Backblaze B2 and Google Apps Script. The one-click deploy button provisions the Worker and the D1 database without ever asking for payment details.",
  },
  {
    q: "Can multiple people use one deployment?",
    a: "Yes. Accounts carry roles, API keys can be scoped per integration, sessions can be listed and revoked individually, and a full audit trail records every administrative action with a timestamp and the acting user.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-aurora-400">
          Questions
        </p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
          The things people ask first
        </h2>
      </div>

      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = open === index;
          return (
            <div
              key={faq.q}
              className={`surface-card overflow-hidden transition-colors duration-300 ${
                isOpen ? "border-aurora-400/25" : ""
              }`}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${index}`}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-[15px] font-bold text-white sm:text-base">
                    {faq.q}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/12 transition-all duration-300 ${
                      isOpen
                        ? "rotate-45 border-aurora-400/40 bg-aurora-400/10 text-aurora-200"
                        : "text-slate-400"
                    }`}
                  >
                    <span className="absolute h-[1.5px] w-3 bg-current" />
                    <span className="absolute h-3 w-[1.5px] bg-current" />
                  </span>
                </button>
              </h3>
              <div
                id={`faq-panel-${index}`}
                className={`grid transition-[grid-template-rows,opacity] duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-6 text-sm leading-7 text-slate-400">{faq.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
