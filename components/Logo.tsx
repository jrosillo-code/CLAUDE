// The Waypoint mark — "Waymark": a map pin with a compass rose cut clean out of
// its centre (true negative space via a mask, so the star shows whatever is
// behind the mark). One accent colour, crisp from a 96px hero down to a 16px
// favicon. app/icon.svg is the same drawing for the favicon.
export default function WaypointLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 5) / 4}
      viewBox="0 0 100 125"
      fill="none"
      aria-hidden
    >
      <defs>
        <mask id="wp-wm" maskUnits="userSpaceOnUse">
          <rect width="100" height="125" fill="#000" />
          {/* Pin body (shown) */}
          <path d="M50 120 C33 92 12 73 12 45 A38 38 0 1 1 88 45 C88 73 67 92 50 120 Z" fill="#fff" />
          {/* Compass rose (cut out) */}
          <path d="M50 21 L58.5 36.5 L74 45 L58.5 53.5 L50 69 L41.5 53.5 L26 45 L41.5 36.5 Z" fill="#000" />
        </mask>
      </defs>
      <rect width="100" height="125" fill="#c65d3b" mask="url(#wp-wm)" />
    </svg>
  );
}
