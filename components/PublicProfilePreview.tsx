"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WaypointLogo from "./Logo";
import { supabase, backendEnabled } from "@/lib/supabase";
import { users as seedUsers, pins as seedPins } from "@/lib/seed";
import { useOpenLogin } from "./AuthGate";

// What a visitor without an account sees at /u/{handle}: the person, how far
// they have been, and the names of their public places — never a private or
// friends-only pin, never a photo (photos live in the private bucket and are
// only signed for people who may see the pin). Enough to decide whether to
// join; the map itself waits behind the sign-in.

export interface ProfilePreview {
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  homeCity: string;
  color: string;
  publicPins: number;
  countries: number;
  recent: { placeName: string; countryCode: string }[];
}

export function useProfilePreview(handle: string): { state: "loading" | "ready" | "missing" | "offline"; profile: ProfilePreview | null } {
  const [state, setState] = useState<"loading" | "ready" | "missing" | "offline">("loading");
  const [profile, setProfile] = useState<ProfilePreview | null>(null);
  useEffect(() => {
    let alive = true;
    const h = handle.toLowerCase();
    (async () => {
      if (!backendEnabled) {
        const u = seedUsers.find((x) => x.handle.toLowerCase() === h);
        if (!u) return alive && setState("missing");
        const mine = seedPins.filter((p) => p.userId === u.id && p.visibility === "public");
        setProfile({
          handle: u.handle, displayName: u.displayName, avatarUrl: u.avatarUrl, bio: u.bio ?? "", homeCity: u.homeCity ?? "", color: u.color,
          publicPins: mine.length,
          countries: new Set(mine.map((p) => p.countryCode).filter(Boolean)).size,
          recent: mine.slice(-5).reverse().map((p) => ({ placeName: p.placeName, countryCode: p.countryCode })),
        });
        return alive && setState("ready");
      }
      try {
        const { data: u, error } = await supabase!.from("users").select("id, handle, display_name, avatar_url, bio, home_city, color").eq("handle", h).maybeSingle();
        if (error) throw error;
        if (!u) return alive && setState("missing");
        // Only public pins come back for a visitor: row-level security decides.
        const { data: rows } = await supabase!.from("pins").select("place_name, country_code, created_at").eq("user_id", u.id).order("created_at", { ascending: false }).limit(200);
        const pins = rows ?? [];
        if (!alive) return;
        setProfile({
          handle: u.handle, displayName: u.display_name, avatarUrl: u.avatar_url || `https://picsum.photos/seed/${u.handle}/200/200`, bio: u.bio ?? "", homeCity: u.home_city ?? "", color: u.color || "#c65d3b",
          publicPins: pins.length,
          countries: new Set(pins.map((p) => p.country_code).filter(Boolean)).size,
          recent: pins.slice(0, 5).map((p) => ({ placeName: p.place_name, countryCode: p.country_code ?? "" })),
        });
        setState("ready");
      } catch {
        if (alive) setState("offline");
      }
    })();
    return () => { alive = false; };
  }, [handle]);
  return { state, profile };
}

export default function PublicProfilePreview({ handle }: { handle: string }) {
  const { state, profile } = useProfilePreview(handle);
  const onJoin = useOpenLogin();
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5 py-10" data-testid="public-profile">
      <div className="w-full max-w-sm">
        <div className="mx-auto w-fit"><WaypointLogo size={36} /></div>
        {state === "loading" && <p className="mt-6 text-center text-sm text-ink-3">Finding @{handle}…</p>}
        {state === "missing" && (
          <div className="mt-6 text-center">
            <h1 className="font-display text-2xl">Nobody here yet</h1>
            <p className="mt-2 text-sm text-ink-2">There is no traveler called @{handle} on Waypoint.</p>
          </div>
        )}
        {state === "offline" && (
          <div className="mt-6 text-center">
            <h1 className="font-display text-2xl">Can&apos;t reach Waypoint right now</h1>
            <p className="mt-2 text-sm text-ink-2">Try again in a moment.</p>
          </div>
        )}
        {state === "ready" && profile && (
          <div className="mt-6 rounded-3xl bg-paper-2/60 p-6 text-center ring-1 ring-line">
            <img src={profile.avatarUrl} alt="" className="mx-auto h-20 w-20 rounded-full object-cover ring-4" style={{ ["--tw-ring-color" as string]: profile.color }} />
            <h1 className="mt-3 font-display text-2xl leading-tight">{profile.displayName}</h1>
            <p className="text-sm text-ink-3">@{profile.handle}{profile.homeCity ? ` · ${profile.homeCity}` : ""}</p>
            {profile.bio && <p className="mt-2 text-sm leading-relaxed text-ink-2">{profile.bio}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-paper p-3"><div className="font-display text-2xl">{profile.publicPins}</div><div className="text-[11px] uppercase tracking-wide text-ink-3">public places</div></div>
              <div className="rounded-2xl bg-paper p-3"><div className="font-display text-2xl">{profile.countries}</div><div className="text-[11px] uppercase tracking-wide text-ink-3">countries</div></div>
            </div>
            {profile.recent.length > 0 && (
              <ul className="mt-4 space-y-1 text-left text-sm">
                {profile.recent.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-ink-2"><span className="text-accent">●</span><span className="truncate">{p.placeName}{p.countryCode ? `, ${p.countryCode}` : ""}</span></li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-ink-3">Friends-only pins and photos stay hidden until you two are friends on Waypoint.</p>
            <button onClick={onJoin} className="mt-4 w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper" data-testid="preview-join">
              Join Waypoint to see the map
            </button>
            <Link href={`/join/${profile.handle}`} className="mt-2 block text-xs font-semibold text-accent">
              Join as {profile.displayName.split(" ")[0]}&apos;s friend →
            </Link>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-ink-3">
          <button onClick={onJoin} className="font-semibold text-ink-2">Already on Waypoint? Sign in</button>
        </p>
      </div>
    </main>
  );
}
