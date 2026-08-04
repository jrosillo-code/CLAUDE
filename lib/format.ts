const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parts(iso: string): { d: number; m: number; y: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { d, m, y };
}

/** "12–14 Feb 2025", "Feb 2025", or a single "4 Jan 2025". */
export function formatDates(start?: string, end?: string): string {
  if (!start) return "";
  const s = parts(start);
  if (!end || end === start) return `${s.d} ${MONTHS[s.m - 1]} ${s.y}`;
  const e = parts(end);
  if (s.y === e.y && s.m === e.m) return `${s.d}–${e.d} ${MONTHS[s.m - 1]} ${s.y}`;
  if (s.y === e.y) return `${s.d} ${MONTHS[s.m - 1]} – ${e.d} ${MONTHS[e.m - 1]} ${s.y}`;
  return `${s.d} ${MONTHS[s.m - 1]} ${s.y} – ${e.d} ${MONTHS[e.m - 1]} ${e.y}`;
}

/** Country code → English name via Intl ("PT" → "Portugal"). */
export function countryDisplayName(cc: string): string {
  if (!cc) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(cc.toUpperCase()) ?? cc;
  } catch {
    return cc;
  }
}
