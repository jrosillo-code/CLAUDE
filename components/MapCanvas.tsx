"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import { useStore } from "@/lib/store";
import { useVisiblePins } from "@/lib/hooks";
import {
  TERRAIN_ATTRIBUTION,
  TERRAIN_TILES,
  bundledWorldStyle,
  satelliteStyle,
} from "@/lib/mapStyle";
import { THEMES } from "@/lib/themes";
import type { PinWithOwner } from "@/lib/types";

interface Props {
  placing: boolean;
  onPick: (lng: number, lat: number) => void;
}

type ClusterProps = {
  cluster?: boolean;
  cluster_id?: number;
  point_count?: number;
  pinId?: string;
  ownerId?: string;
  color?: string;
  photo?: string;
};

const DEM_SOURCE = "waypoint-dem";

export default function MapCanvas({ placing, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const clusterRef = useRef<Supercluster | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const readyRef = useRef(false);
  const didInitialFit = useRef(false);
  const styleSeqRef = useRef(0);

  const visiblePins = useVisiblePins();
  const selectedPinId = useStore((s) => s.selectedPinId);
  const selectPin = useStore((s) => s.selectPin);
  const flyTo = useStore((s) => s.flyTo);
  const basemap = useStore((s) => s.basemap);
  const terrain3d = useStore((s) => s.terrain3d);
  const themeId = useStore((s) => s.theme);

  const placingRef = useRef(placing);
  const onPickRef = useRef(onPick);
  const pinsRef = useRef<PinWithOwner[]>(visiblePins);
  const selectRef = useRef(selectPin);
  const selectedRef = useRef<string | null>(selectedPinId);
  const terrainRef = useRef(terrain3d);
  const themeRef = useRef(THEMES[themeId]);
  // Set when the elevation source can't load (offline / bundled basemap):
  // terrain gets disabled so fills still render.
  const terrainBrokenRef = useRef(true);
  placingRef.current = placing;
  onPickRef.current = onPick;
  pinsRef.current = visiblePins;
  selectRef.current = selectPin;
  selectedRef.current = selectedPinId;
  terrainRef.current = terrain3d;
  themeRef.current = THEMES[themeId];

  // Apply the "planet" chrome — globe projection, themed atmosphere, and 3D
  // terrain — after any style (re)load, since setStyle wipes sources/terrain.
  function applyGlobeChrome(map: maplibregl.Map) {
    try {
      map.setProjection({ type: "globe" });
    } catch {
      /* older maplibre → mercator */
    }
    try {
      map.setSky(themeRef.current.sky);
    } catch {
      /* sky unsupported */
    }
    if (terrainBrokenRef.current) {
      try {
        map.setTerrain(null);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      if (!map.getSource(DEM_SOURCE)) {
        map.addSource(DEM_SOURCE, {
          type: "raster-dem",
          tiles: [TERRAIN_TILES],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 14,
          attribution: TERRAIN_ATTRIBUTION,
        });
      }
      if (!map.getLayer("waypoint-hillshade")) {
        map.addLayer({
          id: "waypoint-hillshade",
          type: "hillshade",
          source: DEM_SOURCE,
          paint: {
            "hillshade-exaggeration": 0.35,
            "hillshade-shadow-color": "#5a4a3a",
          },
        });
      }
      map.setTerrain(terrainRef.current ? { source: DEM_SOURCE, exaggeration: 1.25 } : null);
    } catch {
      /* terrain source blocked — map still works flat */
    }
  }

  // Swap the basemap for the current mode+theme: satellite directly; "map" mode
  // shows the bundled themed globe instantly, then upgrades to the theme's
  // online street style once that provider is confirmed reachable.
  function applyBasemap(map: maplibregl.Map, mode: "map" | "satellite") {
    const seq = ++styleSeqRef.current;
    const theme = themeRef.current;
    if (mode === "satellite") {
      terrainBrokenRef.current = false; // DEM may load; error handler resets
      map.setStyle(satelliteStyle());
      return;
    }
    terrainBrokenRef.current = true; // bundled globe has no elevation data
    map.setStyle(bundledWorldStyle(theme));
    const remote = theme.remoteStyle;
    if (!remote) return;
    fetch(remote, { mode: "cors" })
      .then((res) => {
        if (!res.ok) throw new Error("style probe failed");
        if (styleSeqRef.current !== seq) return; // user switched again
        terrainBrokenRef.current = false;
        map.setStyle(remote);
      })
      .catch(() => {
        /* stay on the bundled globe */
      });
  }

  // ---- Map init (once) ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: bundledWorldStyle(themeRef.current),
      center: [10, 25],
      zoom: 1.6,
      minZoom: 1.05, // never shrink the planet to a dot
      pitch: 0,
      maxPitch: 75,
      attributionControl: false,
    });
    mapRef.current = map;

    // Snappier, more controllable wheel zoom (Apple-ish feel).
    map.scrollZoom.setWheelZoomRate(1 / 240);

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      "bottom-right"
    );

    // Runs once, on the first style that loads.
    const initOnce = () => {
      applyGlobeChrome(map);
      if (readyRef.current) return;
      readyRef.current = true;
      map.resize();
      rebuildIndex();
      render();
      fitToViewer();
    };
    map.on("style.load", initOnce);
    map.on("load", initOnce);
    requestAnimationFrame(() => map.resize());

    // Kick the online-style upgrade probe for the initial theme.
    {
      const seq = ++styleSeqRef.current;
      const remote = themeRef.current.remoteStyle;
      if (remote) {
        fetch(remote, { mode: "cors" })
          .then((res) => {
            if (!res.ok) throw new Error("style probe failed");
            if (styleSeqRef.current !== seq) return;
            terrainBrokenRef.current = false;
            map.setStyle(remote);
          })
          .catch(() => {});
      }
    }

    map.on("error", (e) => {
      const msg = String(e?.error?.message ?? "");
      // Elevation source unreachable → drop terrain so fills keep rendering.
      if (/elevation|terrarium|terrain|raster-dem/i.test(msg) && !terrainBrokenRef.current) {
        terrainBrokenRef.current = true;
        try {
          map.setTerrain(null);
        } catch {
          /* ignore */
        }
      }
    });

    // Keep the globe centered while zooming out: as zoom decreases, ease the
    // camera's latitude back toward the equator (and flatten pitch) so the
    // planet sits in the middle of the screen instead of sliding off-bottom.
    //
    // IMPORTANT: never call easeTo() synchronously from inside a camera event
    // (zoomend fires mid-animation teardown) — re-entering the animation loop
    // corrupts MapLibre's easing state ("this._onEaseFrame is not a function",
    // "Attempting to run(), but is already running"). Instead, debounce and run
    // only once the map is fully idle.
    let recenterTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRecenter = () => {
      if (recenterTimer !== null) clearTimeout(recenterTimer);
      recenterTimer = setTimeout(() => {
        recenterTimer = null;
        if (map.isMoving() || map.isZooming() || map.isRotating()) {
          scheduleRecenter(); // still animating — try again shortly
          return;
        }
        const z = map.getZoom();
        if (z >= 3.2) return;
        const t = Math.max(0, Math.min(1, (z - 1.05) / (3.2 - 1.05)));
        const maxLat = 12 + t * 63; // 12° fully zoomed out → 75° near street level
        const c = map.getCenter();
        const clampedLat = Math.max(-maxLat, Math.min(maxLat, c.lat));
        const needPitch = z < 2.4 && map.getPitch() > 4;
        if (Math.abs(clampedLat - c.lat) > 0.4 || needPitch) {
          try {
            map.easeTo({
              center: [c.lng, clampedLat],
              pitch: needPitch ? 0 : map.getPitch(),
              duration: 420,
              essential: true,
            });
          } catch {
            /* camera busy — skip this round */
          }
        }
      }, 140);
    };

    map.on("moveend", render);
    map.on("zoomend", () => {
      render();
      scheduleRecenter();
    });
    map.on("move", renderThrottled);

    map.on("click", (e) => {
      if (placingRef.current) onPickRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- React to Map/Satellite + theme switches ----
  const modeKeyRef = useRef(`${basemap}:${themeId}`);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const key = `${basemap}:${themeId}`;
    if (modeKeyRef.current === key) return;
    modeKeyRef.current = key;
    applyBasemap(map, basemap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, themeId]);

  // ---- Toggle terrain relief ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || terrainBrokenRef.current) return;
    try {
      map.setTerrain(terrain3d ? { source: DEM_SOURCE, exaggeration: 1.25 } : null);
    } catch {
      /* ignore */
    }
  }, [terrain3d]);

  // Cursor for placing mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = placing ? "crosshair" : "";
  }, [placing]);

  function rebuildIndex() {
    const index = new Supercluster({ radius: 54, maxZoom: 16 });
    index.load(
      pinsRef.current.map((p) => ({
        type: "Feature" as const,
        properties: {
          pinId: p.id,
          ownerId: p.userId,
          color: p.owner.color,
          photo: p.photos[0]?.url ?? p.owner.avatarUrl,
        },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      }))
    );
    clusterRef.current = index;
  }

  useEffect(() => {
    if (!readyRef.current) return;
    rebuildIndex();
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePins]);

  useEffect(() => {
    if (readyRef.current) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPinId]);

  // ---- Fly-to intent from the store ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 9,
      pitch: (flyTo.zoom ?? 9) >= 6 ? 45 : 0, // tilt into a 3D view up close
      duration: 1600,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo?.nonce]);

  function fitToViewer() {
    if (didInitialFit.current) return;
    const viewerId = useStore.getState().viewerId;
    const own = pinsRef.current.filter((p) => p.userId === viewerId);
    const pts = own.length ? own : pinsRef.current;
    if (!pts.length) return;
    const b = new maplibregl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    mapRef.current?.fitBounds(b, {
      padding: { top: 120, bottom: 140, left: 80, right: 80 },
      maxZoom: 5.5,
      duration: 2800,
    });
    didInitialFit.current = true;
  }

  // ---- Marker rendering ----
  let rafPending = false;
  function renderThrottled() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      render();
    });
  }

  function render() {
    const map = mapRef.current;
    const index = clusterRef.current;
    if (!map || !index) return;

    // At planet scale, getBounds() is unreliable under the globe projection —
    // it can go degenerate and report a sliver, dropping every cluster. Below
    // that scale, query the whole world and let the horizon test decide what's
    // actually visible on the sphere.
    const zoomNow = map.getZoom();
    const planetScale = zoomNow < 3.5;
    let bbox: [number, number, number, number];
    if (planetScale) {
      bbox = [-180, -90, 180, 90];
    } else {
      const bounds = map.getBounds();
      bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    }
    const zoom = Math.round(zoomNow);
    const clusters = index.getClusters(bbox, zoom);

    // Markers beyond the globe's horizon get projected OUTWARD past the
    // sphere's silhouette and float detached beside the planet. Hide them with
    // a screen-space test: the silhouette is a circle around the projected map
    // center whose radius is the projected distance to a point 90° of arc
    // away — anything projecting outside that circle is off-globe.
    const checkHorizon = zoomNow < 5;
    const center = map.getCenter();
    let silhouette: { cx: number; cy: number; r: number } | null = null;
    if (checkHorizon) {
      try {
        const cPx = map.project([center.lng, center.lat]);
        // Great-circle point 90° due north of center (wraps over the pole).
        const northLat = center.lat + 90;
        const p90 =
          northLat > 90
            ? map.project([center.lng + 180, 180 - northLat])
            : map.project([center.lng, northLat]);
        const r = Math.hypot(p90.x - cPx.x, p90.y - cPx.y);
        if (Number.isFinite(r) && r > 10) {
          silhouette = { cx: cPx.x, cy: cPx.y, r: r * 0.995 };
        }
      } catch {
        silhouette = null;
      }
    }

    const next = new Set<string>();
    for (const c of clusters) {
      const props = c.properties as ClusterProps;
      const [lng, lat] = c.geometry.coordinates as [number, number];
      const key = props.cluster ? `c-${props.cluster_id}` : `p-${props.pinId}`;
      next.add(key);

      let marker = markersRef.current.get(key);
      const el = props.cluster
        ? clusterEl(props.point_count ?? 0, leafColors(index, props.cluster_id!))
        : pinEl(props, props.pinId === selectedRef.current);

      if (marker) {
        const existing = marker.getElement();
        existing.replaceChildren(...Array.from(el.childNodes));
        // Preserve MapLibre's own marker classes; ours follow.
        const keep = existing.className
          .split(" ")
          .filter((c) => c.startsWith("maplibregl"));
        existing.className = [...keep, ...el.className.split(" ")].join(" ");
        marker.setLngLat([lng, lat]);
      } else {
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      }

      const element = marker.getElement();

      // Horizon occlusion (screen-space silhouette test).
      if (silhouette) {
        let onGlobe = true;
        try {
          const mPx = map.project([lng, lat]);
          const d = Math.hypot(mPx.x - silhouette.cx, mPx.y - silhouette.cy);
          onGlobe = Number.isFinite(d) && d <= silhouette.r;
        } catch {
          onGlobe = false;
        }
        element.style.display = onGlobe ? "" : "none";
      } else {
        element.style.display = "";
      }

      element.onclick = (ev) => {
        ev.stopPropagation();
        if (placingRef.current) return;
        if (props.cluster && props.cluster_id != null) {
          const expZoom = Math.min(index.getClusterExpansionZoom(props.cluster_id), 16);
          map.flyTo({ center: [lng, lat], zoom: expZoom, duration: 700 });
        } else if (props.pinId) {
          selectRef.current(props.pinId);
          map.flyTo({
            center: [lng, lat],
            zoom: Math.max(map.getZoom(), 6),
            pitch: 45,
            duration: 800,
          });
        }
      };
    }

    for (const [key, marker] of markersRef.current) {
      if (!next.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    }
  }

  // Inline width/height guarantee the map has real dimensions at init even if a
  // utility class doesn't resolve — MapLibre renders nothing into a 0-height box.
  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/** Great-circle angular distance between two lng/lat points, in degrees. */
function angularDistanceDeg(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const φ1 = lat1 * rad;
  const φ2 = lat2 * rad;
  const Δλ = (lng2 - lng1) * rad;
  const cosΔ =
    Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.acos(Math.max(-1, Math.min(1, cosΔ))) / rad;
}

function leafColors(index: Supercluster, clusterId: number): string[] {
  try {
    const leaves = index.getLeaves(clusterId, 6);
    const colors = leaves.map((l) => (l.properties as ClusterProps).color ?? "#c65d3b");
    return [...new Set(colors)];
  } catch {
    return ["#c65d3b"];
  }
}

function clusterEl(count: number, colors: string[]): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "marker-in relative cursor-pointer select-none";
  const size = count > 25 ? 58 : count > 8 ? 50 : 44;
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;

  const stack = colors.slice(0, 3);
  stack.forEach((color, i) => {
    const ring = document.createElement("div");
    ring.className = "absolute rounded-full";
    ring.style.inset = "0";
    ring.style.background = color;
    ring.style.transform = `translate(${(i - 1) * 5}px, ${-i * 4}px)`;
    ring.style.opacity = `${0.85 - i * 0.2}`;
    ring.style.boxShadow = "0 2px 8px rgba(0,0,0,.3)";
    wrap.appendChild(ring);
  });

  const disc = document.createElement("div");
  disc.className =
    "absolute inset-[3px] rounded-full bg-[#f6f3ee] flex items-center justify-center font-semibold text-[#1a1714]";
  disc.style.boxShadow = "inset 0 0 0 2px rgba(255,255,255,.6)";
  disc.style.fontSize = size > 50 ? "16px" : "14px";
  disc.textContent = String(count);
  wrap.appendChild(disc);
  return wrap;
}

function pinEl(props: ClusterProps, selected: boolean): HTMLDivElement {
  const wrap = document.createElement("div");
  const size = selected ? 46 : 34;
  wrap.className = "marker-in cursor-pointer select-none rounded-full";
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.style.padding = "2px";
  wrap.style.background = props.color ?? "#c65d3b";
  wrap.style.boxShadow = selected
    ? `0 0 0 3px #f6f3ee, 0 6px 16px rgba(0,0,0,.35)`
    : `0 2px 8px rgba(0,0,0,.35)`;
  wrap.style.transition = "width .15s, height .15s";
  wrap.style.zIndex = selected ? "5" : "1";

  const img = document.createElement("div");
  img.className = "w-full h-full rounded-full bg-cover bg-center";
  img.style.backgroundImage = `url("${props.photo}")`;
  img.style.boxShadow = "inset 0 0 0 2px rgba(255,255,255,.85)";
  wrap.appendChild(img);
  return wrap;
}
