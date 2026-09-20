// Plain helpers shared by the app and the server-rendered /world pages —
// no React here, so a server component can import them.

/** The label every list surface carries so it never poses as a friend's tip. */
export const LIST_HONESTY = "From public rankings — not from anyone you know.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "May–Oct", "Dec–Mar", "All year", or a short list for scattered months. */
export function monthsLabel(months: number[]): string {
  if (!months.length) return "All year";
  const m = [...new Set(months)].sort((a, b) => a - b);
  if (m.length === 12) return "All year";
  // find the longest circular run
  const set = new Set(m);
  let bestStart = m[0], bestLen = 0;
  for (const start of m) {
    let len = 0;
    while (len < 12 && set.has(((start - 1 + len) % 12) + 1)) len++;
    if (len > bestLen) { bestLen = len; bestStart = start; }
  }
  if (bestLen === m.length && bestLen > 1) return `${MONTHS[bestStart - 1]}–${MONTHS[((bestStart - 1 + bestLen - 1) % 12)]}`;
  return m.map((x) => MONTHS[x - 1]).join(", ");
}
