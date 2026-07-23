"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { THEMES, THEME_ORDER } from "@/lib/themes";

// Bottom-left map controls: Apple-style Map / Satellite switch, 3D relief
// toggle, and the theme picker (Daylight / Sandstone / Mint / Midnight).
export default function BasemapToggle() {
  const basemap = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const terrain3d = useStore((s) => s.terrain3d);
  const setTerrain3d = useStore((s) => s.setTerrain3d);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const showLandmarks = useStore((s) => s.showLandmarks);
  const setShowLandmarks = useStore((s) => s.setShowLandmarks);
  const showWishlist = useStore((s) => s.showWishlist);
  const setShowWishlist = useStore((s) => s.setShowWishlist);
  const savedCount = useStore((s) => s.savedPinIds.size);
  const [themesOpen, setThemesOpen] = useState(false);

  return (
    <div className="fixed z-30 flex flex-col gap-2 max-sm:bottom-4 max-sm:left-2 max-sm:max-w-[calc(100vw-88px)] sm:bottom-6 sm:left-3">
      {themesOpen && (
        <div className="animate-fade flex items-center gap-1.5 self-start rounded-full bg-paper/90 p-1.5 shadow-float backdrop-blur">
          {THEME_ORDER.map((id) => {
            const t = THEMES[id];
            const active = id === theme;
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                title={t.label}
                aria-label={`${t.label} theme`}
                className={`h-7 w-7 rounded-full transition-transform ${
                  active ? "scale-110 ring-2 ring-ink" : "hover:scale-105"
                }`}
                style={{
                  background: `linear-gradient(135deg, ${t.swatch[0]} 0%, ${t.swatch[0]} 49%, ${t.swatch[1]} 51%, ${t.swatch[1]} 100%)`,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)",
                }}
              />
            );
          })}
          <span className="px-1.5 text-xs font-medium text-ink-2">{THEMES[theme].label}</span>
        </div>
      )}

      <div className="flex rounded-full bg-paper/90 p-1 shadow-float backdrop-blur">
        <Tab active={basemap === "map"} onClick={() => setBasemap("map")}>Map</Tab>
        <Tab active={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satellite</Tab>
      </div>

      <div className="flex gap-2 max-sm:flex-wrap">
        <button
          onClick={() => setTerrain3d(!terrain3d)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-float backdrop-blur transition-colors ${
            terrain3d ? "bg-ink text-paper" : "bg-paper/90 text-ink-2"
          }`}
          title="Toggle 3D terrain"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="m3 20 6-10 4 6 3-4 5 8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span className="max-sm:hidden">3D</span>
        </button>
        <button
          onClick={() => setShowLandmarks(!showLandmarks)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-float backdrop-blur transition-colors ${
            showLandmarks ? "bg-ink text-paper" : "bg-paper/90 text-ink-2"
          }`}
          title="World landmarks: UNESCO sites, monuments, parks"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 21h16M5 10h14M6 21v-8m4 8v-8m4 8v-8m4 8v-8M12 3 4.5 8.5h15z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span className="max-sm:hidden">Landmarks</span>
        </button>
        <button
          onClick={() => setShowWishlist(!showWishlist)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-float backdrop-blur transition-colors ${
            showWishlist ? "bg-ink text-paper" : "bg-paper/90 text-ink-2"
          }`}
          title="Show places you saved (the Save button on any pin) as ghost pins — your want-to-go layer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span className="max-sm:hidden">Saved{savedCount > 0 ? ` · ${savedCount}` : ""}</span>
        </button>
        <button
          onClick={() => setThemesOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-float backdrop-blur transition-colors ${
            themesOpen ? "bg-ink text-paper" : "bg-paper/90 text-ink-2"
          }`}
          title="Themes"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" opacity=".35" />
          </svg>
          <span className="max-sm:hidden">Theme</span>
        </button>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
