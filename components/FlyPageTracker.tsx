"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Fires the local, id-only page-view event for a /fly country page. Server
// pages can't touch localStorage, so the event lives in this tiny client leaf.
export default function FlyPageTracker({ countryCode }: { countryCode: string }) {
  useEffect(() => {
    track("fly_page_view", { countryCode });
  }, [countryCode]);
  return null;
}
