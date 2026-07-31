// The Waypoint mark — "Horizon": a map pin holding a sunset over a single
// ridge. Pared to three shapes (sky, sun, hill) so it stays legible from a
// 96px hero down to a 16px favicon. Inline SVG so it's crisp at every size;
// app/icon.svg is the same drawing for the favicon.
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
        <clipPath id="wp-pin">
          <path d="M50 120 C33 92 12 73 12 45 A38 38 0 1 1 88 45 C88 73 67 92 50 120 Z" />
        </clipPath>
        <linearGradient id="wp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6b258" />
          <stop offset="1" stopColor="#df6f33" />
        </linearGradient>
      </defs>
      <g clipPath="url(#wp-pin)">
        {/* Sunset sky */}
        <rect width="100" height="125" fill="url(#wp-sky)" />
        {/* Sun */}
        <circle cx="50" cy="50" r="17" fill="#fbe9c0" />
        {/* Foreground ridge */}
        <path d="M0 80 C24 68 44 70 58 80 C72 90 86 86 100 76 L100 125 L0 125 Z" fill="#b8462a" />
      </g>
    </svg>
  );
}
