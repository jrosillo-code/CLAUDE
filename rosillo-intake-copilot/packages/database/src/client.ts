import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { findRepoRoot } from '@rosillo/domain';
import * as schema from './schema';

/**
 * Postgres-dialect database client (ADR-0006) with two interchangeable drivers:
 *
 * - `DATABASE_URL=postgres://…`  → node-postgres pool (Supabase in production).
 *   Migrations are NOT auto-run — apply them explicitly with `npm run db:migrate`.
 * - otherwise                    → PGlite, an in-process Postgres, persisted at
 *   `DATABASE_PATH` (default ./data/pgdata) or in memory (`:memory:`).
 *   Migrations auto-apply on open so local dev and tests stay zero-setup.
 *
 * PGlite is single-process: stop the dev server before running db:seed.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseHandle {
  db: Db;
  driver: 'postgres' | 'pglite';
  /** Multi-statement raw SQL (simple query protocol) — used by the migration runner. */
  execRaw(sqlText: string): Promise<void>;
  close(): Promise<void>;
}

function assertSyntheticEnvironment() {
  const classification = process.env.DATA_CLASSIFICATION ?? 'SYNTHETIC';
  if (classification !== 'SYNTHETIC') {
    throw new Error(
      `DATA_CLASSIFICATION is "${classification}". This prototype only runs against SYNTHETIC data.`,
    );
  }
}

// Resolved from the repo root (not import.meta.url) because the Next.js bundler
// relocates this module; the SQL files always live at this source path.
function migrationsDir(): string {
  const fromRoot = join(findRepoRoot(), 'packages', 'database', 'src', 'migrations');
  if (existsSync(fromRoot)) return fromRoot;
  return join(dirname(fileURLToPath(import.meta.url)), 'migrations');
}

export async function runMigrations(handle: Pick<DatabaseHandle, 'db' | 'execRaw'>): Promise<string[]> {
  const { db, execRaw } = handle;
  await execRaw('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const appliedRows = (await db.execute(sql.raw('SELECT name FROM _migrations'))) as unknown as {
    rows: Array<{ name: string }>;
  };
  const applied = new Set(appliedRows.rows.map((r) => r.name));
  const dir = migrationsDir();
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(join(dir, file), 'utf8');
    // Migration bodies are multi-statement: run them via the simple query
    // protocol; record the application separately.
    await execRaw('BEGIN;\n' + body + '\nCOMMIT;');
    await db.execute(
      sql`INSERT INTO _migrations (name, applied_at) VALUES (${file}, ${new Date().toISOString()})`,
    );
    newlyApplied.push(file);
  }
  return newlyApplied;
}

async function openPostgres(url: string): Promise<DatabaseHandle> {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const pg = await import('pg');
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const pool = new pg.default.Pool({
    connectionString: url,
    max: 5,
    // Supabase poolers require TLS; the pooler certificate chain is not in the
    // default trust store, so verification is relaxed (prototype-acceptable).
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema }) as unknown as Db;
  return {
    db,
    driver: 'postgres',
    execRaw: async (sqlText: string) => {
      await pool.query(sqlText); // no params → simple protocol, multi-statement OK
    },
    close: () => pool.end(),
  };
}

async function openPglite(path: string): Promise<DatabaseHandle> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  let dataDir = path;
  if (dataDir !== ':memory:') {
    if (!isAbsolute(dataDir)) dataDir = resolve(findRepoRoot(), dataDir);
    mkdirSync(dirname(dataDir), { recursive: true });
  }
  const client = dataDir === ':memory:' ? new PGlite() : new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as Db;
  const execRaw = async (sqlText: string) => {
    await client.exec(sqlText);
  };
  await runMigrations({ db, execRaw }); // zero-setup for local dev and tests
  return {
    db,
    driver: 'pglite',
    execRaw,
    close: () => client.close(),
  };
}

export async function openDatabase(pathOrUrl?: string): Promise<DatabaseHandle> {
  assertSyntheticEnvironment();
  const url = pathOrUrl ?? process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) return openPostgres(url);
  return openPglite(pathOrUrl ?? process.env.DATABASE_PATH ?? './data/pgdata');
}

/** Deletes a persisted PGlite data directory (test/e2e resets). */
export function destroyPgliteDir(path: string) {
  const dir = isAbsolute(path) ? path : resolve(findRepoRoot(), path);
  rmSync(dir, { recursive: true, force: true });
}

// Singleton for the web app (survives Next.js HMR reloads).
const globalRef = globalThis as unknown as { __rosilloDb?: Promise<DatabaseHandle> };

export function getDb(): Promise<Db> {
  globalRef.__rosilloDb ??= openDatabase();
  return globalRef.__rosilloDb.then((h) => h.db);
}
