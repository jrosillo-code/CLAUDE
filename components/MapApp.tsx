"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import MapCanvas from "./MapCanvas";
// Panels that open on a tap, not on load: each arrives the first time it is
// opened, so the map is interactive sooner on a phone.
const CreatorsPanel = dynamic(() => import("./CreatorsPanel"), { ssr: false });
const FriendsPanel = dynamic(() => import("./FriendsPanel"), { ssr: false });
const TravelersSheet = dynamic(() => import("./TravelersSheet"), { ssr: false });
const PinFeed = dynamic(() => import("./PinFeed"), { ssr: false });
const ActivityPanel = dynamic(() => import("./ActivityPanel"), { ssr: false });
const TripGuidePanel = dynamic(() => import("./TripGuidePanel"), { ssr: false });
const TopSpotsPanel = dynamic(() => import("./TopSpotsPanel"), { ssr: false });
const DispatchPlayer = dynamic(() => import("./DispatchPlayer"), { ssr: false });
const CrossingsPanel = dynamic(() => import("./CrossingsPanel"), { ssr: false });
const FieldBriefPanel = dynamic(() => import("./FieldBriefPanel"), { ssr: false });
const AskPanel = dynamic(() => import("./AskPanel"), { ssr: false });
const ReflectionSheet = dynamic(() => import("./ReflectionSheet"), { ssr: false });
import { preloadStars } from "./ConstellationBackdrop";
import TopBar from "./TopBar";
import LayerRail from "./LayerRail";
import BasemapToggle from "./BasemapToggle";
import PinSheet from "./PinSheet";
import AddPinSheet from "./AddPinSheet";
import TripsPanel from "./TripsPanel";
import TripDraftBar from "./TripDraftBar";
import LandmarkCard from "./LandmarkCard";
import ListPlaceCard from "./ListPlaceCard";
import DispatchStrip from "./DispatchStrip";
import OverlayCard from "./OverlayCard";
import SearchPlaceCard from "./SearchPlaceCard";
import { searchPlaces } from "@/lib/geocode";
import GuidedStart from "./GuidedStart";
import { useStore } from "@/lib/store";
import { reverseGeocode } from "@/lib/geocode";

