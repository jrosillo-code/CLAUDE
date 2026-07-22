"use client";

import { useState } from "react";
import MapCanvas from "./MapCanvas";
import TopBar from "./TopBar";
import LayerRail from "./LayerRail";
import BasemapToggle from "./BasemapToggle";
import PinSheet from "./PinSheet";
import AddPinSheet from "./AddPinSheet";
import EmptyHint from "./EmptyHint";
import { useStore } from "@/lib/store";
import { useVisiblePins } from "@/lib/hooks";
import { reverseGeocode } from "@/lib/geocode";

export default function MapApp() {
  const [placing, setPlacing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const startAddPin = useStore((s) => s.startAddPin);
  const addDraft = useStore((s) => s.addDraft);
  const selectedPinId = useStore((s) => s.selectedPinId);
  const visible = useVisiblePins();

  async function handlePick(lng: number, lat: number) {
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
    <div className="fixed inset-0 overflow-hidden bg-paper">
      <MapCanvas placing={placing} onPick={handlePick} />

      <TopBar />
      <LayerRail />
      <BasemapToggle />

      {/* Add-pin FAB */}
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

      {visible.length === 0 && !addDraft && <EmptyHint />}

      {selectedPinId && <PinSheet />}
      {addDraft && <AddPinSheet />}
    </div>
  );
}
