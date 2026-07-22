"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  countryCount,
  pinsForUser,
  topPlacesFor,
  acceptedFriendIds,
} from "@/lib/data";
import { formatDates } from "@/lib/format";
import TopFive from "./TopFive";

export default function ProfileView({ handle }: { handle: string }) {
  const router = useRouter();
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const friendships = useStore((s) => s.friendships);
  const topPlaces = useStore((s) => s.topPlaces);
  const viewerId = useStore((s) => s.viewerId);
  const showOnly = useStore((s) => s.showOnly);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);

  const user = users.find((u) => u.handle === handle);
  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <div>
          <p className="font-display text-2xl">No traveler @{handle}</p>
          <Link href="/" className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-sm text-paper">
            Back to the map
          </Link>
        </div>
      </div>
    );
  }

  const isMe = user.id === viewerId;
  const myPins = pinsForUser(pins, user.id);
  const countries = countryCount(pins, user.id);
  const top = topPlacesFor(topPlaces, pins, user.id);
  const friendCount = acceptedFriendIds(friendships, user.id).size;
  const isFriend = acceptedFriendIds(friendships, viewerId).has(user.id);
  const cover = top[0]?.pin.photos[0]?.url ?? myPins[0]?.photos[0]?.url;

  function viewOnMap() {
    showOnly(user!.id);
    const first = top[0]?.pin ?? myPins[0];
    router.push("/");
    if (first) setTimeout(() => requestFlyTo(first.lng, first.lat, 4), 60);
  }

  function openPin(pinId: string, lng: number, lat: number) {
    showOnly(user!.id);
    selectPin(pinId);
    router.push("/");
    setTimeout(() => requestFlyTo(lng, lat, 8), 60);
  }

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Cover */}
      <div className="relative h-56 w-full overflow-hidden sm:h-72">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-paper-2" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
        <Link
          href="/"
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-paper/85 px-3 py-1.5 text-sm shadow-float backdrop-blur"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Map
        </Link>
      </div>

      {/* Identity */}
      <div className="mx-auto -mt-12 max-w-2xl px-5">
        <div className="flex items-end gap-4">
          <img
            src={user.avatarUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover ring-4 ring-paper"
            style={{ boxShadow: `0 0 0 6px ${user.color}` }}
          />
          <div className="pb-2">
            <h1 className="font-display text-3xl leading-none">{user.displayName}</h1>
            <p className="mt-1 text-sm text-ink-3">@{user.handle} · {user.homeCity}</p>
          </div>
        </div>

        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-2">{user.bio}</p>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6">
          <Stat n={myPins.length} label="pins" />
          <Stat n={countries} label="countries" />
          <Stat n={friendCount} label="friends" />
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={viewOnMap}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
          >
            View {isMe ? "my" : "their"} map
          </button>
          {!isMe && (
            <button
              className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
                isFriend ? "bg-paper-2 text-ink-2" : "bg-accent text-paper"
              }`}
            >
              {isFriend ? "Friends ✓" : "Add friend"}
            </button>
          )}
        </div>

        {/* Top 5 — the centerpiece */}
        <section className="mt-9">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl">Top 5 destinations</h2>
            {isMe && top.length > 1 && (
              <span className="text-xs text-ink-3">drag to rank</span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-3">
            {isMe ? "Your" : `${user.displayName.split(" ")[0]}'s`} places, ranked. Every one is a real pin.
          </p>
          <div className="mt-4">
            <TopFive
              userId={user.id}
              editable={isMe}
              onOpen={(pinId, lng, lat) => openPin(pinId, lng, lat)}
            />
          </div>
        </section>

        {/* All pins */}
        <section className="mt-10">
          <h2 className="font-display text-2xl">All pins</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {myPins.map((p) => (
              <button
                key={p.id}
                onClick={() => openPin(p.id, p.lng, p.lat)}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-paper-2 text-left"
              >
                {p.photos[0] && (
                  <img
                    src={p.photos[0].url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent opacity-90" />
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="truncate text-xs font-medium text-paper">{p.placeName}</div>
                  {(p.startedOn || p.endedOn) && (
                    <div className="truncate text-[10px] text-paper/70">{formatDates(p.startedOn, p.endedOn)}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl leading-none">{n}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}
