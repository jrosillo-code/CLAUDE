"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import Supercluster from "supercluster";
import { useStore } from "@/lib/store";
import { useVisiblePins } from "@/lib/hooks";
import {
  FALLBACK_STYLE,
  MAP_STYLE_URL,
  SKY,
  TERRAIN_ATTRIBUTION,
  TERRAIN_TILES,
  satelliteStyle,
} from "@/lib/mapStyle";
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

  const visiblePins = useVisiblePins();
  const selectedPinId = useStore((s) => s.selectedPinId);
  const selectPin = useStore((s) => s.selectPin);
  const flyTo = useStore((s) => s.flyTo);
  const basemap = useStore((s) => s.basemap);
  const terrain3d = useStore((s) => s.terrain3d);

  const placingRef = useRef(placing);
  const onPickRef = useRef(onPick);
  const pinsRef = useRef<PinWithOwner[]>(visiblePins);
  const selectRef = useRef(selectPin);
  const selectedRef = useRef<string | null>(selectedPinId);
  const terrainRef = useRef(terrain3d);
  placingRef.current = placing;
  onPickRef.current = onPick;
  pinsRef.current = visiblePins;
  selectRef.current = selectPin;
  selectedRef.current = selectedPinId;
  terrainRef.current = terrain3d;

  // Apply the "planet" chrome — globe projection, atmosphere, and 3D terrain —
  // after any style (re)load, since setStyle wipes sources/terrain.
  function applyGlobeChrome(map: maplibregl.Map) {
    try {
      map.setProjection({ type: "globe" });
    } catch {
      /* older maplibre → mercator */
    }
    try {
      map.setSky(SKY);
    } catch {
      /* sky unsupported */
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

  // ---- Map init (once) ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [10, 25],
      zoom: 1.5,
      pitch: 0,
      maxPitch: 75,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      "bottom-right"
    );

    // Run marker/camera init exactly once, off whichever "ready" signal lands
    // first (load, or style.load for the fallback path).
    const initOnce = () => {
      applyGlobeChrome(map);
      if (readyRef.current) return;
      readyRef.current = true;
      rebuildIndex();
      render();
      fitToViewer();
    };
    map.on("style.load", initOnce);
    map.on("load", initOnce);

    // Graceful fallback if the base style can't load (offline / blocked host).
    let fellBack = false;
    const toFallback = () => {
      if (fellBack || readyRef.current) return;
      fellBack = true;
      try {
        map.setStyle(FALLBACK_STYLE);
      } catch {
        /* ignore */
      }
    };
    map.on("error", (e) => {
      const msg = String(e?.error?.message ?? "");
      if (/style|sprite|glyphs|fetch|network|load/i.test(msg)) toFallback();
    });
    // Last-resort safety net: if the real style never became ready, show the
    // fallback globe. Generous so a slow-but-fine connection isn't preempted.
    setTimeout(toFallback, 8000);

    map.on("moveend", render);
    map.on("zoomend", render);
    map.on("move", renderThrottled);

    map.on("click", (e) => {
      if (placingRef.current) onPickRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- React to Map/Satellite toggle ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const next = basemap === "satellite" ? satelliteStyle() : MAP_STYLE_URL;
    map.setStyle(next as maplibregl.StyleSpecification | string);
    // applyGlobeChrome re-runs on the resulting style.load. Markers are DOM
    // overlays and survive the style swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // ---- Toggle terrain relief ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
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

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const zoom = Math.round(map.getZoom());
    const clusters = index.getClusters(bbox, zoom);

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
        marker.getElement().replaceChildren(...Array.from(el.childNodes));
        marker.getElement().className = el.className;
        marker.setLngLat([lng, lat]);
      } else {
        marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      }

      const element = marker.getElement();
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

  return <div ref={containerRef} className="absolute inset-0" />;
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
