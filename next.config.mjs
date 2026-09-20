/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Reference data under public/ (airports, stations, world lists, country
  // shapes) changes with a deploy, not per request: a day in the browser
  // cache, a week of stale-while-revalidate, so toggling an overlay a second
  // time never touches the network.
  async headers() {
    const cached = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/overlays/:path*", headers: cached },
      { source: "/geo/:path*", headers: cached },
      { source: "/lists/:path*", headers: cached },
    ];
  },
  images: {
    // Demo seed photography is served from Unsplash. Swap for Supabase Storage
    // signed URLs when the live backend is wired in.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
