"use client";

import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { LANDMARKS } from "@/lib/landmarks";
import { coverUrl } from "@/lib/data";
import type { Pin } from "@/lib/types";

// Year in travel: a Wrapped-style recap computed from your own pins, with a
// downloadable share card. All client-side, all from data already loaded.
export default function RecapSheet({ onClose }: { onClose: () => void }) {
  const pins = useStore((s) => s.pins);
  const viewerId = useStore((s) => s.viewerId);
  const likeCounts = useStore((s) => s.likeCounts);
  const users = useStore((s) => s.users);

  const viewer = users.find((u) => u.id === viewerId);
  const year = new Date().getFullYear();
  const mine = pins
    .filter((p) => p.userId === viewerId)
    .filter((p) => new Date(p.startedOn ?? p.createdAt).getFullYear() === year)
    .sort(
      (a, b) =>
        new Date(a.startedOn ?? a.createdAt).getTime() - new Date(b.startedOn ?? b.createdAt).getTime()
    );

  const countries = new Set(mine.map((p) => p.countryCode).filter(Boolean));
  const km = Math.round(
    mine.slice(1).reduce((sum, p, i) => sum + dist(mine[i], p), 0)
  );
  const topRated = [...mine].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const mostLiked = [...mine].sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0))[0];
  const landmarksVisited = LANDMARKS.filter((lm) =>
    mine.some((p) => distLL(p.lat, p.lng, lm.lat, lm.lng) < 40)
  );

  function downloadCard() {
    const W = 1080;
    const H = 1350;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    // Sunset gradient backdrop, echoing the logo.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#ef8322");
    g.addColorStop(0.55, "#f9ae55");
    g.addColorStop(0.56, "#2d3a53");
    g.addColorStop(1, "#212c40");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fbe9c0";
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.53, 130, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e2836";
    ctx.font = "600 44px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("WAYPOINT", W / 2, 110);
    ctx.font = "700 92px Georgia, serif";
    ctx.fillText(`${year} in travel`, W / 2, 230);

    ctx.font = "600 54px Georgia, serif";
    ctx.fillText(`${viewer?.displayName ?? "A traveler"}`, W / 2, 330);

    const rows = [
      [`${mine.length}`, mine.length === 1 ? "place pinned" : "places pinned"],
      [`${countries.size}`, countries.size === 1 ? "country" : "countries"],
      [`${km.toLocaleString()}`, "km between pins"],
      [`${landmarksVisited.length}`, "world landmarks"],
    ];
    ctx.fillStyle = "#fdfaf4";
    rows.forEach(([n, label], i) => {
      const y = 800 + i * 130;
      ctx.font = "700 84px Georgia, serif";
      ctx.textAlign = "right";
      ctx.fillText(n, W / 2 - 30, y);
      ctx.font = "400 44px Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#cdd5e2";
      ctx.fillText(label, W / 2 + 10, y);
      ctx.fillStyle = "#fdfaf4";
    });
    if (topRated) {
      ctx.font = "400 38px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#f9ae55";
      ctx.fillText(`Place of the year: ${topRated.placeName}`, W / 2, 1290);
    }

    const a = document.createElement("a");
    a.download = `waypoint-recap-${year}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{year} in travel</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🗺️</div>
            <p className="mt-2 font-display text-lg">No pins yet this year</p>
            <p className="mt-1 text-sm text-ink-3">Drop your first {year} pin and come back.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Big n={mine.length} label={mine.length === 1 ? "place pinned" : "places pinned"} />
              <Big n={countries.size} label={countries.size === 1 ? "country" : "countries"} />
              <Big n={km} label="km between pins" format />
              <Big n={landmarksVisited.length} label="world landmarks" />
            </div>

            {topRated && topRated.rating != null && (
              <Highlight
                title="Place of the year"
                sub={`${topRated.placeName} — you rated it ${topRated.rating}/10`}
                img={coverUrl(topRated)}
              />
            )}
            {mostLiked && (likeCounts[mostLiked.id] ?? 0) > 0 && (
              <Highlight
                title="Friends' favorite"
                sub={`${mostLiked.title} · ${(likeCounts[mostLiked.id] ?? 0).toLocaleString()} likes`}
                img={coverUrl(mostLiked)}
              />
            )}
            {landmarksVisited.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  Landmarks you passed
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {landmarksVisited.slice(0, 8).map((lm) => (
                    <span key={lm.id} className="rounded-full bg-paper-2 px-2.5 py-1 text-xs text-ink-2">
                      {lm.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={downloadCard}
              className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper"
            >
              Download share card ↓
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Big({ n, label, format }: { n: number; label: string; format?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-2/50 p-4 text-center">
      <div className="tnum font-display text-3xl">{format ? n.toLocaleString() : n}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-3">{label}</div>
    </div>
  );
}

function Highlight({ title, sub, img }: { title: string; sub: string; img?: string | null }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-paper-2/50 p-3.5">
      {img ? (
        <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-paper text-xl">⭐</span>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{title}</div>
        <div className="mt-0.5 truncate text-sm font-medium">{sub}</div>
      </div>
    </div>
  );
}

function dist(a: Pin, b: Pin): number {
  return distLL(a.lat, a.lng, b.lat, b.lng);
}
function distLL(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
