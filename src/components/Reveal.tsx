"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  DURATION,
  REVEAL_DEFAULT,
  type RevealDirection,
} from "@/lib/motion";

export interface RevealProps {
  children: ReactNode;
  /** Travel direction for the entrance. `none` fades only. */
  direction?: RevealDirection;
  /** Delay in milliseconds — use for staggered grids. */
  delay?: number;
  /** Distance in pixels travelled during the entrance. */
  distance?: number;
  /** Duration in milliseconds. */
  duration?: number;
  /** Render as a different element (e.g. `section`, `li`). */
  as?: ElementType;
  className?: string;
  /** Fraction of the element that must be visible before revealing. */
  threshold?: number;
  /** Replay the animation every time the element re-enters the viewport. */
  repeat?: boolean;
}

/**
 * Scroll-triggered entrance animation.
 *
 * Design notes:
 *  - Uses a single shared `IntersectionObserver` for every instance on the
 *    page so 40 animated cards cost one observer, not 40.
 *  - Falls back to "immediately visible" when `IntersectionObserver` is
 *    unavailable or the user prefers reduced motion — content is never hidden.
 *  - The hidden state lives in CSS (`[data-reveal]`), so a JavaScript failure
 *    degrades to fully-visible content rather than a blank page.
 */
export function Reveal({
  children,
  direction = REVEAL_DEFAULT.direction,
  delay = REVEAL_DEFAULT.delay,
  distance = REVEAL_DEFAULT.distance,
  duration = REVEAL_DEFAULT.duration,
  as: Tag = "div",
  className = "",
  threshold = 0.15,
  repeat = false,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduced) {
      setRevealed(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            if (!repeat) observer.unobserve(entry.target);
          } else if (repeat) {
            setRevealed(false);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, repeat, threshold]);

  const style: Record<string, string> = {
    ["--reveal-delay" as string]: `${delay}ms`,
    ["--reveal-distance" as string]: `${distance}px`,
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: REVEAL_DEFAULT.easing,
  };

  // The transform itself lives in CSS so the cascade can settle it. Setting
  // it inline here would beat `[data-revealed="true"] { transform: none }`.
  if (reduced) {
    style.opacity = "1";
  }

  return (
    <Tag
      ref={ref as never}
      className={className}
      data-reveal={reduced ? "none" : direction}
      data-revealed={revealed ? "true" : "false"}
      style={style}
    >
      {children}
    </Tag>
  );
}

/**
 * Convenience wrapper for grid children: applies a direction, a distance and
 * an automatic stagger delay derived from the child's index.
 */
export function RevealGroup({
  children,
  className = "",
  direction = "up",
  step = 70,
  baseDelay = 0,
  distance = 18,
}: {
  children: ReactNode[];
  className?: string;
  direction?: RevealDirection;
  step?: number;
  baseDelay?: number;
  distance?: number;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <>
      {items.map((child, index) => (
        <Reveal
          key={index}
          direction={direction}
          delay={baseDelay + index * step}
          distance={distance}
          className={className}
        >
          {child}
        </Reveal>
      ))}
    </>
  );
}

export const REVEAL_DURATIONS = DURATION;
