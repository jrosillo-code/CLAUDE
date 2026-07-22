// The Waypoint mark: a map pin holding a sunset over mountains, with a road
// winding home. Inline SVG so it stays crisp at every size; app/icon.svg is
// the same drawing for the favicon.
export default function WaypointLogo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 5) / 4}
      viewBox="0 0 120 150"
      fill="none"
      aria-hidden
    >
      <defs>
        <clipPath id="wp-pin">
          <path d="M60 146 C43 119 12 93 12 57 a48 48 0 1 1 96 0 C108 93 77 119 60 146 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#wp-pin)">
        {/* Sunset bands */}
        <rect width="120" height="150" fill="#ef8322" />
        <circle cx="60" cy="68" r="56" fill="#f5993a" />
        <circle cx="60" cy="68" r="41" fill="#f9ae55" />
        {/* Sun */}
        <circle cx="60" cy="64" r="19" fill="#fbe9c0" />
        {/* Back ridge */}
        <path d="M4 100 L30 66 L41 75 L60 50 L81 72 L94 61 L118 98 L118 150 L4 150 Z" fill="#2d3a53" />
        {/* Foreground hill */}
        <path d="M2 150 L2 106 C30 90 52 92 70 104 C88 116 104 108 118 96 L118 150 Z" fill="#212c40" />
        {/* Winding road */}
        <path
          d="M59 148 C53 130 73 123 65 108 C59 97 71 91 66 80 C64 74 68 69 71 65"
          stroke="#fdfaf4"
          strokeWidth="8.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
