import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Data-classification guard (spec section 13): refuse anything but SYNTHETIC. */
function assertSyntheticEnvironment() {
  const classification = process.env.DATA_CLASSIFICATION ?? 'SYNTHETIC';
  if (classification !== 'SYNTHETIC') {
    throw new Error(
      `DATA_CLASSIFICATION is "${classification}". This prototype only runs against SYNTHETIC data.`,
    );
  }
}

export function runMigrations(sqlite: Database.Database) {
  sqlite.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const applied = new Set(
    (sqlite.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name),
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
    })();
  }
}

export function openDatabase(path?: string): { db: Db; sqlite: Database.Database } {
  assertSyntheticEnvironment();
  const dbPath = path ?? process.env.DATABASE_PATH ?? './data/rosillo.db';
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  runMigrations(sqlite);
  return { db: drizzle(sqlite, { schema }), sqlite };
}

// Singleton for the web app (survives Next.js HMR reloads).
const globalRef = globalThis as unknown as { __rosilloDb?: { db: Db; sqlite: Database.Database } };

export function getDb(): Db {
  globalRef.__rosilloDb ??= openDatabase();
  return globalRef.__rosilloDb.db;
}
