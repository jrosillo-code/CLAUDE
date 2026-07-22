"use client";

import { useState } from "react";
import type { PinPhoto } from "@/lib/types";

export default function PhotoCarousel({ photos }: { photos: PinPhoto[] }) {
  const [i, setI] = useState(0);
  if (!photos.length) return null;
  const n = photos.length;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink/5">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {photos.map((p) => (
          <img
            key={p.id}
            src={p.url}
            alt=""
            className="h-full w-full shrink-0 object-cover"
            draggable={false}
          />
        ))}
      </div>

      {n > 1 && (
        <>
          <Arrow dir="left" onClick={() => setI((v) => (v - 1 + n) % n)} />
          <Arrow dir="right" onClick={() => setI((v) => (v + 1) % n)} />
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {photos.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-5 bg-paper" : "w-1.5 bg-paper/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-ink/35 text-paper backdrop-blur transition-colors hover:bg-ink/55 ${
        dir === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={dir === "left" ? "" : "rotate-180"}>
        <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
