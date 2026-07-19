> Part 4 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 4 - Phase 4: Local metadata, revisions, and audit

Focus: local development needs Node.js and one SQLite file; every governed BI asset also needs a durable revision and audit trail.

## Branch rule

One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 4.0 - Guard rails and backup

- [x] Record the current Prisma schema and metadata tables.
- [x] Back up required local metadata; confirm no production database is targeted.
- [x] Ignore the SQLite file, uploads, and credential files.
- [x] Define the asset scope: connector, table, dataset, metric, relationship, chart, and dashboard.

## 4.1 - SQLite migration

- [x] Change the Prisma provider to SQLite and use `prisma/lentera.db`.
- [x] Add a credential-free `.env.example`.
- [x] Create a migration from an empty database and run Prisma generate.
- [x] Separate test and development database paths.

## 4.2 - Immutable asset revisions

- [ ] Give every governed asset a stable ID that survives name changes.
- [ ] Add append-only `AssetRevision` records with asset ID, revision number, actor, action, timestamp, reason, before JSON, after JSON, and content hash.
- [ ] Add an `AuditEvent` correlation ID so one user action can link its source, semantic, and dashboard changes.
- [ ] Store revision payloads as metadata only; never copy uploaded file contents or connector passwords.
- [ ] Add a restore operation that creates a new revision instead of mutating history.
- [ ] Store Python/SQL job definitions, schedule expression, timezone, enabled state, and last-run pointer as metadata only.
- [ ] Store append-only job-run metadata: status, start/end time, error summary, output revision ID, and audit correlation ID.

## 4.3 - Semantic metadata foundation

- [ ] Persist dataset schema snapshots and schema hashes.
- [ ] Persist metric definitions, ownership, certification state, and freshness/SLA metadata.
- [ ] Add relationship definition storage: source/target table and column, cardinality, filter direction, active state, and validation status.
- [ ] Use stable IDs, unique constraints, foreign keys, and explicit cascade rules.

## 4.4 - Seed and verification

- [ ] Make the seed deterministic and idempotent.
- [ ] Run the seed twice and prove no duplicates or revision rewrites.
- [ ] Rebuild an empty SQLite database and verify users, connectors, tables, datasets, metrics, relationships, charts, dashboards, nodes, edges, revisions, and audit events.
- [ ] Open metadata-backed routes without PostgreSQL.

## 4.5 - Handoff and review

- [ ] Run empty migration, repeated seed, tests, and build.
- [ ] Review migration safety, audit immutability, revision callers, environment files, and secret exposure.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Mandatory browser quality gate

Run this gate after every subphase that can affect runtime or user-visible behavior and again before merge. A successful build or an HTTP status alone is not browser validation.

1. Run `npm run lint`, `npm test`, and `npm run build` in that order.
2. Start the production runtime, sign in, and open every affected route in a real browser.
3. Confirm the sidebar and main content render together inside the viewport, then test the primary action, refresh, and Back/Forward navigation.
4. Fail the gate on an uncaught page error, React console error or warning, unexpected `4xx/5xx` response, missing runtime asset, blank page, or content rendered outside the viewport.
5. Save a screenshot of each affected primary route, then record the commands, route, interaction, console result, network result, and screenshot path in the implementation record or PR.
6. A PR cannot merge until lint, tests, build, and the authenticated browser smoke test pass. Until this flow is automated in CI, execute it manually and attach the evidence.

## Definition of done

- [ ] App runs with Node.js and one SQLite file.
- [ ] Seed is repeatable without duplicates.
- [ ] Tests do not mutate the development database.
- [ ] Every governed asset has immutable revision and audit records.
- [ ] Restore creates a new revision and preserves history.

## Review focus

- Critical: migration can destroy data or target production. Use fresh local databases and destructive-command guards.
- Critical: revisions contain file data or connector secrets. Store metadata and redacted snapshots only.
- High: an asset can be overwritten without actor, time, or before/after state. Write an append-only revision in the same transaction.
- High: restore rewrites history. Restore by appending a new revision.
- Medium: seed is not idempotent. Use stable IDs, upserts, and constraints.
- Low: README requires PostgreSQL. Update local setup.

## 4.0 implementation record

- Current schema baseline: Prisma `postgresql` provider with `DATABASE_URL`; 20 models are present: `Node`, `Edge`, `Finding`, `CanonicalMetric`, `BuildRun`, `Connector`, `DataSourceTable`, `Dashboard`, `Dataset`, `Chart`, `MetricDef`, `MetricSource`, `ChartMetric`, `Transform`, `User`, `Activity`, `CollaborationSession`, `DashboardBranch`, `MergeRequest`, and `ApiLog`.
- Local metadata backup check: no `db/` directory or SQLite database exists in the working tree, so there is no local metadata file to copy. No production connection was opened or targeted.
- Repository guard check: `.gitignore` already excludes `db/`, `upload/`, `*.db`, `*.db-journal`, and `.env` credential files.
- Phase 4 governed asset scope is fixed to connector, table, dataset, metric, relationship, chart, and dashboard. Existing lineage-only `Node`/`Edge` records remain compatibility data until the later migration subphases.
- No provider, schema, migration, or runtime code was changed in 4.0; those changes are intentionally deferred to 4.1.
## 4.1 implementation record

- Prisma now uses the SQLite provider. Development uses `file:./lentera.db` (resolved under `prisma/`); Vitest forces the separate `file:./test.db` path.
- Replaced the PostgreSQL initial migration with `prisma/migrations/20260719100000_init_sqlite/migration.sql`, generated from an empty schema. Prisma Client generation completed successfully.
- The migration SQL was applied to a disposable SQLite test file and all 132 tests passed against it. The temporary database was removed after validation.
- Production build passed. No production database URL was used for migration or tests.
- The Windows Prisma schema-engine executable returned `EPERM` for `migrate deploy`; the generated migration itself was validated with Node's built-in SQLite runtime until the local engine permission issue is resolved.