/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@rosillo/domain', '@rosillo/ai', '@rosillo/database'],
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
