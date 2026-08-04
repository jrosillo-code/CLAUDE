import { join, resolve } from 'node:path';
import { openDatabase } from '../client';
import { seedDatabase } from '../seed';

const { db, sqlite } = openDatabase();
const counts = seedDatabase(db, join(resolve(process.cwd()), 'fixtures'));
console.log('Synthetic seed complete:', counts);
sqlite.close();
