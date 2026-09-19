// The field brief's own mark: a small quadcopter, so it never reads as the
// location finder (which keeps the crosshair) or the scout reticle on pins.
export function BriefIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="5" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="19" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="5" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="19" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
      <path d="M7 7l2.4 2.4M17 7l-2.4 2.4M7 17l2.4-2.4M17 17l-2.4-2.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
