import { Reveal } from "@/components/Reveal";

const STEPS = [
  {
    n: "01",
    title: "Deploy to your own account",
    body: "One click forks the repo into your GitHub, names your Worker, creates the D1 database and wires the bindings. You own the account, the data and the bill (there isn't one).",
    detail: "Cloudflare Workers · D1 · R2",
  },
  {
    n: "02",
    title: "Point a form at your endpoint",
    body: "Copy the endpoint from the dashboard and drop it into any HTML form, or use the hosted conversational page at /f/your-slug. Set an origin allowlist and turn on proof-of-work.",
    detail: "HTML · JSON · React · Webflow",
  },
  {
    n: "03",
    title: "Own the responses",
    body: "Submissions land in your database, encrypted at rest. Search them, export them, route them to a signed webhook, a channel message, or your inbox — with full audit history.",
    detail: "Export · Webhooks · Slack · ntfy",
  },
];

export function HowItWorks() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
      <Reveal direction="up">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-aurora-400">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Three steps. No credit card.
          </h2>
        </div>
      </Reveal>

      <div className="relative mt-16">
        {/* Connector rail */}
        <div
          aria-hidden="true"
          className="absolute left-[2.25rem] top-4 hidden h-[calc(100%-2rem)] w-px bg-gradient-to-b from-aurora-400/50 via-iris-400/30 to-transparent lg:block"
        />

        <ol className="space-y-6">
          {STEPS.map((step, index) => (
            <Reveal
              as="li"
              key={step.n}
              direction="up"
              delay={index * 110}
              className="relative lg:pl-24"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 hidden h-9 w-9 items-center justify-center rounded-full border border-aurora-400/40 bg-aurora-400/10 font-mono text-xs font-bold text-aurora-200 lg:flex"
              >
                {step.n}
              </span>
              <div className="surface-card p-7 transition-transform duration-500 hover:-translate-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <h3 className="text-xl font-bold text-white sm:text-2xl">{step.title}</h3>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
                    {step.n}
                  </span>
                </div>
                <p className="mt-3 leading-7 text-slate-400">{step.body}</p>
                <p className="mt-5 font-mono text-xs text-aurora-300/80">{step.detail}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
