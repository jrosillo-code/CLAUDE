// Where the site lives. Absolute links (share cards, Open Graph, the
// sitemap, invite links) all come from here. Set NEXT_PUBLIC_SITE_URL on the
// production project; previews fall back to their own Vercel address, and
// the browser falls back to wherever the page is actually running.

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/** The host people should type: "waypoint.app", never "localhost:3000". */
export function siteHost(): string {
  if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_SITE_URL) return window.location.host;
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "waypoint";
  }
}

/** An absolute URL on this site, from the browser when possible. */
export function absoluteUrl(path: string): string {
  const base = typeof window !== "undefined" && !process.env.NEXT_PUBLIC_SITE_URL ? window.location.origin : SITE_URL;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
