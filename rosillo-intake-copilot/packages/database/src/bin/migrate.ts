import { openDatabase } from '../client';

const { sqlite } = openDatabase();
const applied = sqlite.prepare('SELECT name FROM _migrations ORDER BY name').all() as { name: string }[];
console.log(`Database ready. Applied migrations: ${applied.map((m) => m.name).join(', ') || 'none'}`);
sqlite.close();
