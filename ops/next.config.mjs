import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app lives inside a larger repo with its own lockfile; trace from here.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // Server-only secrets never reach the client bundle; nothing here is NEXT_PUBLIC.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};
export default nextConfig;
