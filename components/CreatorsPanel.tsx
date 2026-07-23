"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { useCreators } from "@/lib/hooks";
import { ACTIVITY_LABELS, type ActivitySlug, type User } from "@/lib/types";

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// The Creators tab: followable public accounts organized by activity verticals
// (surf, MTB, ski, soccer, basketball, photography…). Following overlays a
// creator's pins on your map as a toggleable layer.
export default function CreatorsPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const creators = useCreators();
  const follows = useStore((s) => s.follows);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const showOnly = useStore((s) => s.showOnly);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const pins = useStore((s) => s.pins);
  const [filter, setFilter] = useState<ActivitySlug | "all">("all");

  const verticals = useMemo(() => {
    const set = new Set<ActivitySlug>();
    creators.forEach((c) => c.activities?.forEach((a) => set.add(a)));
    return [...set];
  }, [creators]);

  const shown = useMemo(
    () =>
      filter === "all"
        ? creators
        : creators.filter((c) => c.activities?.includes(filter)),
    [creators, filter]
  );

  function viewOnMap(creator: User) {
    const first = pins.find((p) => p.userId === creator.id);
    showOnly(creator.id);
    onClose();
    router.push("/");
    if (first) setTimeout(() => requestFlyTo(first.lng, first.lat, 4), 60);
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Creators</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Follow the people who map your sport. Their spots become layers on your globe.
        </p>
        {/* Verticals */}
        <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          {verticals.map((v) => (
            <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>
              {ACTIVITY_LABELS[v]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {shown.map((c) => {
          const following = follows.has(c.id);
          return (
            <div key={c.id} className="rounded-2xl border border-line bg-paper-2/60 p-3.5">
              <div className="flex items-start gap-3">
                <Link href={`/u/${c.handle}`} onClick={onClose}>
                  <img
                    src={c.avatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2"
                    style={{ ["--tw-ring-color" as string]: c.color }}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${c.handle}`} onClick={onClose} className="block">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{c.displayName}</span>
                      <CreatorBadge />
                    </div>
                    <div className="text-xs text-ink-3">
                      @{c.handle} · {formatFollowers(c.followerCount ?? 0)} followers
                    </div>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.activities?.map((a) => (
                      <span
                        key={a}
                        className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-2"
                      >
                        {ACTIVITY_LABELS[a]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-ink-2">{c.bio}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => toggleFollow(c.id)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                    following ? "bg-paper text-ink-2 ring-1 ring-line" : "bg-accent text-paper"
                  }`}
                >
                  {following ? "Following ✓" : "Follow"}
                </button>
                <button
                  onClick={() => viewOnMap(c)}
                  className="flex-1 rounded-full bg-ink py-2 text-sm font-semibold text-paper"
                >
                  View map
                </button>
              </div>
            </div>
          );
        })}

        <ApplyCard />
      </div>
    </Sheet>
  );
}

// "Become a creator": pick your verticals, drop a portfolio link, apply. Demo
// stores the application locally; production posts to creator_applications.
function ApplyCard() {
  const creatorApplied = useStore((s) => s.creatorApplied);
  const applyCreator = useStore((s) => s.applyCreator);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<ActivitySlug[]>([]);
  const [link, setLink] = useState("");

  if (creatorApplied) {
    return (
      <div className="rounded-2xl border border-line bg-paper-2/60 p-4 text-center">
        <div className="text-xl">🎉</div>
        <p className="mt-1 font-display text-lg">Application received</p>
        <p className="mt-1 text-sm text-ink-3">
          We review creator applications weekly — you&apos;ll hear back by email.
        </p>
      </div>
    );
  }

  const toggle = (a: ActivitySlug) =>
    setPicked((p) => (p.includes(a) ? p.filter((x) => x !== a) : p.length < 3 ? [...p, a] : p));

  return (
    <div className="rounded-2xl border border-dashed border-line p-4">
      {!open ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg">Are you a creator?</p>
            <p className="mt-0.5 text-sm text-ink-3">
              Map your sport for {`${(132400 + 210500 + 58100).toLocaleString()}`}+ followers.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-paper"
          >
            Apply
          </button>
        </div>
      ) : (
        <div>
          <p className="font-display text-lg">Apply to be a creator</p>
          <p className="mt-0.5 text-sm text-ink-3">Pick up to 3 verticals you cover.</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(Object.keys(ACTIVITY_LABELS) as ActivitySlug[]).map((a) => (
              <Chip key={a} active={picked.includes(a)} onClick={() => toggle(a)}>
                {ACTIVITY_LABELS[a]}
              </Chip>
            ))}
          </div>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link to your work (Instagram, YouTube, site…)"
            className="mt-3 w-full rounded-2xl bg-paper-2 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ink/15"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-paper-2 px-4 py-2 text-xs font-semibold text-ink-2"
            >
              Cancel
            </button>
            <button
              onClick={() => picked.length > 0 && applyCreator({ activities: picked, link: link.trim() })}
              disabled={picked.length === 0}
              className="rounded-full bg-accent px-5 py-2 text-xs font-semibold text-paper disabled:opacity-40"
            >
              Submit application
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

export function CreatorBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-accent">
      <path
        d="M12 2.5 14.3 5l3.4-.3.6 3.3 3 1.6-1.4 3.1 1.4 3.1-3 1.6-.6 3.3-3.4-.3L12 22.7 9.7 20l-3.4.3-.6-3.3-3-1.6 1.4-3.1L2.7 9.2l3-1.6.6-3.3 3.4.3z"
        fill="currentColor"
      />
      <path d="m9.2 12.2 2 2 3.6-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
