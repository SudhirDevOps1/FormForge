import { Reveal } from "@/components/Reveal";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#workflow" },
      { label: "Security", href: "#security" },
      { label: "Pricing", href: "#pricing" },
      { label: "Live dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Documentation",
    links: [
      { label: "Docs", href: "/docs.html" },
      { label: "Integration guide", href: "/guide.html" },
      { label: "OpenAPI spec", href: "/api/openapi.json" },
      { label: "Health check", href: "/api/health" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: "https://github.com/SudhirDevOps1/FormForge" },
      { label: "Privacy policy", href: "/privacypolicy.html" },
      { label: "Security policy", href: "/github/SudhirDevOps1/FormForge/security/policy" },
      { label: "Issues", href: "https://github.com/SudhirDevOps1/FormForge/issues" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10">
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <Reveal direction="up">
            <div>
              <div className="flex items-center gap-3">
                <img src="/logo.svg" alt="" className="h-10 w-10 rounded-xl" />
                <span className="text-lg font-extrabold tracking-tight">FormForge</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
                A forever-free, open-source form backend for static sites and modern web
                apps. Self-hosted, privacy-first, and powered by Cloudflare&apos;s edge.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="chip">MIT licensed</span>
                <span className="chip">Zero trackers</span>
                <span className="chip">Self-hosted</span>
              </div>
            </div>
          </Reveal>

          <div className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((column, index) => (
              <Reveal key={column.title} direction="up" delay={index * 80}>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    {column.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="text-sm text-slate-400 transition-colors duration-200 hover:text-aurora-200"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-14 space-y-3 border-t border-white/8 pt-8 text-center text-xs text-slate-500">
          <p>
            🔒 AES-256-GCM encrypted &bull; v1.1 Aurora &bull;{" "}
            <a
              href="/privacypolicy.html"
              className="text-aurora-300/80 underline decoration-aurora-300/25 transition hover:text-aurora-200"
            >
              Privacy &amp; Security Policy
            </a>
          </p>
          <p className="text-[11px] text-slate-600">
            © 2026 Sudhir Singh. All rights reserved. Self-hosted deployments must
            maintain the original developer credit and attribution links intact.
          </p>
        </div>
      </div>
    </footer>
  );
}
