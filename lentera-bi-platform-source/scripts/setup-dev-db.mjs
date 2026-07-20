import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ponytail: Prisma's migrate engine on Windows returns EPERM for some local
// setups. Bypass it by replaying migration SQL through Node's built-in SQLite
// runtime, exactly like setup-test-db.mjs does for the test database. Use
// `npm run db:setup` instead of `prisma migrate deploy` when the engine fails.

const prismaDir = resolve('prisma');
const devDb = join(prismaDir, 'lentera.db');
const migrationsDir = join(prismaDir, 'migrations');

if (existsSync(devDb)) {
  try {
    rmSync(devDb, { force: true, maxRetries: 5, retryDelay: 200 });
    console.log(`Replaced existing dev database at ${devDb}`);
  } catch (err) {
    console.error(
      `Could not remove ${devDb}. Stop any process that holds it ` +
      `(e.g. next dev, prisma studio, or a deployed standalone server) ` +
      `and re-run \`npm run db:setup\`. Original error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    process.exit(1);
  }
} else {
  console.log(`Creating dev database at ${devDb}`);
}

const database = new DatabaseSync(devDb);
for (const migration of readdirSync(migrationsDir).filter((name) => /^\d/.test(name)).sort()) {
  console.log(`Applying ${migration}`);
  database.exec(readFileSync(join(migrationsDir, migration, 'migration.sql'), 'utf8'));
}
database.close();
console.log('Dev database ready. Run `npm run dev` to use it.');