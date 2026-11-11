"use client";

import { useEffect } from "react";

/**
 * Signals to the inline head script that the React bundle booted.
 *
 * The scroll-reveal system hides `[data-reveal]` elements behind a `.ff-js`
 * class so they can animate in. That class is added by a tiny inline script
 * before first paint, which means a client-side failure (a blocked script, a
 * CSP violation, a network error) would otherwise leave the page permanently
 * blank.
 *
 * The head script therefore arms a failsafe timer that removes `.ff-js` again
 * if this component never mounts. `HydrationGuard` is the signal that the
 * client runtime is alive and healthy.
 */
export function HydrationGuard() {
  useEffect(() => {
    const globalScope = window as unknown as {
      __ffHydrated?: boolean;
      __ffHydrateTimer?: number;
    };
    globalScope.__ffHydrated = true;
    // Clear the pending failsafe so it cannot fire later and re-trigger the
    // un-hide path for a healthy page.
    if (typeof window.clearTimeout === "function" && globalScope.__ffHydrateTimer) {
      window.clearTimeout(globalScope.__ffHydrateTimer);
      globalScope.__ffHydrateTimer = undefined;
    }
  }, []);

  return null;
}
