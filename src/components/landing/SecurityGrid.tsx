import { Reveal } from "@/components/Reveal";

const PILLARS = [
  {
    label: "AES-256-GCM",
    title: "Encrypted at rest",
    body: "Opt into per-form payload encryption and every submission body is sealed with AES-256-GCM. Integration secrets are always encrypted. The key never leaves the Worker.",
    tone: "text-aurora-300",
  },
  {
    label: "PBKDF2-SHA256",
    title: "100k-iteration passwords",
    body: "Account and form passwords are stretched with a random 16-byte salt. Verification compares digests in constant time.",
    tone: "text-iris-300",
  },
  {
    label: "HMAC-SHA256",
    title: "Signed webhooks",
    body: "Each delivery is signed over the timestamp and body, so a receiver can reject replays and tampering with a single constant-time compare.",
    tone: "text-mint-300",
  },
  {
    label: "RFC 6238 TOTP",
    title: "Native two-factor",
    body: "Six-digit codes from the native Web Crypto implementation. Compatible with every mainstream authenticator, no extra dependency.",
    tone: "text-aurora-300",
  },
  {
    label: "Proof-of-Work",
    title: "ALTCHA spam defense",
    body: "A cryptographic challenge solved on the visitor's device. No third-party tracker, no cookie, no vendor rate limit — fully GDPR friendly.",
    tone: "text-iris-300",
  },
  {
    label: "Magic bytes",
    title: "Upload forensics",
    body: "Uploaded files are checked against binary signatures, so a renamed executable cannot pass as a photo. Stored HTML is neutralized too.",
    tone: "text-mint-300",
  },
  {
    label: "SSRF guard",
    title: "Outbound safety",
    body: "Webhook and integration URLs must be absolute HTTPS and cannot resolve to loopback, link-local or cloud-metadata address space.",
    tone: "text-aurora-300",
  },
  {
    label: "Zero trackers",
    title: "No third-party analytics",
    body: "There is no telemetry script, no tracking pixel and no external font beyond the one optional webfont. IP addresses are hashed, not kept.",
    tone: "text-iris-300",
  },
];

export function SecurityGrid() {
  return (
    <section id="security" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
      <Reveal direction="up">
        <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-aurora-400">
              Security &amp; privacy
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Privacy-first is a feature, not a slogan.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Every primitive below is implemented with the platform&apos;s own Web Crypto
              API. No crypto library, no key-management service, no third party that can
              read your submissions.
            </p>
            <a
              href="/privacypolicy.html"
              className="btn btn-outline mt-7"
            >
              Read the privacy policy
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PILLARS.map((pillar, index) => (
              <Reveal key={pillar.label} direction="up" delay={Math.min(index * 60, 400)}>
                <article className="surface-card group h-full p-5 transition-transform duration-500 hover:-translate-y-1 hover:border-aurora-400/25">
                  <p
                    className={`font-mono text-[11px] uppercase tracking-[0.14em] ${pillar.tone}`}
                  >
                    {pillar.label}
                  </p>
                  <h3 className="mt-2.5 text-base font-bold text-white">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{pillar.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
