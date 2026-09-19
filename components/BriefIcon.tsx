// The field brief's own mark: a field notebook with a sun rising over its
// first line — rules, light, wind on one page. Distinct from the Focus
// crosshair and from the scout reticle on pins.
export function BriefIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v18" stroke="currentColor" strokeWidth="1.4" opacity=".5" />
      <path d="M11 15.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".6" />
      <path d="M11.5 11.5a2.5 2.5 0 0 1 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.5 11.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 6.5v1.2M16.8 7.6l-.8.8M11.2 7.6l.8.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
