import { Aurora } from "@/components/Aurora";
import { Counter } from "@/components/Counter";
import { Magnetic } from "@/components/Magnetic";
import { Reveal } from "@/components/Reveal";
import { LiveStatsCard } from "@/components/LiveStatsCard";
import { DURATION } from "@/lib/motion";

const PILLARS = [
  "Cloudflare D1",
  "Neon Postgres",
  "Turso libSQL",
  "DuckDB Studio",
  "GAS Relay",
  "Telegram · ntfy",
];

const HEADLINE = ["Universal", "form", "backend", "for", "static", "sites."];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-[calc(var(--ff-nav-h)+3rem)]">
      <Aurora intensity={1} />

      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-10 lg:pb-28">
        <div>
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-aurora-400/30 bg-aurora-400/[0.08] px-4 py-1.5 text-xs font-semibold text-aurora-100 shadow-sm shadow-aurora-950/20 backdrop-blur-sm sm:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-400" />
              </span>
              <span>Forever Free Tier</span>
              <span className="text-slate-500">·</span>
              <span>Own Your Database</span>
              <span className="text-slate-500">·</span>
              <span>Zero Paid Limits</span>
            </div>
          </Reveal>

          <h1 className="mt-8 max-w-4xl text-5xl font-black tracking-tight sm:text-6xl lg:text-[4.25rem] lg:leading-[1.05]">
            {HEADLINE.map((word, index) => (
              <Reveal
                key={word}
                as="span"
                direction="up"
                distance={26}
                delay={60 + index * 55}
                className="inline-block"
              >
                {word === "static" ? (
                  <span className="gradient-text-aurora">{word} </span>
                ) : (
                  <span className="text-white"> {word} </span>
                )}
              </Reveal>
            ))}
          </h1>

          <Reveal delay={420} direction="up">
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              A privacy-first, self-hostable form backend with real product depth —
              conditional logic, drop-off analytics, signed webhooks with automatic
              retries, native Slack&nbsp;&amp;&nbsp;Discord, encrypted storage and
              zero third-party trackers. Deploys to your Cloudflare account in one click.
            </p>
          </Reveal>

          <Reveal delay={500} direction="up">
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Magnetic strength={8}>
                <a
                  href="https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge"
                  className="btn btn-primary !px-6 !py-4 !text-[15px]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Deploy to Cloudflare
                </a>
              </Magnetic>

              <a href="/dashboard" className="btn btn-ghost !px-6 !py-4 !text-[15px]">
                Open Dashboard
                <span aria-hidden="true">→</span>
              </a>

              <a
                href="/docs.html"
                className="btn btn-outline !px-6 !py-4 !text-[15px]"
              >
                Read Docs
              </a>
            </div>
          </Reveal>

          <Reveal delay={620} direction="up">
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/8 pt-7 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Privacy
                </p>
                <p className="mt-1 font-bold text-white">
                  <Counter value={0} prefix="" suffix="" /> Zero third-party trackers
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Upfront cost
                </p>
                <p className="mt-1 font-bold text-white">
                  <Counter value={0} prefix="$" /> forever
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Spam defense
                </p>
                <p className="mt-1 font-bold text-white">Native ALTCHA PoW</p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal direction="left" delay={240} distance={34}>
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-10 rounded-[3rem] bg-aurora-500/10 blur-3xl"
            />
            <LiveStatsCard />
          </div>
        </Reveal>
      </div>

      {/* Capability rail */}
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
        <Reveal direction="up" delay={120}>
          <div className="marquee-mask overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] py-4">
            <div className="marquee gap-3">
              {[...PILLARS, ...PILLARS].map((pillar, index) => (
                <span
                  key={`${pillar}-${index}`}
                  className="chip shrink-0 whitespace-nowrap !border-white/10 !bg-white/[0.04] !text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-aurora-400" aria-hidden="true" />
                  {pillar}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export const HERO_DURATION = DURATION;
