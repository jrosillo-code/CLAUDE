"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useProfilePreview } from "./PublicProfilePreview";
import WaypointLogo from "./Logo";

// /join/{handle}: the link a person texts a friend. Landing here remembers
// who invited you; the moment your account exists the friend request goes
// out by itself. Already signed in? The request goes out now.
export const INVITE_KEY = "wp-ref";

export default function InviteLanding({ handle }: { handle: string }) {
  const router = useRouter();
  const session = useStore((s) => s.session);
  const ready = useStore((s) => s.sessionReady);
  const hydrate = useStore((s) => s.hydrateSession);
  const applyPendingInvite = useStore((s) => s.applyPendingInvite);
  const { state, profile } = useProfilePreview(handle);

  useEffect(() => {
    if (!ready) hydrate();
  }, [ready, hydrate]);

  function join() {
    try {
      window.localStorage.setItem(INVITE_KEY, handle.toLowerCase());
    } catch {
      /* private mode: the request will not be automatic */
    }
    if (session) {
      applyPendingInvite();
      router.push(`/u/${handle}`);
    } else {
      router.push("/");
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5 py-10" data-testid="invite-landing">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto w-fit"><WaypointLogo size={36} /></div>
        {state === "loading" && <p className="mt-6 text-sm text-ink-3">One moment…</p>}
        {(state === "missing" || state === "offline") && (
          <p className="mt-6 text-sm text-ink-2">{state === "missing" ? `There is no @${handle} on Waypoint.` : "Can't reach Waypoint right now — try again in a moment."}</p>
        )}
        {state === "ready" && profile && (
          <>
            <img src={profile.avatarUrl} alt="" className="mx-auto mt-6 h-20 w-20 rounded-full object-cover ring-4" style={{ ["--tw-ring-color" as string]: profile.color }} />
            <h1 className="mt-4 font-display text-3xl leading-tight">{profile.displayName} wants you on their map</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Waypoint is a map of where your friends have really been — their pins, photos and honest notes, only for people they know.
              {profile.countries > 0 ? ` ${profile.displayName.split(" ")[0]} has pinned ${profile.countries} ${profile.countries === 1 ? "country" : "countries"} so far.` : ""}
            </p>
            <button onClick={join} className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper" data-testid="invite-join">
              {session ? `Add ${profile.displayName.split(" ")[0]} as a friend` : `Join and add ${profile.displayName.split(" ")[0]}`}
            </button>
            <p className="mt-3 text-xs text-ink-3">Free. Your own pins are private until you say otherwise.</p>
          </>
        )}
      </div>
    </main>
  );
}
