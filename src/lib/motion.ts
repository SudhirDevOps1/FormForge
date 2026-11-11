/**
 * FormForge motion engine.
 *
 * A single source of truth for every duration, easing, and stagger step used in
 * the product. Components never hard-code timing values — they pull from here
 * so the whole app moves with one consistent rhythm.
 *
 * The `MOTION_REDUCED` contract is exported so server and client code agree on
 * what "respects reduced motion" means:
 *
 *   - Durations collapse to ~0ms (never `auto`, which can break `transitionend`).
 *   - `useReducedMotion()` returns `true` when the user asked for less motion,
 *     and components then render their *final* state instead of animating.
 *   - Transforms that would move content (slide / scale / parallax) are dropped;
 *     opacity-only cross-fades are kept, because they do not trigger vestibular
 *     responses the way large motion does.
 */

/* ------------------------------------------------------------------ */
/* Durations (milliseconds)                                            */
/* ------------------------------------------------------------------ */

export const DURATION = {
  /** Press feedback, tiny opacity/scale nudges. */
  instant: 120,
  /** Micro-interactions: hover, focus ring, chip toggles. */
  fast: 200,
  /** Default UI transition: dropdowns, tooltips, accordion. */
  base: 320,
  /** Page-level entrance: cards, panels, list items. */
  slow: 520,
  /** Hero choreography and large reveals. */
  deliberate: 780,
  /** Ambient, always-running loops (aurora drift, marquee). */
  ambient: 18_000,
} as const;

/* ------------------------------------------------------------------ */
/* Easings                                                            */
/* ------------------------------------------------------------------ */

export const EASE = {
  /** Decelerating — for elements entering the viewport. */
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Accelerating — for elements leaving the viewport. */
  in: "cubic-bezier(0.7, 0, 0.84, 0)",
  /** Symmetric — for elements moving within the viewport. */
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  /** Springy overshoot — for playful taps and toggles. */
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Linear — for continuous ambient loops that must not pulse. */
  linear: "linear",
} as const;

/* ------------------------------------------------------------------ */
/* Stagger                                                             */
/* ------------------------------------------------------------------ */

/**
 * Stagger step in milliseconds. Used with `Reveal` / `Counter` to produce
 * the cascading entrance that makes a grid feel choreographed instead of
 * simply appearing all at once.
 */
export const STAGGER = {
  tight: 40,
  base: 70,
  loose: 110,
} as const;

/* ------------------------------------------------------------------ */
/* Motion payloads                                                     */
/* ------------------------------------------------------------------ */

export type RevealDirection = "up" | "down" | "left" | "right" | "none";

export interface RevealConfig {
  /** Travel distance in pixels. Ignored when `direction` is `none`. */
  distance: number;
  direction: RevealDirection;
  duration: number;
  delay: number;
  easing: string;
}

/** Default reveal: 18px rise, `slow` duration, no delay. */
export const REVEAL_DEFAULT: RevealConfig = {
  distance: 18,
  direction: "up",
  duration: DURATION.slow,
  delay: 0,
  easing: EASE.out,
};

/**
 * Build a reveal transform for a direction. `none` yields no transform at all
 * so the element only fades — used under reduced-motion for large surfaces.
 */
export function revealTransform(direction: RevealDirection, distance: number): string {
  switch (direction) {
    case "up":
      return `translate3d(0, ${distance}px, 0)`;
    case "down":
      return `translate3d(0, -${distance}px, 0)`;
    case "left":
      return `translate3d(${distance}px, 0, 0)`;
    case "right":
      return `translate3d(-${distance}px, 0, 0)`;
    default:
      return "none";
  }
}

/* ------------------------------------------------------------------ */
/* Reduced motion                                                     */
/* ------------------------------------------------------------------ */

/** Duration to use when the user prefers reduced motion. */
export const REDUCED_DURATION = 1;

/**
 * True when the runtime environment reports a reduced-motion preference.
 *
 * Safe to call during server rendering: returns `false` there because the
 * server cannot know the user's preference, and the client corrects it on
 * hydration. Always pair with a CSS fallback (see `globals.css`) so the
 * no-JS path is also respected.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Resolve a duration against the reduced-motion preference.
 * Ambient loops return `null` so callers can skip the animation entirely
 * rather than running a 18-second loop at 1ms.
 */
export function resolveDuration(duration: number, reduced = prefersReducedMotion()): number | null {
  if (reduced) {
    return duration >= DURATION.ambient ? null : REDUCED_DURATION;
  }
  return duration;
}

/** Stagger helper: `stagger(3, STAGGER.base)` → 210ms. */
export function stagger(index: number, step: number = STAGGER.base): number {
  return Math.max(0, index) * step;
}

/* ------------------------------------------------------------------ */
/* Spring helper (physics-lite, no dependency)                          */
/* ------------------------------------------------------------------ */

export interface SpringOptions {
  stiffness?: number;
  damping?: number;
  mass?: number;
  precision?: number;
}

/**
 * Critically-damped spring integrator, used by the magnetic pointer wrapper.
 * Returns a function that advances the spring by one frame and reports the
 * current value and velocity.
 */
export function createSpring(options: SpringOptions = {}) {
  const stiffness = options.stiffness ?? 170;
  const damping = options.damping ?? 26;
  const mass = options.mass ?? 1;
  const precision = options.precision ?? 0.01;

  let position = 0;
  let velocity = 0;
  let target = 0;

  function step(): { value: number; velocity: number; settled: boolean } {
    const displacement = position - target;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;

    velocity += acceleration;
    position += velocity;

    const settled =
      Math.abs(displacement) < precision && Math.abs(velocity) < precision;

    if (settled) {
      position = target;
      velocity = 0;
    }

    return { value: position, velocity, settled };
  }

  return {
    setTarget(next: number) {
      target = next;
    },
    nudge(delta: number) {
      velocity += delta;
    },
    get position() {
      return position;
    },
    step,
  };
}
