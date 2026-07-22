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
import { coverUrl, visibleTrips } from "@/lib/data";
import type { PinWithOwner, Trip, TripStop } from "@/lib/types";
import { useMemo } from "react";

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
const TRIPS_SOURCE = "waypoint-trips";

// Remembered across theme switches (module scope): which online style hosts
// are reachable. Lets a repeat theme switch jump straight to its final style.
const styleProbeCache = new Map<string, boolean>();

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
  const fitBoundsTo = useStore((s) => s.fitBoundsTo);
  const basemap = useStore((s) => s.basemap);
  const terrain3d = useStore((s) => s.terrain3d);
  const themeId = useStore((s) => s.theme);
  const trips = useStore((s) => s.trips);
  const shownTripIds = useStore((s) => s.shownTripIds);
  const tripDraft = useStore((s) => s.tripDraft);
  const friendships = useStore((s) => s.friendships);
  const users = useStore((s) => s.users);
  const viewerId = useStore((s) => s.viewerId);

  const shownTrips = useMemo(
    () => visibleTrips(trips, friendships, viewerId).filter((t) => shownTripIds.has(t.id)),
    [trips, friendships, viewerId, shownTripIds]
  );
  const avatarsById = useMemo(
    () => new Map(users.map((u) => [u.id, u.avatarUrl])),
    [users]
  );

  const placingRef = useRef(placing);
  const onPickRef = useRef(onPick);
  const pinsRef = useRef<PinWithOwner[]>(visiblePins);
  const selectRef = useRef(selectPin);
  const selectedRef = useRef<string | null>(selectedPinId);
  const terrainRef = useRef(terrain3d);
  const themeRef = useRef(THEMES[themeId]);
  const tripsRef = useRef<{
    trips: Trip[];
    draft: { stops: TripStop[] } | null;
    avatars: Map<string, string>;
    viewerId: string;
  }>({ trips: shownTrips, draft: tripDraft, avatars: avatarsById, viewerId });
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
  tripsRef.current = { trips: shownTrips, draft: tripDraft, avatars: avatarsById, viewerId };

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

  // The thread: one line source stitching each shown trip's stops in order.
  // Re-added after every style swap (setStyle wipes sources/layers).
  function syncTripThreads(map: maplibregl.Map) {
    const { trips: shown, draft } = tripsRef.current;
    const features: GeoJSON.Feature[] = [];
    for (const t of shown) {
      if (t.stops.length < 2) continue;
      features.push({
        type: "Feature",
        properties: { color: "#80858f", dash: 1 },
        geometry: { type: "LineString", coordinates: t.stops.map((s) => [s.lng, s.lat]) },
      });
    }
    if (draft && draft.stops.length >= 2) {
      features.push({
        type: "Feature",
        properties: { color: themeRef.current.pinColor, dash: 1 },
        geometry: { type: "LineString", coordinates: draft.stops.map((s) => [s.lng, s.lat]) },
      });
    }
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
    try {
      const src = map.getSource(TRIPS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(fc);
      } else {
        map.addSource(TRIPS_SOURCE, { type: "geojson", data: fc });
        map.addLayer({
          id: "waypoint-trip-thread",
          type: "line",
          source: TRIPS_SOURCE,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2.4,
            "line-dasharray": [0.1, 2.2],
            "line-opacity": 0.95,
          },
        });
      }
    } catch {
      /* style mid-swap — the next style.load re-syncs */
    }
  }

  // Swapping styles while the previous one is still compiling corrupts
  // MapLibre's shader state ("Cannot read properties of undefined (reading
  // 'shaderPreludeCode')"). Two defenses: wait for the current style to settle,
  // and pass diff:false so MapLibre rebuilds the style from scratch instead of
  // diff-patching live shader programs (the diff path is what corrupts them
  // under the globe projection).
  function safeSetStyle(map: maplibregl.Map, style: maplibregl.StyleSpecification | string) {
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      try {
        map.setStyle(style, { diff: false });
      } catch {
        /* map busy or destroyed — skip */
      }
    };
    if (map.isStyleLoaded()) run();
    else {
      map.once("idle", run);
      setTimeout(run, 600);
    }
  }

  // Swap the basemap for the current mode+theme: satellite directly; "map" mode
  // goes STRAIGHT to the theme's online street style when we already know its
  // host is reachable (single swap — no bundled-globe flash in between). The
  // bundled themed globe is used only when the provider is unknown (first ever
  // switch, with an upgrade once probed) or known-unreachable.
  function applyBasemap(map: maplibregl.Map, mode: "map" | "satellite") {
    const seq = ++styleSeqRef.current;
    const theme = themeRef.current;
    if (mode === "satellite") {
      terrainBrokenRef.current = false; // DEM may load; error handler resets
      safeSetStyle(map, satelliteStyle());
      return;
    }
    const remote = theme.remoteStyle;
    const known = remote ? styleProbeCache.get(remote) : false;
    if (remote && known === true) {
      terrainBrokenRef.current = false;
      safeSetStyle(map, remote);
      return;
    }
    terrainBrokenRef.current = true; // bundled globe has no elevation data
    safeSetStyle(map, bundledWorldStyle(theme));
    if (!remote || known === false) return; // known unreachable — done
    fetch(remote, { mode: "cors" })
      .then((res) => {
        styleProbeCache.set(remote, res.ok);
        if (!res.ok) return;
        if (styleSeqRef.current !== seq) return; // user switched again
        terrainBrokenRef.current = false;
        safeSetStyle(map, remote);
      })
      .catch(() => {
        styleProbeCache.set(remote, false);
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

    // Runs once, on the first style that loads. (applyGlobeChrome and the
    // trip-thread layer re-apply on EVERY style.load — setStyle wipes them.)
    const initOnce = () => {
      applyGlobeChrome(map);
      syncTripThreads(map);
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
            styleProbeCache.set(remote, res.ok);
            if (!res.ok) return;
            if (styleSeqRef.current !== seq) return;
            terrainBrokenRef.current = false;
            safeSetStyle(map, remote);
          })
          .catch(() => {
            styleProbeCache.set(remote, false);
          });
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

    // Publish the viewport so features like "Top spots in this area" can rank
    // pins within what the user is actually looking at.
    const publishBounds = () => {
      const z = map.getZoom();
      try {
        if (z < 3.5) {
          useStore.getState().setViewBounds({ w: -180, s: -90, e: 180, n: 90, zoom: z });
        } else {
          const b = map.getBounds();
          useStore.getState().setViewBounds({
            w: b.getWest(),
            s: b.getSouth(),
            e: b.getEast(),
            n: b.getNorth(),
            zoom: z,
          });
        }
      } catch {
        /* ignore */
      }
    };

    map.on("moveend", () => {
      render();
      publishBounds();
    });
    map.on("zoomend", () => {
      render();
      scheduleRecenter();
    });
    map.once("load", publishBounds);
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
    render(); // recolor markers to the new theme immediately
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
          photo: coverUrl(p) ?? p.owner.avatarUrl,
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

  // Trips or draft changed → refresh the thread and the needle markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncTripThreads(map);
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownTrips, tripDraft]);

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

  // ---- Fit-bounds intent (country Focus) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitBoundsTo) return;
    try {
      map.fitBounds(
        [
          [fitBoundsTo.w, fitBoundsTo.s],
          [fitBoundsTo.e, fitBoundsTo.n],
        ],
        {
          padding: { top: 90, bottom: 110, left: 90, right: 90 },
          maxZoom: 8,
          bearing: 0,
          pitch: 0,
          duration: 1800,
          essential: true,
        }
      );
    } catch {
      /* degenerate bounds — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitBoundsTo?.nonce]);

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
    const container = map.getContainer();
    const cw = container.clientWidth;
    const ch = container.clientHeight;
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

    // Create-or-update a marker, then run the visibility gate: hide it when
    // its projection is garbage for this frame (NaN / wild off-screen — the
    // "random pins flickering in the corner" glitch) or, at globe scale, when
    // it falls outside the sphere's silhouette (beyond the horizon).
    const upsert = (
      key: string,
      lng: number,
      lat: number,
      content: HTMLDivElement,
      zIndex: string,
      onClick: ((ev: MouseEvent) => void) | null
    ) => {
      next.add(key);
      let marker = markersRef.current.get(key);
      if (marker) {
        // The marker's outer element belongs to MapLibre (it carries the
        // positioning transform); we only ever swap our content inside it.
        marker.getElement().replaceChildren(content);
        marker.setLngLat([lng, lat]);
      } else {
        const el = document.createElement("div");
        el.appendChild(content);
        marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.set(key, marker);
      }
      const element = marker.getElement();
      element.style.zIndex = zIndex;
      let visible = true;
      try {
        const mPx = map.project([lng, lat]);
        if (!Number.isFinite(mPx.x) || !Number.isFinite(mPx.y)) {
          visible = false;
        } else if (mPx.x < -150 || mPx.y < -150 || mPx.x > cw + 150 || mPx.y > ch + 150) {
          visible = false;
        } else if (silhouette) {
          const d = Math.hypot(mPx.x - silhouette.cx, mPx.y - silhouette.cy);
          visible = Number.isFinite(d) && d <= silhouette.r;
        }
      } catch {
        visible = false;
      }
      element.style.display = visible ? "" : "none";
      element.onclick = onClick;
    };

    // Teardrop pins, colored by the active theme. Clusters render as a
    // stacked pair of pins — no count badge.
    const pinColor = themeRef.current.pinColor;
    for (const c of clusters) {
      const props = c.properties as ClusterProps;
      const [lng, lat] = c.geometry.coordinates as [number, number];
      const key = props.cluster ? `c-${props.cluster_id}` : `p-${props.pinId}`;
      const selected = !props.cluster && props.pinId === selectedRef.current;
      const content = props.cluster
        ? teardropEl({ photo: props.photo, color: pinColor, height: 46, stacked: true, selected: false })
        : teardropEl({ photo: props.photo, color: pinColor, height: selected ? 50 : 38, stacked: false, selected });
      upsert(key, lng, lat, content, selected ? "5" : "1", (ev) => {
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
      });
    }

    // Trip stops: needle pins (round avatar head on a thin stick), stitched
    // together by the thread layer underneath.
    const tripState = tripsRef.current;
    for (const trip of tripState.trips) {
      const avatar = tripState.avatars.get(trip.userId);
      for (const stop of trip.stops) {
        upsert(
          `ts-${trip.id}-${stop.id}`,
          stop.lng,
          stop.lat,
          needleEl({ avatar, ghost: false }),
          "2",
          (ev) => ev.stopPropagation()
        );
      }
    }
    if (tripState.draft) {
      const avatar = tripState.avatars.get(tripState.viewerId);
      tripState.draft.stops.forEach((stop, i) => {
        upsert(
          `td-${i}`,
          stop.lng,
          stop.lat,
          needleEl({ avatar, ghost: true }),
          "4",
          (ev) => ev.stopPropagation()
        );
      });
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

// Trip-stop needle: a round head (the owner's profile picture) on a thin gray
// stick, tip planted on the location — like a sewing pin. Draft stops render
// slightly translucent until saved.
function needleEl(opts: { avatar?: string; ghost: boolean }): HTMLDivElement {
  const { avatar, ghost } = opts;
  const headSize = 26;
  const stickHeight = 20;
  const width = headSize + 4;
  const height = headSize + stickHeight;
  const wrap = document.createElement("div");
  wrap.className = "marker-in cursor-pointer select-none";
  wrap.style.cssText = `position:relative;width:${width}px;height:${height}px;opacity:${ghost ? 0.8 : 1};filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));`;

  const stick = document.createElement("div");
  stick.style.cssText = `position:absolute;left:50%;bottom:0;width:2.5px;height:${stickHeight + headSize / 2}px;transform:translateX(-50%);background:#585d66;border-radius:2px;`;
  wrap.appendChild(stick);

  const head = document.createElement("div");
  head.style.cssText = `position:absolute;left:50%;top:0;width:${headSize}px;height:${headSize}px;transform:translateX(-50%);border-radius:9999px;background-size:cover;background-position:center;background-color:#c65d3b;box-shadow:0 0 0 2px rgba(255,255,255,.95);`;
  if (avatar) head.style.backgroundImage = `url("${avatar}")`;
  wrap.appendChild(head);

  // The little specular highlight from the reference pin.
  const gleam = document.createElement("div");
  gleam.style.cssText = `position:absolute;left:calc(50% + ${Math.round(headSize * 0.16)}px);top:${Math.round(headSize * 0.16)}px;width:${Math.round(headSize * 0.24)}px;height:${Math.round(headSize * 0.24)}px;border-radius:9999px;background:rgba(255,255,255,.55);`;
  wrap.appendChild(gleam);
  return wrap;
}

// A classic teardrop map pin in the theme's color, with a small circular
// photo/avatar set into its head. Clusters draw a second pin peeking out
// behind — multiplicity without a number badge.
function teardropEl(opts: {
  photo?: string;
  color: string;
  height: number;
  stacked: boolean;
  selected: boolean;
}): HTMLDivElement {
  const { photo, color, height, stacked, selected } = opts;
  const width = Math.round(height * (24 / 34));
  const wrap = document.createElement("div");
  wrap.className = "marker-in cursor-pointer select-none";
  wrap.style.cssText = `position:relative;width:${width}px;height:${height}px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35));`;

  const teardrop = (dx: number, dy: number, opacity: string) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 34");
    svg.style.cssText = `position:absolute;inset:0;transform:translate(${dx}px,${dy}px);opacity:${opacity};overflow:visible;`;
    svg.innerHTML = `<path d="M12 33C12 33 23 20.6 23 11.8 23 5.8 18.1 1 12 1 5.9 1 1 5.8 1 11.8 1 20.6 12 33 12 33Z" fill="${color}" stroke="${selected ? "#ffffff" : "rgba(255,255,255,.92)"}" stroke-width="${selected ? 2.2 : 1.6}"/>`;
    return svg;
  };

  if (stacked) wrap.appendChild(teardrop(Math.round(width * 0.22), -Math.round(height * 0.08), "0.55"));
  wrap.appendChild(teardrop(0, 0, "1"));

  // Small photo icon set into the pin's head, deliberately scaled down.
  const iconSize = Math.round(width * 0.6);
  const icon = document.createElement("div");
  icon.style.cssText = `position:absolute;left:50%;top:${Math.round(height * 0.11)}px;width:${iconSize}px;height:${iconSize}px;transform:translateX(-50%);border-radius:9999px;background-size:cover;background-position:center;background-color:rgba(255,255,255,.4);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.9);`;
  if (photo) icon.style.backgroundImage = `url("${photo}")`;
  wrap.appendChild(icon);
  return wrap;
}
