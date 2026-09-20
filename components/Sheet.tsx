"use client";

import { useEffect, useRef } from "react";

// Sheets stack: Escape closes only the one opened last, not all of them.
const openSheets: symbol[] = [];

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
  const panelRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<symbol | null>(null);
  if (!tokenRef.current) tokenRef.current = Symbol("sheet");

  useEffect(() => {
    const token = tokenRef.current!;
    openSheets.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openSheets[openSheets.length - 1] !== token) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = openSheets.indexOf(token);
      if (i >= 0) openSheets.splice(i, 1);
    };
  }, [onClose]);

  // Move focus into the sheet on open (so Tab starts inside it and a screen
  // reader announces the dialog), and hand it back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>('input, textarea, [href], button:not([aria-label="Close"]), [tabindex]:not([tabindex="-1"])');
      // A text field grabs the keyboard on phones, which is not what an
      // opening sheet should do; the panel itself takes focus instead.
      if (first && !(first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement)) first.focus({ preventScroll: true });
      else panel.focus({ preventScroll: true });
    }
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  // Keep Tab inside the sheet while it is open.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

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
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="animate-sheet pointer-events-auto flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-paper pb-[env(safe-area-inset-bottom)] shadow-float outline-none sm:m-4 sm:max-h-none sm:w-[380px] sm:rounded-[22px] sm:pb-0"
        >
          {children}
        </div>
      </div>
    </>
  );
}
