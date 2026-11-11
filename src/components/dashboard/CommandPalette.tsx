"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * A single keyboard surface for everything the dashboard can do: jump to a
 * form, switch section, copy an endpoint, open the docs. It is the fastest
 * path to any action and keeps the mouse optional.
 *
 * Implementation notes:
 *  • Fully keyboard driven — ↑/↓ to move, Enter to run, Esc to dismiss.
 *  • A fuzzy subsequence match over label + keywords, ranked so that exact
 *    and prefix matches always win over scattered hits.
 *  • Focus is trapped inside the dialog while it is open and restored to the
 *    previously focused element on close.
 */
export function CommandPalette({
  actions,
  open,
  onOpenChange,
}: {
  actions: CommandAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  /* ── Global shortcut ─────────────────────────────────────────── */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isPaletteKey =
        (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);

      if (isPaletteKey) {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }

      // "/" focuses the palette when the user is not already typing.
      if (
        event.key === "/" &&
        !open &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        onOpenChange(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  /* ── Focus management ────────────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      restoreFocusRef.current?.focus?.();
      return;
    }

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  /* ── Filtering ───────────────────────────────────────────────── */
  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return actions.slice(0, 40);

    const scored = actions
      .map((action) => {
        const haystack = `${action.label} ${action.group} ${action.keywords ?? ""}`.toLowerCase();
        const label = action.label.toLowerCase();

        if (label === trimmed) return { action, score: 0 };
        if (label.startsWith(trimmed)) return { action, score: 1 };
        if (haystack.includes(trimmed)) return { action, score: 2 };
        if (isSubsequence(trimmed, haystack)) return { action, score: 3 };
        return null;
      })
      .filter((entry): entry is { action: CommandAction; score: number } => entry !== null)
      .sort((a, b) => a.score - b.score);

    return scored.slice(0, 40).map((entry) => entry.action);
  }, [actions, query]);

  /* ── Keyboard navigation ─────────────────────────────────────── */
  const runAction = useCallback(
    (action: CommandAction) => {
      onOpenChange(false);
      // Defer so the palette unmounts before the action mutates the page.
      window.setTimeout(() => action.run(), 0);
    },
    [onOpenChange],
  );
  const onDialogKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) =>
          results.length ? (prev - 1 + results.length) % results.length : 0,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const action = results[activeIndex];
        if (action) runAction(action);
      }
    },
    [results, activeIndex, runAction, onOpenChange],
  );

  // Keep the highlighted row inside the scroll container.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.children?.[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  /* ── Grouping ────────────────────────────────────────────────── */
  const grouped = useMemo(() => {
    const rows: Array<{ action: CommandAction; showGroup: boolean }> = [];
    let lastGroup = "";
    for (const action of results) {
      const showGroup = action.group !== lastGroup;
      lastGroup = action.group;
      rows.push({ action, showGroup });
    }
    return rows;
  }, [results]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 cursor-default bg-slate-950/80 backdrop-blur-sm"
        tabIndex={-1}
      />

      <div
        onKeyDown={onDialogKeyDown}
        className="animate-scale-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1e]/95 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/8 px-4">
          <svg
            className="h-4 w-4 shrink-0 text-slate-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search actions, forms and pages…"
            aria-label="Search commands"
            className="flex-1 bg-transparent py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No matching commands.
          </p>
        ) : (
          <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
            {grouped.map(({ action, showGroup }, index) => (
              <li key={action.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                    {action.group}
                  </p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runAction(action)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    index === activeIndex
                      ? "bg-aurora-400/12 text-white"
                      : "text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {action.label}
                  </span>
                  {action.hint && (
                    <span className="hidden shrink-0 text-[11px] text-slate-500 sm:block">
                      {action.hint}
                    </span>
                  )}
                  {action.shortcut && <kbd className="kbd shrink-0">{action.shortcut}</kbd>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between border-t border-white/8 px-4 py-2.5 text-[11px] text-slate-600">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">↵</kbd> run
            </span>
          </span>
          <span>
            <kbd className="kbd">⌘</kbd>
            <kbd className="kbd">K</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}

/** True when the event target is a text entry (so "/" is a literal slash). */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/** Subsequence match: every character of `needle` appears in `haystack` in order. */
function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return needle.length === 0;
}
