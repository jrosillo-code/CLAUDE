"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { computeFunnel, type FunnelStage } from "@/lib/funnel";
import { readEvents } from "@/lib/analytics";

// /funnel — the user-test funnel, admin/facilitator view. Everything on this
// page is computed from THIS DEVICE's local event log (ids only, no text),
// so there is nothing here that could expose another user's data: it is the
// facilitator's own browser telling them what the participant did on it.
// Not linked from the app UI; open it directly during a test session.

export default function FunnelPage() {
  const viewerId = useStore((s) => s.viewerId);
  const hydrateSession = useStore((s) => s.hydrateSession);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    const refresh = () => {
      setStages(computeFunnel(viewerId));
      setEventCount(readEvents().length);
    };
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [viewerId]);

  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      {/* Reachable during user tests on the deployed URL, but this is an
          internal facilitator surface — it should never turn up in search. */}
      <meta name="robots" content="noindex,nofollow" />
      <h1 className="font-display text-3xl">User-test funnel</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">
        Computed from this device&apos;s local event log ({eventCount} events, ids only — no
        reflection text, questions, or names). Refreshes every 2s while a session runs.
      </p>

      <ol className="mt-6 space-y-3">
        {stages.map((s, i) => (
          <li key={s.label} className="rounded-2xl border border-line bg-paper-2/60 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">
                {i + 1}. {s.label}
              </span>
              <span className={`tnum text-sm font-bold ${s.reached ? "text-accent" : "text-ink-3"}`}>
                {s.count}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.round((s.count / max) * 100)}%` }}
              />
            </div>
            {!s.reached && (
              <div className="mt-1.5 text-[11px] text-ink-3">not reached yet</div>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs text-ink-3">
        Reset between participants: clear the <code className="font-mono">wp-events</code> key in
        localStorage (DevTools → Application), or use a fresh browser profile per participant.
      </p>
    </main>
  );
}
