"use client";

import { useState } from "react";
import MapCanvas from "./MapCanvas";
import TopBar from "./TopBar";
import LayerRail from "./LayerRail";
import BasemapToggle from "./BasemapToggle";
import PinSheet from "./PinSheet";
import AddPinSheet from "./AddPinSheet";
import CreatorsPanel from "./CreatorsPanel";
import FriendsPanel from "./FriendsPanel";
import ActivityPanel from "./ActivityPanel";
import TripsPanel from "./TripsPanel";
import TripGuidePanel from "./TripGuidePanel";
import TripDraftBar from "./TripDraftBar";
import TopSpotsPanel from "./TopSpotsPanel";
import LandmarkCard from "./LandmarkCard";
import EmptyHint from "./EmptyHint";
import { useStore } from "@/lib/store";
import { useVisiblePins } from "@/lib/hooks";
import { reverseGeocode } from "@/lib/geocode";

export default function MapApp() {
  const [placing, setPlacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [creatorsOpen, setCreatorsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [topSpotsOpen, setTopSpotsOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [guideTripId, setGuideTripId] = useState<string | null>(null);
  const trips = useStore((s) => s.trips);
  const startAddPin = useStore((s) => s.startAddPin);
  const tripDraft = useStore((s) => s.tripDraft);
  const mapMode = useStore((s) => s.mapMode);
  const setMapMode = useStore((s) => s.setMapMode);
  const addTripStop = useStore((s) => s.addTripStop);
  const addDraft = useStore((s) => s.addDraft);
  const selectedPinId = useStore((s) => s.selectedPinId);
  const visible = useVisiblePins();
  const guideTrip = guideTripId ? trips.find((t) => t.id === guideTripId) ?? null : null;

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
    });
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-paper"
      style={{ height: "100dvh", width: "100vw" }}
    >
      <MapCanvas placing={placing || !!tripDraft} onPick={handlePick} />

      <TopBar
        onOpenCreators={() => setCreatorsOpen(true)}
        onOpenActivity={() => setActivityOpen(true)}
        tripsActive={mapMode === "trips"}
        onOpenTrips={() => {
          setMapMode("trips");
          setTripsOpen(true);
        }}
      />
      {mapMode === "pins" && <LayerRail onOpenFriends={() => setFriendsOpen(true)} />}

      {/* Trips-mode banner: trips are their own map — exit back to pins */}
      {mapMode === "trips" && (
        <div className="fixed left-1/2 top-16 z-30 -translate-x-1/2 sm:top-20">
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
        className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-paper/90 px-4 py-2.5 text-sm font-medium shadow-float backdrop-blur transition-colors hover:bg-paper"
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
        className={`fixed bottom-6 right-4 z-30 h-14 w-14 rounded-full shadow-float grid place-items-center transition-colors ${
          placing ? "bg-ink text-paper" : "bg-accent text-paper"
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={placing ? "rotate-45 transition-transform" : "transition-transform"}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
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

      {visible.length === 0 && !addDraft && mapMode === "pins" && <EmptyHint />}

      {mapMode === "pins" && !selectedPinId && <LandmarkCard />}
      {selectedPinId && <PinSheet />}
      {addDraft && <AddPinSheet />}
      {creatorsOpen && <CreatorsPanel onClose={() => setCreatorsOpen(false)} />}
      {friendsOpen && <FriendsPanel onClose={() => setFriendsOpen(false)} />}
      {activityOpen && <ActivityPanel onClose={() => setActivityOpen(false)} />}
      {topSpotsOpen && <TopSpotsPanel onClose={() => setTopSpotsOpen(false)} />}
      {tripsOpen && (
        <TripsPanel onClose={() => setTripsOpen(false)} onOpenGuide={setGuideTripId} />
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
