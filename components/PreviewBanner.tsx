"use client";

import { useState } from "react";
import { isPreviewEnv } from "@/lib/env";
import { backendEnabled } from "@/lib/supabase";

// Always-visible development banner for preview deployments (and the keyless
// demo). Deliberately not dismissible-forever: it can be collapsed to a dot
// for the session, but returns on reload — testers must never mistake a
// synthetic environment for a real product with real data.

export default function PreviewBanner() {
  const [collapsed, setCollapsed] = useState(false);
  const demo = !backendEnabled;
  if (!isPreviewEnv && !demo) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Synthetic data environment"
        aria-label="Show environment banner"
        className="fixed bottom-2 left-2 z-[60] h-3.5 w-3.5 rounded-full bg-amber-500 ring-2 ring-paper"
      />
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 bg-amber-500/95 px-3 py-1 text-center text-[11px] font-semibold text-black backdrop-blur">
      <span>
        {isPreviewEnv ? "PREVIEW" : "DEMO"} — synthetic data only. Accounts, trips and quotes
        are test fixtures, not real people.
      </span>
      <button
        onClick={() => setCollapsed(true)}
        aria-label="Collapse banner"
        className="rounded-full px-1.5 font-bold hover:bg-black/10"
      >
        –
      </button>
    </div>
  );
}
