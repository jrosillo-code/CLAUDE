import { join } from 'node:path';
import { findRepoRoot } from '@rosillo/domain';
import { openDatabase, runMigrations } from '../client';
import { seedDatabase } from '../seed';

const handle = await openDatabase();
await runMigrations(handle);
const counts = await seedDatabase(handle.db, join(findRepoRoot(), 'fixtures'));
console.log(`Synthetic seed complete (driver: ${handle.driver}):`, counts);
await handle.close();
