"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createSpring, prefersReducedMotion } from "@/lib/motion";

export interface MagneticProps {
  children: ReactNode;
  /** How far the element may drift toward the cursor, in pixels. */
  strength?: number;
  className?: string;
}

/**
 * Pointer-reactive "magnetic" wrapper.
 *
 * The child follows the cursor with a critically-damped spring, which feels
 * organic rather than jittery. Disabled entirely under
 * `prefers-reduced-motion` and on coarse pointers (touch), where there is no
 * cursor to follow.
 */
export function Magnetic({ children, strength = 12, className = "" }: MagneticProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const springX = useRef(createSpring({ stiffness: 190, damping: 22 }));
  const springY = useRef(createSpring({ stiffness: 190, damping: 22 }));
  const rafRef = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    setEnabled(!coarse && !prefersReducedMotion());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    let running = true;

    const loop = () => {
      const x = springX.current.step();
      const y = springY.current.step();
      node.style.transform = `translate3d(${x.value.toFixed(2)}px, ${y.value.toFixed(2)}px, 0)`;
      if (running && !(x.settled && y.settled)) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (event.clientX - centerX) / (rect.width / 2);
      const dy = (event.clientY - centerY) / (rect.height / 2);
      springX.current.setTarget(Math.max(-1, Math.min(1, dx)) * strength);
      springY.current.setTarget(Math.max(-1, Math.min(1, dy)) * strength);
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const onLeave = () => {
      springX.current.setTarget(0);
      springY.current.setTarget(0);
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    node.addEventListener("pointerleave", onLeave);

    return () => {
      running = false;
      window.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, strength]);

  return (
    <span
      ref={ref}
      className={`inline-block will-change-transform ${className}`}
      style={{ transform: "translate3d(0,0,0)" }}
    >
      {children}
    </span>
  );
}
