import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const prismaDir = resolve('prisma');
const testDb = join(prismaDir, 'test.db');
const migrationsDir = join(prismaDir, 'migrations');

rmSync(testDb, { force: true });
const database = new DatabaseSync(testDb);
for (const migration of readdirSync(migrationsDir).filter((name) => /^\d/.test(name)).sort()) {
  database.exec(readFileSync(join(migrationsDir, migration, 'migration.sql'), 'utf8'));
}
database.close();