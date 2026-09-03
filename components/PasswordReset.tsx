"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import WaypointLogo from "./Logo";

// The second half of a password reset, and the half that did not exist.
//
// "Forgot password?" used to send a magic SIGN-IN link: it let you back in,
// but there was nowhere to choose a new password, so the forgotten one stayed
// forgotten and the next visit hit the same wall. Supabase signs a recovery
// link in as a PASSWORD_RECOVERY event; the store raises a flag for it and
// this is what that flag shows.
//
// It renders above everything, signed in or not, because a recovery link
// creates a real session — so without this the app would simply open as
// normal and the reset would silently do nothing.
/** `onDone` overrides where "finished" goes: the store flag is right when
 *  this renders as an overlay on the main page, but the /reset landing page
 *  wants a real navigation home instead. */
export default function PasswordReset({ onDone }: { onDone?: () => void }) {
  const clearFlag = useStore((s) => s.endPasswordRecovery);
  const clear = onDone ?? clearFlag;
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strong = password.length >= 8;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!strong) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase!.auth.updateUser({ password });
      if (err) {
        // The usual way to land here: the link was already used, or sat in
        // the inbox past its lifetime. Supabase phrases that as a missing
        // session, which reads like the app's fault rather than the link's.
        setError(
          /session|expired|invalid|not found/i.test(err.message)
            ? "This reset link has expired or was already used — they're single-use. Request a fresh one from the sign-in screen."
            : err.message
        );
        return;
      }
      setDone(true);
      // Let them read the confirmation before the app appears underneath.
      setTimeout(clear, 1400);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-paper px-5">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center drop-shadow-lg">
          <WaypointLogo size={56} />
        </div>
        {done ? (
          <>
            <p className="mt-5 font-display text-2xl">Password updated</p>
            <p className="mt-2 text-sm text-ink-3">You&apos;re signed in.</p>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-2xl">Choose a new password</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              At least 8 characters. You&apos;ll stay signed in on this device.
            </p>
            <form onSubmit={save} className="mt-6 space-y-3">
              <input
                type="password"
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-full bg-paper-2 px-5 py-3 text-[15px] outline-none ring-line placeholder:text-ink-3 focus:ring-2 focus:ring-ink/15"
              />
              <button
                type="submit"
                disabled={!strong || busy}
                className="w-full rounded-full bg-accent py-3 text-[15px] font-semibold text-paper transition-opacity disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save password"}
              </button>
            </form>
            <button
              onClick={clear}
              className="mt-4 text-xs text-ink-3 underline-offset-2 hover:underline"
            >
              Skip for now
            </button>
          </>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-accent/10 px-4 py-2.5 text-xs text-accent">{error}</p>
        )}
      </div>
    </div>
  );
}
