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
import { ACTIVITY_LABELS, type Pin } from "@/lib/types";
import TopFive from "./TopFive";
import { CreatorBadge, formatFollowers } from "./CreatorsPanel";

type Tab = "top" | "pins" | "saved";

export default function ProfileView({ handle }: { handle: string }) {
  const router = useRouter();
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const friendships = useStore((s) => s.friendships);
  const topPlaces = useStore((s) => s.topPlaces);
  const viewerId = useStore((s) => s.viewerId);
  const follows = useStore((s) => s.follows);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const savedPinIds = useStore((s) => s.savedPinIds);
  const showOnly = useStore((s) => s.showOnly);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);
  const [tab, setTab] = useState<Tab>("top");

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
  const isFollowing = follows.has(user.id);
  const savedPins = pins.filter((p) => savedPinIds.has(p.id));
  const cover = top[0]?.pin.photos[0]?.url ?? myPins[0]?.photos[0]?.url;

  function viewOnMap() {
    showOnly(user!.id);
    const first = top[0]?.pin ?? myPins[0];
    router.push("/");
    if (first) setTimeout(() => requestFlyTo(first.lng, first.lat, 4), 60);
  }

  function openPin(pinId: string, lng: number, lat: number) {
    selectPin(pinId);
    router.push("/");
    setTimeout(() => requestFlyTo(lng, lat, 8), 60);
  }

  return (
    <div className="min-h-screen bg-paper pb-20">
      {/* Cover — purely scenic; nothing overlaps it, so nothing gets cut. */}
      <div className="relative h-44 w-full overflow-hidden sm:h-60">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-paper-2" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-ink/10" />
        <Link
          href="/"
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-paper/85 px-3 py-1.5 text-sm shadow-float backdrop-blur"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Map
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        {/* Identity — sits fully below the cover. */}
        <div className="flex items-center gap-4 pt-6 sm:gap-5">
          <img
            src={user.avatarUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full object-cover sm:h-24 sm:w-24"
            style={{ boxShadow: `0 0 0 3px var(--color-paper), 0 0 0 6px ${user.color}` }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-3xl leading-none sm:text-4xl">
                {user.displayName}
              </h1>
              {user.isCreator && <CreatorBadge />}
            </div>
            <p className="mt-1.5 text-sm text-ink-3">
              @{user.handle} · {user.homeCity}
            </p>
            {user.isCreator && user.activities && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.activities.map((a) => (
                  <span key={a} className="rounded-full bg-paper-2 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-2">
                    {ACTIVITY_LABELS[a]}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">{user.bio}</p>

        {/* Stats */}
        <div className="mt-5 flex items-center gap-7 border-y border-line py-4">
          <Stat n={myPins.length} label="pins" />
          <Stat n={countries} label="countries" />
          {user.isCreator ? (
            <Stat n={user.followerCount ?? 0} label="followers" format />
          ) : (
            <Stat n={friendCount} label="friends" />
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={viewOnMap}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper"
          >
            View {isMe ? "my" : "their"} map
          </button>
          {!isMe &&
            (user.isCreator ? (
              <button
                onClick={() => toggleFollow(user.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
                  isFollowing ? "bg-paper-2 text-ink-2 ring-1 ring-line" : "bg-accent text-paper"
                }`}
              >
                {isFollowing ? "Following ✓" : "Follow"}
              </button>
            ) : (
              <button
                className={`rounded-full px-5 py-2.5 text-sm font-semibold ${
                  isFriend ? "bg-paper-2 text-ink-2 ring-1 ring-line" : "bg-accent text-paper"
                }`}
              >
                {isFriend ? "Friends ✓" : "Add friend"}
              </button>
            ))}
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1.5 rounded-full bg-paper-2 p-1">
          <TabButton active={tab === "top"} onClick={() => setTab("top")}>Top 5</TabButton>
          <TabButton active={tab === "pins"} onClick={() => setTab("pins")}>
            All pins · {myPins.length}
          </TabButton>
          {isMe && (
            <TabButton active={tab === "saved"} onClick={() => setTab("saved")}>
              Saved · {savedPins.length}
            </TabButton>
          )}
        </div>

        {/* Tab content */}
        {tab === "top" && (
          <section className="mt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl">Top 5 destinations</h2>
              {isMe && top.length > 1 && <span className="text-xs text-ink-3">drag to rank</span>}
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
        )}

        {tab === "pins" && (
          <section className="mt-6">
            <PinGrid pins={myPins} onOpen={openPin} />
          </section>
        )}

        {tab === "saved" && isMe && (
          <section className="mt-6">
            {savedPins.length === 0 ? (
              <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
                <div className="text-2xl">🔖</div>
                <p className="mt-2 font-display text-lg">Nothing saved yet</p>
                <p className="mt-1 text-sm text-ink-3">
                  Tap “Save” on any pin to keep it here for later trips.
                </p>
              </div>
            ) : (
              <PinGrid pins={savedPins} onOpen={openPin} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function PinGrid({
  pins,
  onOpen,
}: {
  pins: Pin[];
  onOpen: (pinId: string, lng: number, lat: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {pins.map((p) => (
        <button
          key={p.id}
          onClick={() => onOpen(p.id, p.lng, p.lat)}
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
              <div className="truncate text-[10px] text-paper/70">
                {formatDates(p.startedOn, p.endedOn)}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-paper text-ink shadow-float" : "text-ink-3 hover:text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ n, label, format }: { n: number; label: string; format?: boolean }) {
  return (
    <div>
      <div className="font-display text-2xl leading-none">
        {format ? formatFollowers(n) : n}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-ink-3">{label}</div>
    </div>
  );
}
