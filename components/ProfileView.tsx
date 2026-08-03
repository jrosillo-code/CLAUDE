"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  countryCount,
  coverUrl,
  pinsForUser,
  topPlacesFor,
  acceptedFriendIds,
  friendshipStatus,
} from "@/lib/data";
import { formatDates } from "@/lib/format";
import { ACTIVITY_LABELS, type Pin, type UserSocials } from "@/lib/types";
import TopFive from "./TopFive";
import { CreatorBadge, formatFollowers } from "./CreatorsPanel";
import SocialLinks, { SOCIAL_NETWORKS } from "./SocialLinks";
import RecapSheet from "./RecapSheet";
import ImportPanel from "./ImportPanel";
import GuidePanel from "./GuidePanel";
import ConstellationBackdrop from "./ConstellationBackdrop";
import PassportCard from "./PassportCard";
import { backendEnabled } from "@/lib/supabase";
import { version as APP_VERSION } from "../package.json";

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
  const signOut = useStore((s) => s.signOut);
  const showOnly = useStore((s) => s.showOnly);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);
  const sendFriendRequest = useStore((s) => s.sendFriendRequest);
  const respondFriendRequest = useStore((s) => s.respondFriendRequest);
  const cancelFriendRequest = useStore((s) => s.cancelFriendRequest);
  const setMySocials = useStore((s) => s.setMySocials);
  const setMyAvatar = useStore((s) => s.setMyAvatar);
  const setMyProfile = useStore((s) => s.setMyProfile);
  const [tab, setTab] = useState<Tab>("top");
  const [editingProfile, setEditingProfile] = useState(false);
  const [socialsDraft, setSocialsDraft] = useState<UserSocials>({});
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [statView, setStatView] = useState<"pins" | "countries" | "friends" | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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
  const friendship = friendshipStatus(friendships, viewerId, user.id);
  const friendUsers = users.filter((u) => acceptedFriendIds(friendships, user.id).has(u.id));
  // Travel overlap: places you've both been (within ~60 km or same name).
  const overlap = (() => {
    if (isMe) return [];
    const mine = pins.filter((p) => p.userId === viewerId);
    const seen = new Set<string>();
    const out: { theirs: Pin; minePlace: string }[] = [];
    for (const theirs of myPins) {
      const match = mine.find(
        (m) =>
          m.placeName.toLowerCase() === theirs.placeName.toLowerCase() ||
          distKm(m.lat, m.lng, theirs.lat, theirs.lng) < 60
      );
      if (match && !seen.has(theirs.placeName.toLowerCase())) {
        seen.add(theirs.placeName.toLowerCase());
        out.push({ theirs, minePlace: match.placeName });
      }
    }
    return out;
  })();
  // Countries this profile has pinned, with per-country pin counts.
  const countryRows = (() => {
    const byCode = new Map<string, number>();
    for (const p of myPins) if (p.countryCode) byCode.set(p.countryCode, (byCode.get(p.countryCode) ?? 0) + 1);
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      /* older runtime */
    }
    return [...byCode.entries()]
      .map(([code, count]) => ({ code, count, name: names?.of(code) ?? code }))
      .sort((a, b) => b.count - a.count);
  })();
  const isFollowing = follows.has(user.id);
  const savedPins = pins.filter((p) => savedPinIds.has(p.id));

  function viewOnMap() {
    showOnly(user!.id);
    const first = top[0]?.pin ?? myPins[0];
    router.push("/");
    if (first) setTimeout(() => requestFlyTo(first.lng, first.lat, 4), 60);
  }

  function openPin(pinId: string, lng: number, lat: number) {
    selectPin(pinId);
    router.push("/");
    setTimeout(() => requestFlyTo(lng, lat, 8, { flat: true }), 60);
  }

  return (
    <div className="min-h-screen bg-paper pb-20">
      {/* The world as a constellation — coastline stars, threaded continents,
          slowly breathing behind everything. */}
      <ConstellationBackdrop />
      <Link
        href="/"
        className="fixed left-4 top-4 z-40 flex items-center gap-1.5 rounded-full bg-paper/85 px-3 py-1.5 text-sm shadow-float backdrop-blur"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Map
      </Link>

      <div className="animate-fade relative z-10 mx-auto max-w-2xl px-5 pt-20 sm:px-6 sm:pt-24">
        {/* Identity card — frosted glass floating over the constellation. */}
        <div className="relative rounded-3xl bg-paper/85 px-6 pb-6 pt-7 shadow-float backdrop-blur sm:px-8">
        <div className="flex flex-col items-center text-center">
          {isMe ? (
            /* Your own avatar is an upload button — new photo shows everywhere. */
            <label className="group relative cursor-pointer" title="Change profile picture">
              <img
                src={user.avatarUrl}
                alt=""
                className="h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28"
                style={{ boxShadow: `0 0 0 3px var(--color-paper), 0 0 0 6px var(--color-accent)` }}
              />
              <span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-ink text-paper shadow-float transition-transform group-hover:scale-110">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file, setMyAvatar);
                  e.target.value = "";
                }}
              />
            </label>
          ) : (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28"
              style={{ boxShadow: `0 0 0 3px var(--color-paper), 0 0 0 6px var(--color-accent)` }}
            />
          )}
          <div className="mt-4 flex items-center justify-center gap-2">
            <h1 className="font-display text-4xl leading-none tracking-tight">
              {user.displayName}
            </h1>
            {user.isCreator && <CreatorBadge />}
          </div>
          <p className="mt-2.5 text-sm tracking-wide text-ink-3">
            @{user.handle} <span className="mx-1 text-line">·</span> {user.homeCity}
          </p>
          {user.isCreator && user.activities && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {user.activities.map((a) => (
                <span key={a} className="rounded-full bg-paper-2 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-ink-2">
                  {ACTIVITY_LABELS[a]}
                </span>
              ))}
            </div>
          )}
          {user.bio && (
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">{user.bio}</p>
          )}

          {/* Recap + import lead the card; socials sit right underneath. */}
          {isMe && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setRecapOpen(true)}
                className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper"
              >
                🎁 {new Date().getFullYear()} recap
              </button>
              <button
                onClick={() => setGuideOpen(true)}
                className="rounded-full bg-paper-2 px-5 py-2 text-sm font-semibold text-ink-2 ring-1 ring-line"
              >
                📍 City guides
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="rounded-full bg-paper-2 px-5 py-2 text-sm font-semibold text-ink-2 ring-1 ring-line"
              >
                Import travels
              </button>
            </div>
          )}
          {user.socials && Object.values(user.socials).some(Boolean) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <SocialLinks socials={user.socials} />
            </div>
          )}
        </div>

        {/* Edit profile — pencil in the card's corner. Opens the full editor:
            picture (tap the avatar), name, description, city, socials. */}
        {isMe && !editingProfile && (
          <button
            onClick={() => {
              setNameDraft(user.displayName);
              setBioDraft(user.bio ?? "");
              setCityDraft(user.homeCity ?? "");
              setSocialsDraft(user.socials ?? {});
              setEditingProfile(true);
            }}
            title="Edit profile"
            aria-label="Edit profile"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-paper-2 text-ink-2 ring-1 ring-line transition-colors hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="m14.5 7.5 3 3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        )}
        </div>{/* /identity card */}

        {/* Profile editor (own profile) */}
        {isMe && editingProfile && (
          <div className="animate-fade mx-auto mt-5 max-w-md rounded-2xl border border-line bg-paper/85 p-4 shadow-float backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">
              Edit profile
            </div>
            <p className="mt-1.5 text-xs text-ink-3">
              To change your photo, tap the camera on your profile picture above.
            </p>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-ink-3">Name</span>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl bg-paper px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-ink/30"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-ink-3">Home city</span>
                <input
                  value={cityDraft}
                  onChange={(e) => setCityDraft(e.target.value)}
                  placeholder="Lisbon, Portugal"
                  className="w-full rounded-xl bg-paper px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-ink/30"
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <span className="w-24 shrink-0 pt-2 text-ink-3">About you</span>
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder="A line or two about your travels…"
                  rows={3}
                  maxLength={280}
                  className="w-full resize-none rounded-xl bg-paper px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-ink/30"
                />
              </label>
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Socials
            </div>
            <div className="mt-2 space-y-2">
              {SOCIAL_NETWORKS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 text-ink-3">{label}</span>
                  <span className="text-ink-3">@</span>
                  <input
                    value={socialsDraft[key] ?? ""}
                    onChange={(e) =>
                      setSocialsDraft((d) => ({ ...d, [key]: e.target.value.replace(/^@/, "") }))
                    }
                    placeholder="username"
                    className="w-full rounded-xl bg-paper px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-ink/30"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditingProfile(false)}
                className="rounded-full bg-paper px-4 py-2 text-xs font-semibold text-ink-2 ring-1 ring-line"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const name = nameDraft.trim();
                  if (name) {
                    setMyProfile({
                      displayName: name,
                      bio: bioDraft.trim(),
                      homeCity: cityDraft.trim(),
                    });
                  }
                  setMySocials(socialsDraft);
                  setEditingProfile(false);
                }}
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Stats — three glass tiles. Tap one to expand the list. */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat n={myPins.length} label="pins" active={statView === "pins"} onClick={() => setStatView(statView === "pins" ? null : "pins")} />
          <Stat n={countries} label="countries" active={statView === "countries"} onClick={() => setStatView(statView === "countries" ? null : "countries")} />
          {user.isCreator ? (
            <Stat n={user.followerCount ?? 0} label="followers" format />
          ) : (
            <Stat n={friendCount} label="friends" active={statView === "friends"} onClick={() => setStatView(statView === "friends" ? null : "friends")} />
          )}
        </div>

        {/* Travel overlap — you've both been here */}
        {!isMe && overlap.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line bg-paper-2/50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <span className="font-display text-lg">
                You&apos;ve both been to {overlap.length} {overlap.length === 1 ? "place" : "places"}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {overlap.slice(0, 12).map(({ theirs }) => (
                <button
                  key={theirs.id}
                  onClick={() => openPin(theirs.id, theirs.lng, theirs.lat)}
                  className="rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-line transition-colors hover:bg-paper-2"
                >
                  {theirs.countryCode ? `${flagEmoji(theirs.countryCode)} ` : ""}
                  {theirs.placeName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expanded stat detail */}
        {statView === "friends" && (
          <div className="mt-4 rounded-2xl border border-line bg-paper-2/50 p-3">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              {isMe ? "Your friends" : `${user.displayName.split(" ")[0]}'s friends`}
            </div>
            {friendUsers.length === 0 && (
              <p className="px-1 pb-2 text-sm text-ink-3">No friends yet.</p>
            )}
            <ul className="space-y-1">
              {friendUsers.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper">
                  <Link href={`/u/${f.handle}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <img src={f.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: f.color }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.displayName}</span>
                      <span className="block truncate text-xs text-ink-3">@{f.handle} · {f.homeCity}</span>
                    </span>
                  </Link>
                  {isMe && (
                    <button
                      onClick={() => respondFriendRequest(f.id, false)}
                      className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-accent ring-1 ring-line hover:bg-paper-2"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {statView === "countries" && (
          <div className="mt-4 rounded-2xl border border-line bg-paper-2/50 p-3">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Countries pinned
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {countryRows.map((c) => (
                <li key={c.code} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                  <span className="text-lg leading-none">{flagEmoji(c.code)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                  <span className="text-xs tabular-nums text-ink-3">
                    {c.count} {c.count === 1 ? "pin" : "pins"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {statView === "pins" && (
          <div className="mt-4 rounded-2xl border border-line bg-paper-2/50 p-3">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Every pin
            </div>
            <ul className="space-y-1">
              {myPins.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => openPin(p.id, p.lng, p.lat)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-paper"
                  >
                    {coverUrl(p) ? (
                      <img src={coverUrl(p)!} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-paper text-sm">📍</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {p.placeName}
                        {p.countryCode ? ` · ${flagEmoji(p.countryCode)} ${p.countryCode}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-ink-3">Map ›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Passport — the world at a glance, stamped from this profile's pins */}
        {myPins.length > 0 && <PassportCard pins={myPins} />}

        {/* Actions — centered. (Recap/import moved up into the identity card.) */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {!isMe && (
            <button
              onClick={viewOnMap}
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper"
            >
              View their map
            </button>
          )}
          {!isMe &&
            (user.isCreator ? (
              <button
                onClick={() => toggleFollow(user.id)}
                className={`rounded-full px-6 py-2.5 text-sm font-semibold ${
                  isFollowing ? "bg-paper-2 text-ink-2 ring-1 ring-line" : "bg-accent text-paper"
                }`}
              >
                {isFollowing ? "Following ✓" : "Follow"}
              </button>
            ) : isFriend ? (
              <button
                onClick={() => respondFriendRequest(user.id, false)}
                title="Tap to unfriend"
                className="rounded-full bg-paper-2 px-6 py-2.5 text-sm font-semibold text-ink-2 ring-1 ring-line"
              >
                Friends ✓
              </button>
            ) : friendship?.status === "pending" && friendship.requestedBy === viewerId ? (
              <button
                onClick={() => cancelFriendRequest(user.id)}
                title="Tap to withdraw your request"
                className="rounded-full bg-paper-2 px-6 py-2.5 text-sm font-semibold text-ink-3 ring-1 ring-line"
              >
                Requested ✓
              </button>
            ) : friendship?.status === "pending" ? (
              <>
                <button
                  onClick={() => respondFriendRequest(user.id, true)}
                  className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper"
                >
                  Accept request
                </button>
                <button
                  onClick={() => respondFriendRequest(user.id, false)}
                  className="rounded-full bg-paper-2 px-5 py-2.5 text-sm font-semibold text-ink-3 ring-1 ring-line"
                >
                  Decline
                </button>
              </>
            ) : (
              <button
                onClick={() => sendFriendRequest(user.id)}
                className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper"
              >
                Add friend
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
              {isMe && top.length > 1 && <span className="text-xs text-ink-3">ranked by your ratings</span>}
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

        {/* Sign out — deliberate, at the end of the page, out of the way of
            everything you actually do daily. */}
        {isMe && (
          <div className="mt-14 flex justify-center">
            <button
              onClick={() => signOut()}
              className="rounded-full px-8 py-2.5 text-sm font-medium text-ink-3 ring-1 ring-line transition-colors hover:bg-paper-2 hover:text-accent"
            >
              Sign out
            </button>
          </div>
        )}

        {/* App version — quiet, at the very bottom. */}
        <p className="mt-6 text-center text-[11px] tracking-wide text-ink-3">
          Waypoint v{APP_VERSION} · {backendEnabled ? "live" : "demo"} build
        </p>
      </div>

      {recapOpen && <RecapSheet onClose={() => setRecapOpen(false)} />}
      {importOpen && <ImportPanel onClose={() => setImportOpen(false)} />}
      {guideOpen && <GuidePanel onClose={() => setGuideOpen(false)} />}
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
          {coverUrl(p) && (
            <img
              src={coverUrl(p)}
              alt=""
              loading="lazy"
              decoding="async"
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

function Stat({
  n,
  label,
  format,
  active,
  onClick,
}: {
  n: number;
  label: string;
  format?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className={`tnum font-display text-[28px] leading-none ${active ? "text-accent" : ""}`}>
        {format ? formatFollowers(n) : n}
      </div>
      <div className={`mt-1.5 text-[11px] uppercase tracking-[0.14em] ${active ? "text-accent" : "text-ink-3"}`}>
        {label}
        {onClick && <span className="ml-1 text-ink-3">{active ? "▴" : "▾"}</span>}
      </div>
    </>
  );
  const tile = "rounded-2xl bg-paper-2/60 py-4 text-center ring-1 ring-line/60";
  if (!onClick) return <div className={tile}>{inner}</div>;
  return (
    <button
      onClick={onClick}
      className={`${tile} transition-all hover:bg-paper-2 ${active ? "ring-2 ring-accent" : ""}`}
    >
      {inner}
    </button>
  );
}

// Downscale the chosen photo to a 256px square JPEG data-URL so it persists
// comfortably and renders crisply everywhere (rail, pins, top bar). With the
// Supabase backend this becomes a Storage upload + profiles.avatar_url update.
function uploadAvatar(file: File, apply: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return apply(reader.result as string);
      // Cover-crop to a centered square.
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      apply(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => apply(reader.result as string);
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Country code → flag emoji ("PT" → 🇵🇹). */
function flagEmoji(cc: string): string {
  const code = cc.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
