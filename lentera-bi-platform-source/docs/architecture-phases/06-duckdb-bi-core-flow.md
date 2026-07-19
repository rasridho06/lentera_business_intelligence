> Part 6 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 6 - Phase 6: Universal ingestion and BI authoring

Focus: a user can import CSV, XLSX, or Parquet; create a physical table and virtual dataset; then publish a chart and dashboard without placing the full file in the browser.

## Branch rule

One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 6.0 - Upload boundary

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

- [ ] Create virtual SQL datasets from physical tables and existing virtual datasets.
- [ ] Persist dimensions, metrics, filters, display names, descriptions, owners, and contracts.
- [ ] Validate a virtual dataset against its source schema before publish.
- [ ] Reuse Phase 5 query validation and dependency capture; do not create a second query path.

## 6.3 - Chart and dashboard flow

- [ ] Build a chart from a selected dataset, dimensions, metrics, filters, and visualization type.
- [ ] Persist a chart definition, not raw query results or file snapshots.
- [ ] Add charts to dashboards and persist layout, filters, and dataset revision references.
- [ ] Reload and verify chart/dashboard behavior from persisted definitions.

## 6.4 - End-to-end verification

- [ ] Run CSV, XLSX, and Parquet import-to-table smoke tests.
- [ ] Run physical table-to-virtual dataset-to-chart-to-dashboard reload smoke tests.
- [ ] Test invalid extension/signature, size limit, malformed file, query error, and cleanup.
- [ ] Verify uploaded files, connector secrets, and raw result sets never enter browser responses.

## 6.5 - Handoff and review

- [ ] Run full tests, production build, and all three import paths.
- [ ] Review upload lifecycle, DuckDB boundary, query callers, revision events, chart definitions, and dashboard persistence.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

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