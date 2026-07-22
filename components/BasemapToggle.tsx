"use client";

import { useStore } from "@/lib/store";

// Apple-style Map / Satellite switch, with a 3D relief toggle.
export default function BasemapToggle() {
  const basemap = useStore((s) => s.basemap);
  const setBasemap = useStore((s) => s.setBasemap);
  const terrain3d = useStore((s) => s.terrain3d);
  const setTerrain3d = useStore((s) => s.setTerrain3d);

  return (
    <div className="fixed bottom-6 left-3 z-30 flex flex-col gap-2">
      <div className="flex rounded-full bg-paper/90 p-1 shadow-float backdrop-blur">
        <Tab active={basemap === "map"} onClick={() => setBasemap("map")}>Map</Tab>
        <Tab active={basemap === "satellite"} onClick={() => setBasemap("satellite")}>Satellite</Tab>
      </div>
      <button
        onClick={() => setTerrain3d(!terrain3d)}
        className={`flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-medium shadow-float backdrop-blur transition-colors ${
          terrain3d ? "bg-ink text-paper" : "bg-paper/90 text-ink-2"
        }`}
        title="Toggle 3D terrain"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="m3 20 6-10 4 6 3-4 5 8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        3D
      </button>
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