export default function MapApp() {
  const [placing, setPlacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [creatorsOpen, setCreatorsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [travelersOpen, setTravelersOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [crossingsOpen, setCrossingsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [topSpotsOpen, setTopSpotsOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  // Ask-your-friends: null = closed; a string (possibly empty) opens the panel
  // with that question pre-asked.
  const [askQuestion, setAskQuestion] = useState<string | null>(null);
  // The 60-second post-trip debrief, opened after "Mark trip completed" or
  // from a trip card's debrief button.
  const [debriefTripId, setDebriefTripId] = useState<string | null>(null);
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
  const briefTarget = useStore((s) => s.briefTarget);
  const openBrief = useStore((s) => s.openBrief);
  const setSearchedPlace = useStore((s) => s.setSearchedPlace);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectedPinId = useStore((s) => s.selectedPinId);
  const flightRecording = useStore((s) => s.flightRecording);
  const flightProgress = useStore((s) => s.flightProgress);
  const [dispatchUser, setDispatchUser] = useState<string | null>(null);
  const guideTrip = guideTripId ? trips.find((t) => t.id === guideTripId) ?? null : null;

  // When a trip draft ends, land somewhere sensible: saving reopens the
  // trips panel (see the new route in the list); abandoning it on a phone
  // returns to the pins map (desktop keeps the trips banner to exit).
  const hadDraftRef = useRef(false);
  const tripsAtDraftStartRef = useRef(0);
  useEffect(() => {
    if (tripDraft && !hadDraftRef.current) tripsAtDraftStartRef.current = trips.length;
    const had = hadDraftRef.current;
    hadDraftRef.current = !!tripDraft;
    if (had && !tripDraft) {
      if (trips.length > tripsAtDraftStartRef.current) setTripsOpen(true);
      else if (window.innerWidth < 640) setMapMode("pins");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripDraft, trips.length]);

  // Deep links. ?pin=<id> opens that pin and flies to it; ?trip=<id> shows
  // that route. The URL follows the open pin so a refresh keeps it and the
  // address bar can be shared; closing the pin clears it.
  const selectPin = useStore((s) => s.selectPin);
  const pins = useStore((s) => s.pins);
  const linkedRef = useRef<{ pin: string | null; trip: string | null } | null>(null);
  if (linkedRef.current === null && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    linkedRef.current = { pin: params.get("pin"), trip: params.get("trip") };
  }
  useEffect(() => {
    const linked = linkedRef.current;
    if (!linked?.pin) return;
    const pin = pins.find((p) => p.id === linked.pin);
    if (!pin) return;
    linked.pin = null;
    requestFlyTo(pin.lng, pin.lat, 9, { flat: true });
    selectPin(pin.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.length]);
  useEffect(() => {
    const linked = linkedRef.current;
    if (!linked?.trip) return;
    const trip = trips.find((t) => t.id === linked.trip);
    if (!trip) return;
    linked.trip = null;
    setMapMode("trips");
    setActiveTripId(trip.id);
    setTripsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips.length]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("fly")) return; // consumed by the effect below
    if (selectedPinId) url.searchParams.set("pin", selectedPinId);
    else url.searchParams.delete("pin");
    if (mapMode === "trips" && activeTripId) url.searchParams.set("trip", activeTripId);
    else url.searchParams.delete("trip");
    const next = url.pathname + (url.search ? url.search : "") + url.hash;
    const cur = window.location.pathname + window.location.search + window.location.hash;
    if (next !== cur) window.history.replaceState(window.history.state, "", next);
  }, [selectedPinId, mapMode, activeTripId]);

  // Arriving from a /fly/{cc} page ("add a field report on the map"): frame
  // the country, land its search card, and open the brief. The param is
  // consumed once and dropped from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cc = params.get("fly");
    if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return;
    const code = cc.toUpperCase();
    window.history.replaceState(window.history.state, "", window.location.pathname);
    let name = code;
    try {
      name = new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
    } catch {
      /* older engines: search by code */
    }
    let cancelled = false;
    searchPlaces(name)
      .then((results) => {
        if (cancelled) return;
        const hit = results.find((r) => r.kind === "place" && r.countryCode === code) ?? results[0];
        if (!hit) return;
        requestFlyTo(hit.lng, hit.lat, Math.min(hit.zoom, 5), { flat: true });
        setSearchedPlace({ name: hit.placeName, lat: hit.lat, lng: hit.lng, countryCode: code });
        openBrief({ lat: hit.lat, lng: hit.lng, placeName: hit.placeName, countryCode: code, origin: "fly" });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Declutter: after twelve seconds without a pointer, touch or key, the
  // map's chrome dims to a whisper; any movement brings it straight back.
  // The clock only starts after the first interaction — someone who has
  // just arrived and is looking at the map keeps the search bar and their
  // avatar at full strength until they touch something. Sheets and cards are
  // not chrome, so whatever is open stays fully visible.
  useEffect(() => {
    let timer: number | null = null;
    const wake = () => {
      document.body.removeAttribute("data-idle");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => document.body.setAttribute("data-idle", "1"), 12000);
    };
    const events: (keyof WindowEventMap)[] = ["pointermove", "pointerdown", "touchstart", "keydown", "wheel"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      if (timer) window.clearTimeout(timer);
      document.body.removeAttribute("data-idle");
    };
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
        onOpenCrossings={() => setCrossingsOpen(true)}
        onAsk={(question) => setAskQuestion(question)}
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
          onOpenTopSpots={() => setTopSpotsOpen(true)}
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
            onClick={() => void import("@/lib/renderFlight").then((m) => m.cancelFlightRender())}
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

      {/* Dispatches: who in your circle is on the road right now */}
      {mapMode === "pins" && !tripDraft && !selectedPinId && <DispatchStrip onOpen={(id) => setDispatchUser(id)} />}
      {dispatchUser && <DispatchPlayer userId={dispatchUser} onClose={() => setDispatchUser(null)} />}
      {mapMode === "pins" && !selectedPinId && <LandmarkCard />}
      {mapMode === "pins" && !selectedPinId && <ListPlaceCard />}
      {mapMode === "pins" && !selectedPinId && <OverlayCard />}
      {mapMode === "pins" && !selectedPinId && <SearchPlaceCard />}
      {selectedPinId && <PinSheet />}
      {addDraft && <AddPinSheet />}
      {briefTarget && <FieldBriefPanel />}
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
      {crossingsOpen && <CrossingsPanel onClose={() => setCrossingsOpen(false)} />}
      {askQuestion !== null && (
        <AskPanel initialQuestion={askQuestion} onClose={() => setAskQuestion(null)} />
      )}
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
          onOpenDebrief={setDebriefTripId}
        />
      )}
      {debriefTripId && (
        <ReflectionSheet tripId={debriefTripId} onClose={() => setDebriefTripId(null)} />
      )}
      {/* First-use checklist — completes itself from real actions, dismissible */}
      {!tripDraft && !selectedPinId && <GuidedStart />}

      {/* Phones, trips mode: a bottom row — back to the trips list, the AI
          route guide behind one small button, and a way OUT of trips mode
          (the desktop banner is hidden on phones, so without this the map
          was stuck showing routes only). */}
      {mapMode === "trips" && !tripDraft && !guideTripId && !tripsOpen && (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 sm:hidden" data-testid="trips-mobile-bar">
          <button
            onClick={() => setTripsOpen(true)}
            aria-label="Back to trips"
            className="flex items-center gap-1.5 rounded-full bg-paper/90 px-3.5 py-2.5 text-sm font-semibold text-ink shadow-float backdrop-blur"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Trips
          </button>
          {activeTripId && (
            <button
              onClick={() => setGuideTripId(activeTripId)}
              className="flex items-center gap-1.5 rounded-full bg-ink/90 px-4 py-2.5 text-sm font-semibold text-paper shadow-float backdrop-blur"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-2">
                <path d="M12 2.5c1 3.4 2.2 5 5.5 5.5-3.3.5-4.5 2.1-5.5 5.5-1-3.4-2.2-5-5.5-5.5 3.3-.5 4.5-2.1 5.5-5.5z" fill="currentColor" />
              </svg>
              Route guide
            </button>
          )}
          <button
            onClick={() => setMapMode("pins")}
            aria-label="Exit trips"
            title="Back to the pins map"
            data-testid="trips-exit"
            className="grid h-10 w-10 place-items-center rounded-full bg-paper/90 text-ink shadow-float backdrop-blur"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
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
