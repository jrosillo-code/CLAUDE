"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { THEMES, THEME_ORDER } from "@/lib/themes";

// Bottom-left map controls: ONE Layers button on every screen size, opening a
// single glass card — Map/Satellite, 3D, Landmarks, Saved, themes, and the
// map's data credit. (Desktop used to spread these across a pill + chip row;
// the folded stack proved cleaner on phones and now runs everywhere.)
export default function BasemapToggle() {
  const basemap = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const terrain3d = useStore((s) => s.terrain3d);
  const setTerrain3d = useStore((s) => s.setTerrain3d);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const showLandmarks = useStore((s) => s.showLandmarks);
  const setShowLandmarks = useStore((s) => s.setShowLandmarks);
  const showAirports = useStore((s) => s.showAirports);
  const setShowAirports = useStore((s) => s.setShowAirports);
  const showStations = useStore((s) => s.showStations);
  const setShowStations = useStore((s) => s.setShowStations);
  const showStadiums = useStore((s) => s.showStadiums);
  const setShowStadiums = useStore((s) => s.setShowStadiums);
  const showWishlist = useStore((s) => s.showWishlist);
  const setShowWishlist = useStore((s) => s.setShowWishlist);
  const savedCount = useStore((s) => s.savedPinIds.size);
  const [open, setOpen] = useState(false);

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
  const iconAirport = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M21 15.5v-2l-8-5V4a1.5 1.5 0 0 0-3 0v4.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z" fill="currentColor" />
    </svg>
  );
  const iconTrain = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="6" y="3.5" width="12" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 11h12" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="13.6" r="1" fill="currentColor" /><circle cx="15" cy="13.6" r="1" fill="currentColor" />
      <path d="m8 17-2 3.5M16 17l2 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
  const iconStadium = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="9" rx="9" ry="4.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 9v5c0 2.3 4 4.2 9 4.2s9-1.9 9-4.2V9" stroke="currentColor" strokeWidth="1.7" />
      <ellipse cx="12" cy="9" rx="3.4" ry="1.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );

  return (
    <div
      className={`fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 sm:bottom-6 ${
        open ? "z-40" : "z-30"
      }`}
    >
      {open && (
        <>
          <button
            aria-label="Close map layers"
            onClick={() => setOpen(false)}
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
              <RowToggle icon={iconAirport} label="Airports" active={showAirports} onClick={() => setShowAirports(!showAirports)} />
              <RowToggle icon={iconTrain} label="Train stations" active={showStations} onClick={() => setShowStations(!showStations)} />
              <RowToggle icon={iconStadium} label="Stadiums" active={showStadiums} onClick={() => setShowStadiums(!showStadiums)} />
              <RowToggle
                icon={iconSaved}
                label={`Saved${savedCount > 0 ? ` · ${savedCount}` : ""}`}
                active={showWishlist}
                onClick={() => setShowWishlist(!showWishlist)}
              />
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 px-1">
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
            </div>

            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block px-1 text-[9px] text-ink-3/70"
            >
              © OpenStreetMap contributors
            </a>
          </div>
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Map layers"
        aria-label="Map layers"
        className={`grid h-12 w-12 place-items-center rounded-full shadow-float backdrop-blur transition-colors ${
          open ? "bg-ink text-paper" : "bg-paper/90 text-ink"
        }`}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path d="m12 3 9 5-9 5-9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m4.6 12.6 7.4 4.1 7.4-4.1M4.6 16.6l7.4 4.1 7.4-4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
        </svg>
      </button>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
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
