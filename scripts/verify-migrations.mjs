import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = join(root, 'database', 'migrations');
const lockPath = join(root, 'database', 'migrations.lock.json');
const locked = JSON.parse(await readFile(lockPath, 'utf8'));
const names = (await readdir(directory))
  .filter((name) => /^\d+_.+\.sql$/i.test(name))
  .sort();
const errors = [];

for (const name of names) {
  const content = await readFile(join(directory, name));
  const digest = createHash('sha256').update(content).digest('hex');
  if (!locked[name]) errors.push(`${name} is missing from migrations.lock.json`);
  else if (locked[name] !== digest) errors.push(`${name} was modified after being locked`);
}

for (const name of Object.keys(locked)) {
  if (!names.includes(name)) errors.push(`${name} is locked but missing from database/migrations`);
}

if (errors.length) {
  throw new Error(`PostgreSQL migration lock verification failed:\n- ${errors.join('\n- ')}`);
}

console.log(JSON.stringify({ status: 'ok', migrations: names }, null, 2));

