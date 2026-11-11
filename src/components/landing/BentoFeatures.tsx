import { Reveal } from "@/components/Reveal";

interface BentoCard {
  title: string;
  body: string;
  icon: React.ReactNode;
  span: string;
  accent: string;
}

const icon = (path: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const CARDS: BentoCard[] = [
  {
    title: "Conditional logic & branching",
    body: "Show, hide, or make a field required based on a previous answer. Rules evaluate on the server so a hidden field can never be smuggled back in the payload.",
    span: "lg:col-span-2 lg:row-span-1",
    accent: "from-aurora-500/25",
    icon: icon(
      <>
        <path d="M4 6h6M4 6v4" />
        <path d="M10 10h4a4 4 0 0 1 4 4v4" />
        <circle cx="4" cy="6" r="1.5" />
        <circle cx="18" cy="18" r="1.5" />
      </>
    ),
  },
  {
    title: "Drop-off analytics",
    body: "Partial submissions are captured server-side, so you can see exactly which question lost the respondent.",
    span: "lg:col-span-1",
    accent: "from-iris-500/25",
    icon: icon(
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 5-7" />
      </>
    ),
  },
  {
    title: "Signed webhooks with auto-retry",
    body: "Every delivery is HMAC-SHA256 signed and logged. Failed deliveries retry on an exponential backoff — 1m, 5m, 30m, 2h, 12h — and you can redeliver by hand.",
    span: "lg:col-span-2",
    accent: "from-mint-500/25",
    icon: icon(
      <>
        <path d="M9 12a5 5 0 0 1 10 0" />
        <path d="M5 12a9 9 0 0 1 14-7" />
        <path d="M5 12v4" />
        <path d="M19 12v4" />
        <circle cx="12" cy="17" r="2.5" />
      </>
    ),
  },
  {
    title: "Prefill & hidden fields",
    body: "Fill a field from a URL parameter, inject server-side hidden values, and capture UTM campaign data automatically.",
    span: "lg:col-span-1",
    accent: "from-aurora-500/25",
    icon: icon(
      <>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </>
    ),
  },
  {
    title: "Inbox workflow",
    body: "Triage every submission through new → in progress → resolved, attach internal notes, and reply by email without leaving the dashboard.",
    span: "lg:col-span-1",
    accent: "from-iris-500/25",
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
  },
  {
    title: "Native Slack & Discord",
    body: "Post submissions straight into a channel with a signed webhook URL. No relay service, no third-party app.",
    span: "lg:col-span-1",
    accent: "from-mint-500/25",
    icon: icon(
      <>
        <path d="M14.5 3a4 4 0 0 1 4 4L14 7.5 14.5 3Z" />
        <path d="M21 9.5a4 4 0 0 1-4 4L20.5 9 21 9.5Z" />
        <path d="M9.5 21a4 4 0 0 1-4-4L10 16.5 9.5 21Z" />
        <path d="M3 14.5a4 4 0 0 1 4-4L3.5 14 3 14.5Z" />
      </>
    ),
  },
  {
    title: "Encrypted at rest",
    body: "Submission payloads and integration secrets are sealed with AES-256-GCM. IP addresses are hashed with a per-day rotating salt — or not stored at all.",
    span: "lg:col-span-2",
    accent: "from-aurora-500/25",
    icon: icon(
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    title: "Password-gated forms",
    body: "Protect a form with a password. Stored as a PBKDF2-SHA256 hash and compared in constant time — the plaintext is never written down.",
    span: "lg:col-span-1",
    accent: "from-iris-500/25",
    icon: icon(
      <>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 7.5-2" />
        <circle cx="12" cy="15" r="1" />
      </>
    ),
  },
  {
    title: "Duplicate detection",
    body: "Submissions are fingerprinted on their normalized payload. A repeat is flagged as a duplicate and linked to the original instead of silently piling up.",
    span: "lg:col-span-1",
    accent: "from-mint-500/25",
    icon: icon(
      <>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </>
    ),
  },
  {
    title: "Conversational mode",
    body: "One question at a time, with a progress bar, keyboard navigation and slide transitions — on a hosted page or your own domain.",
    span: "lg:col-span-2",
    accent: "from-aurora-500/25",
    icon: icon(
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9h10M7 13h6" />
      </>
    ),
  },
];

export function BentoFeatures() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
      <Reveal direction="up">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-aurora-400">
            Product depth
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Not a contact form. A form platform.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Everything the hosted builders charge for — branching, drop-off analysis,
            inboxes, signed retries — running on your own database with no vendor
            between you and your data.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card, index) => (
          <Reveal
            key={card.title}
            direction="up"
            delay={Math.min(index * 55, 420)}
            className={`h-full ${card.span}`}
          >
            <article className="spotlight surface-card group h-full p-6 hover:-translate-y-1 hover:border-aurora-400/25">
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accent} via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                aria-hidden="true"
              />
              <div className="relative">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-aurora-300 transition-all duration-500 group-hover:scale-110 group-hover:border-aurora-400/40 group-hover:text-aurora-200 group-hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)]">
                  {card.icon}
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">{card.title}</h3>
                <p className="mt-2.5 text-sm leading-6 text-slate-400">{card.body}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
