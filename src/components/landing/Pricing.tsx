import { Reveal } from "@/components/Reveal";

const PLANS = [
  {
    name: "Free Forever",
    price: "$0",
    cadence: "for as long as Cloudflare's free tier exists",
    highlight: false,
    cta: "Deploy to Cloudflare",
    href: "https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge",
    features: [
      "Unlimited forms",
      "Unlimited submissions",
      "CSV + JSON export",
      "Conditional logic & drop-off analytics",
      "Signed webhooks with auto-retry",
      "Native Slack, Discord, Telegram, ntfy",
      "ALTCHA proof-of-work + spam scoring",
      "AES-256-GCM encryption at rest",
      "TOTP two-factor authentication",
      "D1 · Neon · Turso · SQLite",
    ],
  },
  {
    name: "Self-Hosted Pro",
    price: "$0",
    cadence: "you run it, you own everything",
    highlight: true,
    cta: "Read the docs",
    href: "/docs.html",
    features: [
      "Everything in Free Forever",
      "Your own Cloudflare, Vercel, Netlify or Docker",
      "Bring your own SMTP, Resend, Brevo, Mailgun",
      "S3 / R2 / Backblaze B2 file storage",
      "Google Apps Script relay",
      "In-browser DuckDB SQL studio",
      "Full OpenAPI specification",
      "Session management & audit trail",
      "Rate limits and quotas per form",
      "No vendor lock-in, ever",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
      <Reveal direction="up">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-aurora-400">
            Pricing
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Two ways to run it. Neither costs anything.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            FormForge is open source. There is no paid tier, no seat count, no
            submission cap, and no upgrade button that appears when you outgrow the
            free one.
          </p>
        </div>
      </Reveal>

      <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-2">
        {PLANS.map((plan, index) => (
          <Reveal key={plan.name} direction="up" delay={index * 110}>
            <article
              className={`relative h-full overflow-hidden rounded-[1.75rem] p-8 ${
                plan.highlight
                  ? "border border-aurora-400/30 bg-gradient-to-b from-aurora-500/[0.12] via-white/[0.03] to-transparent shadow-[0_30px_80px_-40px_rgba(34,211,238,0.6)]"
                  : "surface-card"
              }`}
            >
              {plan.highlight && (
                <>
                  <span className="absolute right-6 top-6 rounded-full border border-aurora-400/40 bg-aurora-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-aurora-200">
                    Recommended
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-aurora-400/15 blur-3xl"
                  />
                </>
              )}

              <div className="relative">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
                  {plan.name}
                </h3>
                <p className="mt-5 flex items-baseline gap-3">
                  <span className="text-5xl font-black tracking-tight text-white">
                    {plan.price}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-400">{plan.cadence}</p>

                <ul className="mt-7 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        className="mt-0.5 h-4 w-4 shrink-0 text-aurora-400"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.href}
                  className={`btn mt-8 w-full ${
                    plan.highlight ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
