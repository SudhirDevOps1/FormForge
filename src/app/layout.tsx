import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { HydrationGuard } from "@/components/HydrationGuard";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://formforge.dev"),
  title: {
    default: "FormForge — Free privacy-first form backend",
    template: "%s · FormForge",
  },
  description:
    "A forever-free, open-source form backend for static sites. Self-host on Cloudflare Workers and D1 with no DATABASE_URL or paid database required.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/logo.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FormForge",
    description: "Self-hosted form backend for static sites on Cloudflare Workers + D1.",
    images: ["/logo.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FormForge — Free privacy-first form backend",
    description: "Self-hosted form backend for static sites on Cloudflare Workers + D1.",
    images: ["/logo.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "FormForge",
    "operatingSystem": "Cloudflare Workers",
    "applicationCategory": "DeveloperApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "A forever-free, open-source form backend for static sites. Self-host on Cloudflare Workers and D1."
  };

  return (
    <html
      lang="en"
      className="scroll-smooth"
      // The inline head script below adds the `ff-js` class before React
      // hydrates, so the client DOM intentionally differs from the server
      // HTML for this one attribute.
      suppressHydrationWarning
    >
      <head>
        {/*
          Marks the document as JS-capable before first paint so the scroll
          reveal system can hide elements before they animate in — without
          ever flashing hidden content for no-JS visitors, and without
          leaving content invisible if the client bundle fails to load.

          The second half of this script is a failsafe: if the React runtime
          never boots (blocked script, CSP violation, network failure), the
          `ff-js` class is removed again after a grace period and every
          element becomes visible. A slow or broken client must never be able
          to leave a visitor staring at an empty page.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.classList.add("ff-js");window.__ffHydrated=false;window.__ffHydrateTimer=window.setTimeout(function(){if(!window.__ffHydrated){d.classList.remove("ff-js");d.classList.add("ff-fallback");}},5000);})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <HydrationGuard />
        {children}
      </body>
    </html>
  );
}
