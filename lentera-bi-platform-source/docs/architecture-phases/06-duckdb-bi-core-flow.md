> Part 6 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 6 - Phase 6: Universal ingestion and BI authoring

Focus: a user can import CSV, XLSX, or Parquet; create a physical table and virtual dataset; then publish a chart and dashboard without placing the full file in the browser.

## Branch rule

One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 6.0 - Upload boundary

Phase 4 and Phase 5 provide the foundation this phase extends:

- **Scheduler schema already ready** — Phase 4 R4 added `lockKey`, `lockedAt`, `consecutiveFailures`, and `missedRunPolicy` to `JobDefinition`. The Phase 6.4 scheduler runner can lock and claim the next runnable job with a single indexed scan on `(enabled, nextRunAt, lockKey)` without a separate migration.
- **Preview sandbox coexistence** — The Phase 5a server-side query contract and the Phase 5.0 browser `sql.js` sandbox both accept CSV input. Clarify the boundary:
  - Browser sandbox: ad-hoc preview, in-memory, no credentials, bounded to 10 000 rows / 5 MB. Not publishable.
  - DuckDB ingestion (this phase): server-side, produces a versioned `DataSourceTable` asset with schema hash, linked to a `source-file` revision. The result flows through the Phase 5b virtual dataset pipeline and into charts/dashboards.

- [ ] Support CSV, XLSX, and Parquet through one server-side upload contract.
- [ ] Enforce file size, file count, MIME/signature, extension, row, and disk-lifetime limits.
- [ ] Store uploads under generated IDs in a Git-ignored directory; never trust a client filename or path.
- [ ] Hash each upload and create an immutable source-file revision.

## 6.1 - DuckDB table ingestion

- [ ] Use DuckDB on the server to inspect and query each supported file type.
- [ ] Create a physical table asset with schema profile, row count, sample, source-file revision, and schema hash.
- [ ] Return bounded previews only; never send the full file or unbounded table to the browser.
- [ ] Record type inference warnings and allow a user-approved type override revision.

## 6.2 - Dataset and semantic authoring

- [ ] Create virtual SQL or Python datasets from physical tables and existing virtual datasets.
- [ ] Persist dimensions, metrics, filters, display names, descriptions, owners, and contracts.
- [ ] Validate a virtual dataset against its source schema before publish.
- [ ] Reuse Phase 5 query validation and dependency capture; do not create a second query path.

## 6.3 - Chart and dashboard flow

- [ ] Build a chart from a selected dataset, dimensions, metrics, filters, and visualization type.
- [ ] Persist a chart definition, not raw query results or file snapshots.
- [ ] Add charts to dashboards and persist layout, filters, and dataset revision references.
- [ ] Reload and verify chart/dashboard behavior from persisted definitions.

## 6.4 - Scheduled refresh

- [ ] Persist cron expression, timezone, enabled state, retry policy, and next-run time for SQL/Python dataset jobs.
- [ ] Run one scheduler process that reads active jobs from SQLite, applies a per-job lock, and records every run.
- [ ] Create a new output revision on success; preserve the previous output and record structured failure on error.
- [ ] Run CSV, XLSX, and Parquet import-to-table smoke tests.
- [ ] Run physical table-to-virtual dataset-to-chart-to-dashboard reload smoke tests.
- [ ] Test invalid extension/signature, size limit, malformed file, query error, and cleanup.
- [ ] Verify uploaded files, connector secrets, and raw result sets never enter browser responses.

## 6.5 - End-to-end verification

- [ ] Run full tests, production build, all three import paths, and one scheduled SQL/Python refresh.
- [ ] Review upload lifecycle, DuckDB boundary, query callers, revision events, scheduler locks/retries, chart definitions, and dashboard persistence.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## 6.6 - Handoff and review

- [ ] Review the complete Phase 6 implementation and prepare the PR handoff.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Mandatory browser quality gate

Run this gate after every subphase that can affect runtime or user-visible behavior and again before merge. A successful build or an HTTP status alone is not browser validation.

1. Run `npm run lint`, `npm test`, and `npm run build` in that order.
2. Start the production runtime, sign in, and open every affected route in a real browser.
3. Confirm the sidebar and main content render together inside the viewport, then test the primary action, refresh, and Back/Forward navigation.
4. Fail the gate on an uncaught page error, React console error or warning, unexpected `4xx/5xx` response, missing runtime asset, blank page, or content rendered outside the viewport.
5. Save screenshots of the import, dataset, chart, and dashboard flow, then record the commands, route, interaction, console result, network result, and screenshot path in the implementation record or PR.
6. A PR cannot merge until lint, tests, build, and the authenticated browser smoke test pass. Until this flow is automated in CI, execute it manually and attach the evidence.

## Definition of done

- [ ] CSV, XLSX, and Parquet import works through DuckDB.
- [ ] Every imported file becomes a versioned physical table asset.
- [ ] A physical or virtual dataset can become a persisted chart and dashboard.
- [ ] Dashboard stores definitions and revision references, never raw snapshots.
- [ ] Full files and connector secrets never load into browser memory.

## Review focus

- Critical: upload path traversal, arbitrary file read, or raw file response. Use generated IDs, directory checks, and server-only storage.
- Critical: upload/query can exhaust memory or disk. Enforce size, row, result, and cleanup limits.
- High: chart stores raw data or bypasses dataset revisions. Persist definitions and source revision references only.
- High: CSV, XLSX, and Parquet use different validation rules. Use the shared ingestion contract.
- Medium: inferred schema is silently wrong. Store profiling evidence and require an explicit override revision.
- Low: dashboard disappears after reload. Persist before reporting UI success.
