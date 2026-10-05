import { writeFile } from 'node:fs/promises';
import { seedDatabase } from '../../../frontend/src/data/seed.js';

const destination = new URL('../src/seed.json', import.meta.url);
await writeFile(destination, `${JSON.stringify(seedDatabase, null, 2)}\n`, 'utf8');
console.log(`Generated ${destination.pathname}`);
