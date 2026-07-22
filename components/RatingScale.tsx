"use client";

import { useState } from "react";

// Your own 1–10 score for a place. The picker fills like a meter; tapping the
// current score again clears it. The badge is the compact read-only chip.

export function RatingScale({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? null : n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`Rate ${n} out of 10`}
            className={`h-7 w-5 rounded-md text-[10px] font-semibold transition-colors sm:w-6 ${
              shown !== null && n <= shown
                ? "bg-accent text-paper"
                : "bg-paper-2 text-ink-3 hover:bg-line"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-ink-2">
        {shown !== null ? `${shown}/10` : "—"}
      </span>
    </div>
  );
}

export function RatingBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="m12 2.7 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" />
      </svg>
      {value}/10
    </span>
  );
}
