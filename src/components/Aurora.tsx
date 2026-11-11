export interface AuroraProps {
  /** Optional class on the wrapper. */
  className?: string;
  /** Intensity of the blobs (0–1). */
  intensity?: number;
}

/**
 * Animated aurora backdrop.
 *
 * Pure CSS — three blurred gradient blobs drifting on long, offset loops plus
 * a masked grid. Zero JavaScript, zero layout thrash: the animation only ever
 * touches `transform`, so it stays on the compositor.
 *
 * The `prefers-reduced-motion` block in `globals.css` freezes the blobs.
 */
export function Aurora({ className = "", intensity = 1 }: AuroraProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="aurora-blob"
        style={{
          top: "-18%",
          left: "-10%",
          width: "46rem",
          height: "46rem",
          opacity: 0.42 * intensity,
          background:
            "radial-gradient(circle at 40% 40%, rgba(34,211,238,0.85), rgba(34,211,238,0) 62%)",
          ["--blob-duration" as string]: "22s",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          top: "8%",
          right: "-14%",
          width: "40rem",
          height: "40rem",
          opacity: 0.34 * intensity,
          background:
            "radial-gradient(circle at 55% 45%, rgba(129,140,248,0.8), rgba(129,140,248,0) 64%)",
          ["--blob-duration" as string]: "28s",
          animationDelay: "-7s",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          bottom: "-22%",
          left: "28%",
          width: "36rem",
          height: "36rem",
          opacity: 0.26 * intensity,
          background:
            "radial-gradient(circle at 50% 50%, rgba(52,211,153,0.65), rgba(52,211,153,0) 66%)",
          ["--blob-duration" as string]: "25s",
          animationDelay: "-14s",
        }}
      />

      {/* Grid + horizon fade */}
      <div className="grid-mask absolute inset-0 opacity-70" />
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background: "linear-gradient(to top, rgba(5,7,15,0.95), transparent)",
        }}
      />
    </div>
  );
}
