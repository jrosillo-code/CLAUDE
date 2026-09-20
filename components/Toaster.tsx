"use client";

import { useEffect, useState } from "react";
import { dismissToast, subscribeToasts, type Toast } from "@/lib/toast";

// Renders whatever lib/toast has to say: bottom-centre, above the FABs,
// three lines at most. Errors stay longer and carry an optional action.
export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);
  if (!toasts.length) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4 max-sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-6"
      aria-live="polite"
      data-testid="toaster"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-[420px] items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm shadow-float backdrop-blur ${
            t.kind === "error" ? "bg-ink text-paper" : "bg-paper/95 text-ink ring-1 ring-line"
          }`}
        >
          <span className="leading-snug">{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action?.run();
                dismissToast(t.id);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${t.kind === "error" ? "bg-paper text-ink" : "bg-accent text-paper"}`}
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${t.kind === "error" ? "text-paper/70 hover:text-paper" : "text-ink-3 hover:text-ink"}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
