import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Locates the monorepo root by walking up from cwd until the synthetic
 * fixtures directory is found. Lets the web app (cwd apps/web) and the CLI
 * scripts (cwd repo root) share the same database file and fixtures.
 */
export function findRepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'fixtures', 'emails')) && existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}
