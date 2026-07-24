"use client";

import { useEffect } from "react";

// One sheet primitive: a bottom sheet on mobile, a floating side panel on
// desktop (right by default; Trips docks left, by its launcher in the rail).
// Chrome stays minimal so the photography leads.
export default function Sheet({
  onClose,
  side = "right",
  children,
}: {
  onClose: () => void;
  side?: "right" | "left";
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Scrim only on mobile — desktop keeps the map interactive. */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ink/20 sm:hidden"
      />
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex sm:inset-y-0 sm:items-stretch ${
          side === "left" ? "justify-start sm:left-0" : "justify-end sm:right-0"
        }`}
      >
        {/* dvh, not vh: on iOS Safari vh is the large viewport, so an 86vh
            sheet overflowed the visible area and clipped its own header. */}
        <div className="animate-sheet pointer-events-auto flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-paper shadow-float sm:m-4 sm:max-h-none sm:w-[380px] sm:rounded-[22px]">
          {children}
        </div>
      </div>
    </>
  );
}
