"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const EXTERNAL = [
  { href: "/docs.html", label: "Docs" },
  { href: "/guide.html", label: "Guide" },
  { href: "/privacypolicy.html", label: "Privacy" },
];

/**
 * Sticky glass navigation.
 *
 * Zero dependencies: the drawer uses a CSS grid-template-rows transition
 * (`0fr` → `1fr`) which animates to auto height without JavaScript layout
 * measurement, and the stagger on the links is a pure CSS `animation-delay`.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy for the section underline.
  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.href.slice(1))).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.2, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-[#05070f]/80 backdrop-blur-xl shadow-[0_10px_40px_-24px_rgba(0,0,0,0.9)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav
        className="mx-auto flex h-[var(--ff-nav-h)] w-full max-w-7xl items-center justify-between px-5 sm:px-8"
        aria-label="Primary"
      >
        <a href="#top" className="group flex items-center gap-3" aria-label="FormForge home">
          <span className="relative">
            <img
              src="/logo.svg"
              alt=""
              className="h-10 w-10 rounded-xl shadow-lg shadow-cyan-950/40 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
            />
            <span className="absolute -inset-1 -z-10 rounded-2xl bg-aurora-400/25 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">FormForge</span>
        </a>

        <div className="hidden items-center gap-1 text-sm text-slate-300 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`relative rounded-lg px-3 py-2 transition-colors duration-200 hover:text-white ${
                active === link.href ? "text-white" : ""
              }`}
            >
              {link.label}
              {active === link.href && (
                <span className="absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-aurora-400 to-transparent" />
              )}
            </a>
          ))}
          <span className="mx-2 h-4 w-px bg-white/10" aria-hidden="true" />
          {EXTERNAL.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 transition-colors duration-200 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="https://github.com/SudhirDevOps1/FormForge"
            className="rounded-xl border border-white/12 px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            GitHub ↗
          </a>
          <a href="/dashboard" className="btn btn-primary !px-5 !py-2.5 !text-[13px]">
            Open Dashboard
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 text-slate-200 transition-colors duration-200 hover:bg-white/5 lg:hidden"
        >
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 block h-[2px] w-5 rounded-full bg-current transition-all duration-300 ${
                open ? "top-1.5 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-1.5 block h-[2px] w-5 rounded-full bg-current transition-opacity duration-200 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 block h-[2px] w-5 rounded-full bg-current transition-all duration-300 ${
                open ? "top-1.5 -rotate-45" : "top-3"
              }`}
            />
          </span>
        </button>
      </nav>

      {/* Mobile drawer — grid-rows trick animates to auto height without JS */}
      <div
        id="mobile-nav"
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/10 bg-[#05070f]/95 backdrop-blur-xl">
            <div className="space-y-1 px-5 py-5">
              {[...LINKS, ...EXTERNAL].map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  style={{ animationDelay: `${index * 35}ms` }}
                  className={`block rounded-xl px-4 py-3 text-base font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-white ${
                    open ? "animate-[ff-slide-up_0.4s_cubic-bezier(0.16,1,0.3,1)_both]" : ""
                  }`}
                >
                  {link.label}
                </a>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <a
                  href="https://github.com/SudhirDevOps1/FormForge"
                  className="btn btn-ghost w-full"
                >
                  GitHub ↗
                </a>
                <a href="/dashboard" className="btn btn-primary w-full">
                  Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
