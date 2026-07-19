> Part 6 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 6 - Phase 6: DuckDB and BI core flow

Focus: complete the file-to-dashboard flow without loading full files into the browser.

## Branch rule
One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 6.0 - Upload boundary
- [ ] Add DuckDB server-side; support CSV first.
- [ ] Enforce file size/count limits.
- [ ] Store uploads in a Git-ignored directory.
- [ ] Generate internal storage IDs and validate type/extension.
- [ ] Never trust user filenames or paths.

## 6.1 - Schema and preview
- [ ] Detect column names/types server-side.
- [ ] Store metadata in SQLite, never file contents.
- [ ] Return bounded previews.
- [ ] Quote identifiers and reject unknown fields.
- [ ] Bound temporary-file lifetime.

## 6.2 - Query and chart
- [ ] Execute DuckDB through the Phase 5 server contract.
- [ ] Remove browser-side sql.js and unused PapaParse.
- [ ] Persist dataset, dimensions, metrics, filters, and visualization type.
- [ ] Do not add new chart types.

## 6.3 - Dashboard persistence
- [ ] Add charts to dashboards.
- [ ] Persist definition and placement before reporting success.
- [ ] Reload and verify the chart remains.
- [ ] Add an end-to-end smoke test.

## 6.4 - Handoff and review
- [ ] Test upload, preview, query, chart, dashboard, reload, invalid files, size limits, and cleanup.
- [ ] Review upload boundary, file lifecycle, results, and persistence callers.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Definition of done
- [ ] Full files never load into browser memory.
- [ ] CSV analysis works through DuckDB.
- [ ] Dataset becomes a chart and persists in a dashboard.
- [ ] Dashboard stores definitions, not raw snapshots.

## Review focus
- Critical: upload path traversal/arbitrary file read. Use server storage IDs and directory-boundary checks.
- Critical: upload/query exhausts memory or disk. Enforce size, row, result, and cleanup limits.
- High: chart stores raw data. Persist definitions only.
- High: preview/chart use different rules. Use one server-side query builder.
- Medium: CSV schema is not validated. Store schema, quote identifiers, reject unknown fields.
- Low: dashboard disappears after reload. Persist before UI success.
