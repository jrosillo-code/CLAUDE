/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig = {
  transpilePackages: ['@rosillo/domain', '@rosillo/ai', '@rosillo/database'],
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
