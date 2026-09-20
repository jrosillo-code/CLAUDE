"use client";

import { createContext, useContext, useEffect, useState } from "react";

// A signed-out fallback (the public profile preview) asks for the login
// screen through this, since a server page cannot hand a client component
// a callback.
const OpenLoginContext = createContext<() => void>(() => {});
export function useOpenLogin(): () => void {
  return useContext(OpenLoginContext);
}
import { useStore } from "@/lib/store";
import LoginScreen from "./LoginScreen";
import PasswordReset from "./PasswordReset";
import WaypointLogo from "./Logo";

// Wraps a page: restores the persisted session, shows the login screen when
// signed out, renders children when signed in.
export default function AuthGate({
  children,
  fallback,
}: {
  children: React.ReactNode;
  /** What a signed-out visitor sees instead of the login screen; it can
   *  open the login with useOpenLogin(). Pages without one show the login
   *  screen directly. */
  fallback?: React.ReactNode;
}) {
  const session = useStore((s) => s.session);
  const [wantLogin, setWantLogin] = useState(false);
  const ready = useStore((s) => s.sessionReady);
  const recovering = useStore((s) => s.passwordRecovery);
  const hydrate = useStore((s) => s.hydrateSession);
  // A splash that has been up for several seconds is no longer a splash, it
  // is an unanswered question. A cold Supabase project and a broken one look
  // identical from out here, and only one of them is worth waiting for — so
  // say which is likely rather than pulsing at someone indefinitely.
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!ready) hydrate();
  }, [ready, hydrate]);

  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, [ready]);

  if (!ready) {
    // Splash while the session is read (one frame, avoids a login flash).
    return (
      <div className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="text-center">
          <div className="mx-auto w-fit animate-pulse">
            <WaypointLogo size={44} />
          </div>
          {slow && (
            <p className="mx-auto mt-5 max-w-[260px] text-sm leading-relaxed text-ink-3">
              Still connecting… a Supabase project that has been idle can take a
              moment to wake up.
            </p>
          )}
        </div>
      </div>
    );
  }
  // Above both branches below: a recovery link creates a real session, so this
  // has to win over the app as well as over the login screen.
  if (recovering) return <PasswordReset />;
  if (!session) {
    if (fallback && !wantLogin) return <OpenLoginContext.Provider value={() => setWantLogin(true)}>{fallback}</OpenLoginContext.Provider>;
    return <LoginScreen />;
  }
  return <>{children}</>;
}
