"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import LoginScreen from "./LoginScreen";
import WaypointLogo from "./Logo";

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
        <div className="animate-pulse">
          <WaypointLogo size={44} />
        </div>
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}
