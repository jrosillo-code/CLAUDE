"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import LoginScreen from "./LoginScreen";

// Wraps a page: restores the persisted session, shows the login screen when
// signed out, renders children when signed in.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useStore((s) => s.session);
  const ready = useStore((s) => s.sessionReady);
  const hydrate = useStore((s) => s.hydrateSession);

  useEffect(() => {
    if (!ready) hydrate();
  }, [ready, hydrate]);

  if (!ready) {
    // Splash while the session is read (one frame, avoids a login flash).
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="animate-pulse text-accent">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="m15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3z" fill="currentColor" />
        </svg>
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}
