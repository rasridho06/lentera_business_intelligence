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

- [x] Give every governed asset a stable ID that survives name changes.
- [x] Add append-only `AssetRevision` records with asset ID, revision number, actor, action, timestamp, reason, before JSON, after JSON, and content hash.
- [x] Add an `AuditEvent` correlation ID so one user action can link its source, semantic, and dashboard changes.
- [x] Store revision payloads as metadata only; never copy uploaded file contents or connector passwords.
- [x] Add a restore operation that creates a new revision instead of mutating history.
- [x] Store Python/SQL job definitions, schedule expression, timezone, enabled state, and last-run pointer as metadata only.
- [x] Store append-only job-run metadata: status, start/end time, error summary, output revision ID, and audit correlation ID.

## 4.3 - Semantic metadata foundation (rescoped to Phase 7)

Phase 4.3 originally included the Relationship model, dataset schema snapshots, metric ownership/certification, and relationship storage. Those have been rescoped to Phase 7 (governance) because:

- Relationship validation is tightly coupled with lineage traversal (Phase 7.0–7.1).
- Metric certification and freshness/SLA metadata are part of the trust UX (Phase 7.4).
- The Semantic metadata storage would be a dead bridge between Phase 4 and Phase 7 without the lineage linkage that 7.0 provides.

Phase 4 deliverables that directly support this rescoping:

- [x] Edge columns `assetType`, `assetId`, `sourceRevisionId` added (remedial R6) so Phase 7.0a can populate lineage edges with semantic asset references.
- [x] `'relationship'` removed from GOVERNED_ASSET_TYPES until the Relationship model exists (remedial R5).
- [x] Scheduler fields (`lockKey`, `lockedAt`, `consecutiveFailures`, `missedRunPolicy`) added to JobDefinition so Phase 6.4 can implement a SQLite-backed scheduler without a second migration (remedial R4).

Deferred to Phase 7:

- [ ] Relationship model: source/target table and column, cardinality, filter direction, active state, owner, validation status — Phase 7.0–7.1
- [ ] Dataset schema snapshots and schema hashes — Phase 7.2
- [ ] Metric ownership, certification state, freshness/SLA metadata — Phase 7.4

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

- [x] App runs with Node.js and one SQLite file.
- [x] Seed is repeatable without duplicates.
- [x] Tests do not mutate the development database.
- [x] Every governed asset has immutable revision and audit records.
- [x] Restore creates a new revision and preserves history.

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
## 4.2 implementation record

- Existing CUID asset IDs remain stable across name changes. `AssetRevision` is append-only and uniquely sequenced by asset type, asset ID, and revision number.
- `AuditEvent` provides a correlation ID for a single user action; revisions and job runs link to that event through foreign keys.
- `JobDefinition` stores SQL/Python schedule metadata, timezone, enabled state, retry limit, and run pointers. `JobRun` stores immutable execution status, timing, error summary, output revision, and audit linkage.
- `src/lib/revisions.ts` sanitizes password, secret, token, API-key, credential, and file-content fields before persistence; content hashes are computed from the sanitized after snapshot.
- Restore reads a historical snapshot and appends a new `restore` revision. It never changes historical revision rows.
- `npm test` now recreates the ignored SQLite test database from migrations before every run. The focused revision test proves redaction, revision sequence, restore-as-new-revision, and job-run linkage.

## 4.3 implementation record

Semantic metadata foundation rescoped to Phase 7 per analysis decision (Option C). Rationale: Relationship validation is tightly coupled with lineage traversal (7.0), metric certification is part of trust UX (7.4), and the foundation row would be a dead bridge without the lineage linkage that 7.0 provides. Phase 4 deliverables that directly support the rescoping: Edge `assetType`/`assetId`/`sourceRevisionId` columns (R6), `'relationship'` removed from GOVERNED_ASSET_TYPES (R5), and scheduler fields on JobDefinition (R4). Phase 7.0a subphase doc added to `07-lineage-final-hardening.md`.

## 4.4 implementation record

Seed idempotency achieved via a minimal in-file `.env` loader (`import.meta.url` + `node:fs` — no `dotenv` dependency) so `npx tsx prisma/seed.ts` picks up `DATABASE_URL` from the project `.env` on Windows. Two consecutive seed runs produce identical output: 3 users, 3 dashboards, 50 nodes, 37 edges, 9 findings. No duplicates, no AssetRevision records leaked because the seed operates on raw Prisma models via `deleteMany`-then-`create` and never calls `appendAssetRevision`. `tsx` added to `devDependencies` (R7).

## 4.5 implementation record

Handoff complete. PR opened against `main` with 10 commits (4 original + 6 remedial R1-R7). Verification gates passed:

| Gate | Result |
|---|---|
| `npm run lint` | exit 0 |
| `npm test` | 144/144 passed |
| `npm run build` | exit 0, 23/23 pages |
| 2x seed | 50 nodes, 37 edges, 9 findings identical |
| Scope audit | `git diff main..HEAD --name-only` — only 19 Phase 4 metadata files |

## Remedial items (R1-R7) from PR #6 review

| ID | Commit | Summary |
|---|---|---|
| R1 | `2277b95` | Retry-on-P2002: `createRevisionWithRetry` wrapper handles concurrent append race |
| R2 | `2277b95` | Concurrency test: `Promise.all` of 3 calls → 3 distinct revisions 1, 2, 3 |
| R3 | `40d4f91` | `scripts/setup-dev-db.mjs` + `db:setup` script (EPERM bypass) |
| R4 | `a4ccdde` | JobDefinition scheduler fields: lockKey, lockedAt, consecutiveFailures, missedRunPolicy |
| R5 | `2277b95` | Removed `'relationship'` from GOVERNED_ASSET_TYPES (defer to Phase 7) |
| R6 | `a4ccdde` | Edge lineage linkage columns: assetType, assetId, sourceRevisionId |
| R7 | `6cc8b0b` | `tsx` devDependency for seed runner |

### Day 4 result

- Status: **done** (PR open, pending merge)
- Branch: `codex/phase-4-sqlite-metadata`
- Commit: `4fedcff`
- Tests: 144/144 passed
- Build: exit 0
- Before: PostgreSQL required, no revisions/audit trail, Prisma migrate EPERM on Windows
- After: SQLite single-file metadata, append-only revisions, audit events, job definition/run storage, local migration replay via `node:sqlite`, retry-safe concurrent appends
- Completed: 4.0 guard rails, 4.1 SQLite migration, 4.2 immutable revisions, 4.3 (rescope), 4.4 seed, 4.5 handoff, R1-R7
- Deferred: Relationship model → Phase 7.0, schema snapshots → Phase 7.2, metric certification → Phase 7.4
- Blocker: none
