/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-only secrets never reach the client bundle; nothing here is NEXT_PUBLIC.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};
export default nextConfig;
