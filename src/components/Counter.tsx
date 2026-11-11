"use client";

import { useEffect, useRef, useState } from "react";
import { DURATION, prefersReducedMotion } from "@/lib/motion";

export interface CounterProps {
  /** Final value to count towards. */
  value: number;
  /** Prefix rendered before the number (e.g. "$", "~"). */
  prefix?: string;
  /** Suffix rendered after the number (e.g. "+", "%", "k"). */
  suffix?: string;
  /** Decimal places (use with `decimals`). */
  decimals?: number;
  /** Duration of the count-up in milliseconds. */
  duration?: number;
  /** Locale for number formatting. */
  locale?: string;
  /** Start counting only once the element scrolls into view. */
  startOnView?: boolean;
  className?: string;
}

/**
 * Animated number counter.
 *
 * Uses `requestAnimationFrame` with an ease-out quart curve so the number
 * decelerates into place instead of ticking linearly. Under
 * `prefers-reduced-motion` the final value renders immediately.
 */
export function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = DURATION.deliberate,
  locale = "en-US",
  startOnView = true,
  className = "",
}: CounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      setStarted(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    if (!startOnView) {
      setStarted(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStarted(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [startOnView, value]);

  useEffect(() => {
    if (!started) return;

    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;
    const delta = value - from;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(from + delta * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [started, value, duration]);

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(display);

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${formatted}${suffix}`}>
      <span aria-hidden="true">
        {prefix}
        {formatted}
        {suffix}
      </span>
    </span>
  );
}
