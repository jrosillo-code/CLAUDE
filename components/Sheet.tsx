"use client";

import { useEffect } from "react";

// One sheet primitive: a bottom sheet on mobile, a floating right-side panel on
// desktop. Chrome stays minimal so the photography leads.
export default function Sheet({
  onClose,
  children,
}: {
  onClose: () => void;
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
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end sm:inset-y-0 sm:right-0 sm:items-stretch">
        <div className="animate-sheet pointer-events-auto flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-[22px] bg-paper shadow-float sm:m-4 sm:max-h-none sm:w-[380px] sm:rounded-[22px]">
          {children}
        </div>
      </div>
    </>
  );
}
