"use client";

import { useEffect, useRef, useState } from "react";
import MapCanvas from "./MapCanvas";
import { preloadStars } from "./ConstellationBackdrop";
import TopBar from "./TopBar";
import LayerRail from "./LayerRail";
import BasemapToggle from "./BasemapToggle";
import PinSheet from "./PinSheet";
import AddPinSheet from "./AddPinSheet";
import CreatorsPanel from "./CreatorsPanel";
import FriendsPanel from "./FriendsPanel";
import TravelersSheet from "./TravelersSheet";
import PinFeed from "./PinFeed";
import ActivityPanel from "./ActivityPanel";
import TripsPanel from "./TripsPanel";
import TripGuidePanel from "./TripGuidePanel";
import TripDraftBar from "./TripDraftBar";
import TopSpotsPanel from "./TopSpotsPanel";
import LandmarkCard from "./LandmarkCard";
import { useStore } from "@/lib/store";
import { reverseGeocode } from "@/lib/geocode";
import { cancelFlightRender } from "@/lib/renderFlight";

export default function MapApp() {
  const [placing, setPlacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [creatorsOpen, setCreatorsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [travelersOpen, setTravelersOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [topSpotsOpen, setTopSpotsOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [guideTripId, setGuideTripId] = useState<string | null>(null);
  // Phones: the trip whose route is on screen — powers the floating guide button.
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  // Set in the same tick as a View-route tap: that panel close must NOT exit
  // trips mode (the whole point is showing the threaded route on the map).
  const viewRouteJustTappedRef = useRef(false);
  const trips = useStore((s) => s.trips);
  const startAddPin = useStore((s) => s.startAddPin);
  const tripDraft = useStore((s) => s.tripDraft);
  const mapMode = useStore((s) => s.mapMode);
  const setMapMode = useStore((s) => s.setMapMode);
  const addTripStop = useStore((s) => s.addTripStop);
  const addDraft = useStore((s) => s.addDraft);
  const selectedPinId = useStore((s) => s.selectedPinId);
  const flightRecording = useStore((s) => s.flightRecording);
  const flightProgress = useStore((s) => s.flightProgress);
  const guideTrip = guideTripId ? trips.find((t) => t.id === guideTripId) ?? null : null;

  // Phones: when a trip draft ends, land somewhere sensible — the trips panel
  // if it was saved (see the new route), the pins map if it was abandoned.
  const hadDraftRef = useRef(false);
  const tripsAtDraftStartRef = useRef(0);
  useEffect(() => {
    if (tripDraft && !hadDraftRef.current) tripsAtDraftStartRef.current = trips.length;
    const had = hadDraftRef.current;
    hadDraftRef.current = !!tripDraft;
    if (had && !tripDraft && window.innerWidth < 640) {
      if (trips.length > tripsAtDraftStartRef.current) setTripsOpen(true);
      else setMapMode("pins");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripDraft, trips.length]);

  // Warm the Me-page backdrop (geo fetch + star sampling) while the map idles,
  // so tapping the avatar opens the profile with its constellation ready.
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(preloadStars, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(preloadStars, 2500);
    return () => clearTimeout(t);
  }, []);

  async function handlePick(lng: number, lat: number) {
    // Trip-planning mode: every map tap is a new stop on the thread.
    if (tripDraft) {
      const geo = await reverseGeocode(lng, lat);
      addTripStop({ lng, lat, placeName: geo.placeName });
      return;
    }
    setPlacing(false);
    setResolving(true);
    const geo = await reverseGeocode(lng, lat);
    setResolving(false);
    startAddPin({
      lng,
      lat,
      placeName: geo.placeName,
      countryCode: geo.countryCode,
      region: geo.region,
    });
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-paper"
      style={{ height: "100dvh", width: "100vw" }}
    >
      <MapCanvas placing={placing || !!tripDraft} onPick={handlePick} />

      <TopBar
        onOpenActivity={() => setActivityOpen(true)}
        onOpenFeed={() => setFeedOpen(true)}
        tripsActive={mapMode === "trips"}
        onOpenTrips={() => {
          setMapMode("trips");
          setTripsOpen(true);
        }}
      />
      {mapMode === "pins" && (
        <LayerRail
          onOpenFriends={() => setFriendsOpen(true)}
          onOpenCreators={() => setCreatorsOpen(true)}
          onOpenTravelers={() => setTravelersOpen(true)}
          onOpenTrips={() => {
            setMapMode("trips");
            setTripsOpen(true);
          }}
        />
      )}

      {/* Trips-mode banner: trips are their own map — exit back to pins */}
      {/* Desktop only — phones exit trips mode by closing the panel instead */}
      {mapMode === "trips" && (
        <div className="fixed left-1/2 top-16 z-30 -translate-x-1/2 max-sm:hidden sm:top-20">
          <button
            onClick={() => setMapMode("pins")}
            className="animate-fade flex items-center gap-2 rounded-full bg-ink/90 px-4 py-2 text-sm text-paper shadow-float backdrop-blur"
          >
            <span className="font-medium">Trips</span>
            <span className="text-paper/60">— showing routes only</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
      <BasemapToggle />

      {/* Top spots in this area */}
      {!tripDraft && mapMode === "pins" && (
      <button
        onClick={() => setTopSpotsOpen(true)}
        className="fixed z-30 flex items-center gap-1.5 rounded-full bg-paper/90 px-4 py-2.5 text-sm font-medium shadow-float backdrop-blur transition-colors hover:bg-paper max-sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:px-3 max-sm:py-2 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-accent">
          <path d="M12 2.5c1 3.4 2.2 5 5.5 5.5-3.3.5-4.5 2.1-5.5 5.5-1-3.4-2.2-5-5.5-5.5 3.3-.5 4.5-2.1 5.5-5.5z" fill="currentColor" />
          <path d="M18.5 13c.6 2 1.3 2.9 3 3.2-1.7.3-2.4 1.2-3 3.2-.6-2-1.3-2.9-3-3.2 1.7-.3 2.4-1.2 3-3.2z" fill="currentColor" opacity=".7" />
        </svg>
        Top spots
      </button>
      )}

      {tripDraft && <TripDraftBar />}

      {/* Add-pin FAB */}
      {!tripDraft && mapMode === "pins" && (
      <button
        onClick={() => setPlacing((p) => !p)}
        aria-label={placing ? "Cancel placing pin" : "Add a pin"}
        className={`fixed z-30 grid place-items-center rounded-full shadow-float transition-colors max-sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] max-sm:right-3 max-sm:h-12 max-sm:w-12 sm:bottom-6 sm:right-4 sm:h-14 sm:w-14 ${
          placing ? "bg-ink text-paper" : "bg-accent text-paper"
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={placing ? "rotate-45 transition-transform" : "transition-transform"}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      )}

      {/* Offline film render: full-screen cover — the camera is jumping frame
          by frame underneath, which is not a show anyone should watch. */}
      {flightProgress != null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-paper/85 backdrop-blur-xl">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="animate-pulse text-accent">
            <path
              d="M21 15.5v-2.2l-8-5V3.6a1.5 1.5 0 0 0-3 0v4.7l-8 5v2.2l8-2.4v4.9l-2.1 1.6v1.7l3.6-1.1 3.6 1.1v-1.7L13 18v-4.9z"
              fill="currentColor"
            />
          </svg>
          <div className="font-display text-xl">Rendering your flight film…</div>
          <div className="h-1.5 w-64 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.round(flightProgress * 100)}%` }}
            />
          </div>
          <div className="tnum text-sm text-ink-3">{Math.round(flightProgress * 100)}%</div>
          <button
            onClick={() => cancelFlightRender()}
            className="rounded-full bg-paper-2 px-5 py-2 text-sm font-medium text-ink-2 ring-1 ring-line"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Flight-film recording indicator (realtime fallback path) */}
      {flightRecording && (
        <div className="fixed left-1/2 top-16 z-30 flex -translate-x-1/2 animate-fade items-center gap-2 rounded-full bg-ink/90 px-4 py-2 text-sm text-paper shadow-float backdrop-blur sm:top-20">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          Recording your flight film — touching the map cancels
        </div>
      )}

      {/* Placing hint banner */}
      {placing && (
        <div className="fixed left-1/2 top-20 z-30 -translate-x-1/2 animate-fade rounded-full bg-ink/90 px-4 py-2 text-sm text-paper shadow-float backdrop-blur">
          Tap the map to drop your pin
        </div>
      )}
      {resolving && (
        <div className="fixed left-1/2 top-20 z-30 -translate-x-1/2 animate-fade rounded-full bg-ink/90 px-4 py-2 text-sm text-paper shadow-float">
          Finding that place…
        </div>
      )}

      {mapMode === "pins" && !selectedPinId && <LandmarkCard />}
      {selectedPinId && <PinSheet />}
      {addDraft && <AddPinSheet />}
      {creatorsOpen && <CreatorsPanel onClose={() => setCreatorsOpen(false)} />}
      {friendsOpen && <FriendsPanel onClose={() => setFriendsOpen(false)} />}
      {travelersOpen && (
        <TravelersSheet
          onClose={() => setTravelersOpen(false)}
          onOpenFriends={() => setFriendsOpen(true)}
          onOpenCreators={() => setCreatorsOpen(true)}
        />
      )}
      {feedOpen && <PinFeed onClose={() => setFeedOpen(false)} />}
      {activityOpen && <ActivityPanel onClose={() => setActivityOpen(false)} />}
      {topSpotsOpen && <TopSpotsPanel onClose={() => setTopSpotsOpen(false)} />}
      {tripsOpen && (
        <TripsPanel
          onClose={() => {
            setTripsOpen(false);
            // Phones have no trips-mode banner — closing the panel is the exit.
            // Exceptions: a draft just started (map takes stops) or View route
            // was tapped (map shows the threaded route) — both need trips mode.
            if (
              window.innerWidth < 640 &&
              !useStore.getState().tripDraft &&
              !viewRouteJustTappedRef.current
            ) {
              setMapMode("pins");
            }
            viewRouteJustTappedRef.current = false;
          }}
          onOpenGuide={setGuideTripId}
          onViewRoute={(id) => {
            viewRouteJustTappedRef.current = true;
            setActiveTripId(id);
          }}
        />
      )}

      {/* Phones, trips mode: the AI route guide waits behind one small button
          instead of popping over the freshly framed route. */}
      {mapMode === "trips" && activeTripId && !guideTripId && !tripsOpen && (
        <button
          onClick={() => setGuideTripId(activeTripId)}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink/90 px-4 py-2.5 text-sm font-semibold text-paper shadow-float backdrop-blur sm:hidden"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-2">
            <path d="M12 2.5c1 3.4 2.2 5 5.5 5.5-3.3.5-4.5 2.1-5.5 5.5-1-3.4-2.2-5-5.5-5.5 3.3-.5 4.5-2.1 5.5-5.5z" fill="currentColor" />
          </svg>
          Route guide
        </button>
      )}
      {guideTrip && (
        <TripGuidePanel
          trip={guideTrip}
          onClose={() => setGuideTripId(null)}
          onBack={() => {
            setGuideTripId(null);
            setTripsOpen(true);
          }}
        />
      )}
    </div>
  );
}
