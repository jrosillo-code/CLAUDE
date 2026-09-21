"use client";

import { useEffect } from "react";
import Link from "next/link";
import WaypointLogo from "@/components/Logo";
import { reportError } from "@/lib/monitor";

// A render error inside a page. Says what happened in plain words and offers
// the two things that usually fix it; the detail goes to the console, where
// a bug report can find it.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[waypoint] page error", error);
    reportError(error, { kind: "render", digest: error.digest });
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto w-fit"><WaypointLogo size={40} /></div>
        <h1 className="mt-5 font-display text-3xl">Something broke on this page</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Nothing you saved is lost. Try again, and if it happens twice, reload the app.
        </p>
        {error.digest && <p className="mt-2 text-[11px] text-ink-3">Reference {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper">Try again</button>
          <Link href="/" className="rounded-full px-5 py-2.5 text-sm font-medium text-ink-2 ring-1 ring-line hover:bg-paper-2">Back to the map</Link>
        </div>
      </div>
    </main>
  );
}
