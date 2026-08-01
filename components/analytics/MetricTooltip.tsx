"use client";
import { HelpCircle } from "lucide-react";

/**
 * Small "?"-icon tooltip placed next to a metric's title, showing its
 * definition in Vietnamese on hover/focus. No tooltip primitive exists
 * elsewhere in this codebase (only Recharts' own chart tooltips), so this is
 * a minimal, dependency-free implementation — CSS-only reveal via
 * group-hover/group-focus-within, keyboard accessible.
 */
export default function MetricTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground focus:text-foreground outline-none"
        aria-label="Giải thích chỉ số"
      >
        <HelpCircle size={14} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-card p-2.5 text-xs font-normal text-foreground shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
      >
        {text}
      </span>
    </span>
  );
}
