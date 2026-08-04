/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig = {
  transpilePackages: ['@rosillo/domain', '@rosillo/ai', '@rosillo/database'],
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  // The evaluation page reads the labelled fixtures from disk at runtime;
  // include them in the serverless bundle trace for Vercel.
  outputFileTracingIncludes: {
    '/evaluation': ['../../fixtures/**'],
  },
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
