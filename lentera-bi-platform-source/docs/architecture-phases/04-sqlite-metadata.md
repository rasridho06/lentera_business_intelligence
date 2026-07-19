> Part 4 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 4 - Phase 4: Local SQLite metadata

Focus: local development needs Node.js and one SQLite file, not PostgreSQL.

## Branch rule
One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 4.0 - Guard rails and backup
- [ ] Record current schema and metadata tables.
- [ ] Back up required metadata.
- [ ] Confirm no production database is targeted.
- [ ] Ignore the SQLite file and local uploads.

## 4.1 - Datasource and migration
- [ ] Change Prisma provider to SQLite.
- [ ] Use `prisma/lentera.db`.
- [ ] Add credential-free `.env.example`.
- [ ] Create a migration from an empty database.
- [ ] Run Prisma generate.

## 4.2 - Relations and seed
- [ ] Review foreign keys and cascade behavior.
- [ ] Make seed deterministic and idempotent.
- [ ] Use stable IDs, upserts, and unique constraints.
- [ ] Separate test and development databases.

## 4.3 - Rebuild and verify
- [ ] Create an empty SQLite database and apply migrations.
- [ ] Run seed twice and verify no duplicates.
- [ ] Verify users, connectors, datasets, charts, dashboards, nodes, and edges.
- [ ] Open metadata-backed routes without PostgreSQL.

## 4.4 - Handoff and review
- [ ] Run empty migration, repeated seed, tests, and build.
- [ ] Review schema, migration, environment, and callers.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Definition of done
- [ ] App runs with Node.js and one SQLite file.
- [ ] Seed is repeatable without duplicates.
- [ ] Tests do not mutate the development database.
- [ ] Metadata routes work without PostgreSQL.

## Review focus
- Critical: migration can destroy data or target production. Use fresh local databases and destructive-command guards.
- High: credentials or SQLite files are staged. Fix ignore rules and validate staged files.
- High: relation/cascade rules create orphans. Add parent-delete tests.
- Medium: seed is not idempotent. Use stable IDs, upserts, and constraints.
- Low: README requires PostgreSQL. Update local setup.
