import { Aurora } from "@/components/Aurora";
import { Magnetic } from "@/components/Magnetic";
import { Reveal } from "@/components/Reveal";
import { BentoFeatures } from "@/components/landing/BentoFeatures";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Navbar } from "@/components/landing/Navbar";
import { Pricing } from "@/components/landing/Pricing";
import { ProductTabs } from "@/components/landing/ProductTabs";
import { SecurityGrid } from "@/components/landing/SecurityGrid";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <Navbar />

      <Hero />
      <BentoFeatures />
      <ProductTabs />
      <HowItWorks />
      <SecurityGrid />
      <Pricing />
      <Faq />

      {/* Final CTA */}
      <section className="relative overflow-hidden py-24">
        <Aurora intensity={0.75} />
        <div className="relative mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
          <Reveal direction="up">
            <h2 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              Ship your form
              <span className="gradient-text-aurora"> tonight.</span>
            </h2>
          </Reveal>
          <Reveal direction="up" delay={110}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-300">
              One click to deploy, one endpoint to paste, and every response stored in
              a database you control — encrypted, searchable and exportable forever.
            </p>
          </Reveal>
          <Reveal direction="up" delay={200}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Magnetic strength={8}>
                <a
                  href="https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge"
                  className="btn btn-primary !px-7 !py-4 !text-[15px]"
                >
                  Deploy to Cloudflare
                </a>
              </Magnetic>
              <a href="/dashboard" className="btn btn-ghost !px-7 !py-4 !text-[15px]">
                Open Dashboard
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
