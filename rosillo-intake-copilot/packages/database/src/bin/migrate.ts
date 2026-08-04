import { openDatabase, runMigrations } from '../client';

const handle = await openDatabase();
const applied = await runMigrations(handle);
console.log(
  `Database ready (driver: ${handle.driver}). ` +
    (applied.length ? `Applied now: ${applied.join(', ')}` : 'No pending migrations.'),
);
await handle.close();
