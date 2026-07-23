"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { THEMES, THEME_ORDER } from "@/lib/themes";

// Bottom-left map controls. Desktop: Apple-style Map / Satellite switch plus a
// chip row (3D, Landmarks, Saved, Theme). Phones: all of it folds into a
// single Layers button that opens one glass card — the screen stays clean.
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const icon3d = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="m3 20 6-10 4 6 3-4 5 8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
  const iconLandmarks = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 21h16M5 10h14M6 21v-8m4 8v-8m4 8v-8m4 8v-8M12 3 4.5 8.5h15z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
  const iconSaved = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );

  const themeSwatches = (
    <>
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
    </>
  );

  return (
    <>
      {/* ── Desktop: the familiar stack, unchanged ── */}
      <div className="fixed bottom-6 left-3 z-30 hidden flex-col gap-2 sm:flex">
        {themesOpen && (
          <div className="animate-fade flex items-center gap-1.5 self-start rounded-full bg-paper/90 p-1.5 shadow-float backdrop-blur">
            {themeSwatches}
            <span className="px-1.5 text-xs font-medium text-ink-2">{THEMES[theme].label}</span>
          </div>
        )}

        <div className="flex rounded-full bg-paper/90 p-1 shadow-float backdrop-blur">
          <Tab active={basemap === "map"} onClick={() => setBasemap("map")}>Map</Tab>
          <Tab active={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satellite</Tab>
        </div>

        <div className="flex gap-2">
          <Chip active={terrain3d} onClick={() => setTerrain3d(!terrain3d)} title="Toggle 3D terrain">
            {icon3d}
            <span>3D</span>
          </Chip>
          <Chip
            active={showLandmarks}
            onClick={() => setShowLandmarks(!showLandmarks)}
            title="World landmarks: UNESCO sites, monuments, parks"
          >
            {iconLandmarks}
            <span>Landmarks</span>
          </Chip>
          <Chip
            active={showWishlist}
            onClick={() => setShowWishlist(!showWishlist)}
            title="Show places you saved (the Save button on any pin) as ghost pins — your want-to-go layer"
          >
            {iconSaved}
            <span>Saved{savedCount > 0 ? ` · ${savedCount}` : ""}</span>
          </Chip>
          <Chip active={themesOpen} onClick={() => setThemesOpen((o) => !o)} title="Themes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" opacity=".35" />
            </svg>
            <span>Theme</span>
          </Chip>
        </div>
      </div>

      {/* ── Phones: one Layers button, one card ── */}
      <div className={`fixed bottom-4 left-3 sm:hidden ${mobileOpen ? "z-40" : "z-30"}`}>
        {mobileOpen && (
          <>
            <button
              aria-label="Close map layers"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 cursor-default"
            />
            <div className="animate-sheet absolute bottom-14 left-0 w-[236px] rounded-3xl bg-paper/90 p-3 shadow-float backdrop-blur">
              <div className="flex rounded-full bg-paper-2 p-1">
                <Tab active={basemap === "map"} onClick={() => setBasemap("map")}>Map</Tab>
                <Tab active={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satellite</Tab>
              </div>

              <div className="mt-2 space-y-0.5">
                <RowToggle icon={icon3d} label="3D terrain" active={terrain3d} onClick={() => setTerrain3d(!terrain3d)} />
                <RowToggle icon={iconLandmarks} label="Landmarks" active={showLandmarks} onClick={() => setShowLandmarks(!showLandmarks)} />
                <RowToggle
                  icon={iconSaved}
                  label={`Saved${savedCount > 0 ? ` · ${savedCount}` : ""}`}
                  active={showWishlist}
                  onClick={() => setShowWishlist(!showWishlist)}
                />
              </div>

              <div className="mt-2.5 flex items-center gap-1.5 px-1">{themeSwatches}</div>
            </div>
          </>
        )}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          title="Map layers"
          aria-label="Map layers"
          className={`grid h-12 w-12 place-items-center rounded-full shadow-float backdrop-blur transition-colors ${
            mobileOpen ? "bg-ink text-paper" : "bg-paper/90 text-ink"
          }`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
            <path d="m12 3 9 5-9 5-9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m4.6 12.6 7.4 4.1 7.4-4.1M4.6 16.6l7.4 4.1 7.4-4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
          </svg>
        </button>
      </div>
    </>
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

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-float backdrop-blur transition-colors ${
        active ? "bg-ink text-paper" : "bg-paper/90 text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

function RowToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm hover:bg-paper-2"
    >
      <span className={`grid h-7 w-7 place-items-center rounded-full ${active ? "bg-ink text-paper" : "bg-paper-2 text-ink-2"}`}>
        {icon}
      </span>
      <span className={active ? "text-ink" : "text-ink-2"}>{label}</span>
      <span
        className={`ml-auto h-5 w-9 rounded-full p-0.5 transition-colors ${active ? "bg-accent" : "bg-line"}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-paper shadow transition-transform ${active ? "translate-x-4" : ""}`}
        />
      </span>
    </button>
  );
}
