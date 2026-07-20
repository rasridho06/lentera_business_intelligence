> Part 5 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 5 - Phase 5: Secure query plane and virtual datasets

Focus: queries and virtual datasets execute on the server, have bounded results, and carry explicit dependency metadata.

## Branch rule

One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 5.0 - Query boundary

- [x] Inventory every browser-side SQL or database call.
- [x] Define a single authenticated server execution contract for SQL and Python with timeout, memory/row/byte limits, and structured error responses.
- [x] Reject non-read-only SQL for preview and virtual dataset execution.
- [x] Keep database credentials, Python runtime access, and full result sets on the server.

### Phase 4 foundation

The query plane relies on the Phase 4 SQLite metadata store (`lentera.db`) and its Prisma schema:

- **Connector + DataSourceTable models**: store allowed data sources — use `connectorId` allowlisting to bound every query.
- **AssetRevision + AuditEvent**: every virtual dataset save and contract validation outcome is persisted as an audit-linked revision event.
- **JobDefinition + JobRun**: stores schedule metadata and execution history; the Phase 6.4 scheduler runner will lock and claim jobs via the `lockKey`/`lockedAt` columns added in R4.
- **Edge lineage linkage columns** (`assetType`, `assetId`, `sourceRevisionId`): nullable in Phase 4; Phase 7.0a will populate them when the lineage workflow ties semantic revisions to graph edges.

### Subphase split (scope decision)

Phase 5 is split into three manageable PRs to keep each diff reviewable:

- **5a — Read-only SQL contract + ClickHouse adapter** (subphases 5.0 + 5.1): ✅ done — authenticated server query contract, allowlisted connector IDs, server-side credentials, identifier quoting, bounded JSON rows, timeout/row/byte limits, structured error responses.
- **5b — Virtual SQL/Python datasets** (subphase 5.2): persist dataset code + language + dependencies + schema snapshot + owner + revision ID, validate SQL before save, cycle detection, revalidation on upstream schema change, dependency precision labeling.
- **5c — Contracts and preview** (subphase 5.3): column existence/type/nullability/uniqueness/freshness contracts, bounded preview + contract check before publish, machine-readable structured failures, audit-linked revision on validation outcome.

### 5a implementation record

- `src/lib/query/contract.ts` — shared types: `QueryRequest`, `QueryResponse`, `QueryError` with 12 machine-readable error codes. Hard defaults: timeout 30s (max 60s), rows 1k (max 10k), bytes 1MB (max 10MB).
- `src/lib/query/sql-validator.ts` — keyword-based read-only gate (SELECT/WITH/EXPLAIN/DESCRIBE/SHOW only), table reference extraction from FROM/JOIN, allowlist enforcement. Upgrade path comment for sqlglot if column-precise lineage is needed.
- `src/lib/query/clickhouse.ts` — ClickHouse HTTP adapter (port 8123 native interface, no client library dep). Basic Auth, TabSeparatedWithNamesAndTypes format, AbortController timeout.
- `src/app/api/query/execute/route.ts` — POST /api/query/execute. Resolves connector from SQLite metadata, builds table allowlist from DataSourceTable rows, validates SQL, executes through adapter, returns bounded response.
- `src/__tests__/query-execute.test.ts` — 25 tests covering SQL validator + route handler (missing fields, unknown connector, non-read-only, table not in allowlist, limit clamping). 169/169 total tests pass with zero regressions.
- Branch: `codex/phase-5a-query-contract`

### Browser preview sandbox (sql.js carve-out)

The `/query` route hosts a browser-only SQLite preview sandbox via `sql.js`. The carve-out from the auth-protected query plane is explicit and limited.

- **Asset**: `public/sql-wasm-browser.wasm` (served without authentication via proxy matcher carve-out; exact path only).
- **Allowed data source**: a single CSV the user explicitly uploads into the sandbox; no credentials, no connectors, no file system reads.
- **In-memory only**: one `SQL.Database` instance per `/query` tab; dropped when the component unmounts or a new file is uploaded.
- **Bounds**: reject a CSV whose headers exceed 100 characters, contain control characters, or whose parsed rows exceed 10 000 or 5 MB — return a structured `Parse error` without creating the table.
- **Forbidden**: connector credentials, upstream queries, sending sandbox rows to the server, exposure in the publish / chart / dataset flows. The sandbox is for ad-hoc preview, not for producing governed BI assets.
- **Auth gate**: the proxy still protects `/query` itself; only `sql-wasm-browser.wasm` (exact path) is excluded so the engine can bootstrap before the session is established.

## 5.1 - Source adapters

- [x] Add a ClickHouse adapter behind the server contract.
- [x] Use allowlisted connector IDs and server-side stored credentials only.
- [x] Quote identifiers and bind values; reject unknown tables and columns.
- [x] Return bounded JSON rows plus schema and query diagnostics.

## 5.2 - Virtual SQL datasets

- [ ] Persist virtual dataset SQL or Python code, language, source asset IDs, output schema snapshot, owner, and revision ID.
- [ ] Validate SQL before save and resolve direct dependencies.
- [ ] Run Python only in a server-side sandbox with an allowlisted runtime and packages; never execute arbitrary request code in the Next.js process.
- [ ] Reject circular virtual dataset references.
- [ ] Revalidate a virtual dataset when an upstream schema or relationship changes.
- [ ] Label dependency precision as column-level only when parsing is confident; otherwise retain a table-level edge.

## 5.3 - Semantic contracts and preview

- [ ] Add contracts for column existence, type, nullability, uniqueness, freshness, and accepted values.
- [ ] Run a bounded preview and contract check before publish.
- [ ] Return machine-readable failures: missing column, incompatible type, stale source, join ambiguity, timeout, memory limit, or Python runtime error.
- [ ] Persist validation outcome as an audit-linked revision event.

## 5.4 - Handoff and review

- [ ] Test unauthorized calls, invalid SQL, unknown identifiers, timeout, row limit, virtual dataset cycle, and contract failure.
- [ ] Run full tests and production build.
- [ ] Review authentication, SQL construction, secret boundaries, dependency extraction, and revision callers.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Mandatory browser quality gate

Run this gate after every subphase that can affect runtime or user-visible behavior and again before merge. A successful build or an HTTP status alone is not browser validation.

1. Run `npm run lint`, `npm test`, and `npm run build` in that order.
2. Start the production runtime, sign in, and open every affected route in a real browser.
3. Confirm the sidebar and main content render together inside the viewport, then test the primary action, refresh, and Back/Forward navigation.
4. Fail the gate on an uncaught page error, React console error or warning, unexpected `4xx/5xx` response, missing runtime asset, blank page, or content rendered outside the viewport.
5. Save screenshots of every affected primary route and `/query`, then record the commands, route, interaction, console result, network result, and screenshot path in the implementation record or PR.
6. A PR cannot merge until lint, tests, build, and the authenticated browser smoke test pass. Until this flow is automated in CI, execute it manually and attach the evidence.

## Definition of done

- [ ] Browser never receives database credentials or unbounded result sets. (5a)
- [ ] Virtual datasets are SQL- or Python-backed, versioned, and dependency-aware. (5b)
- [ ] Bad SQL and contract violations return actionable structured errors. (5a + 5c)
- [ ] Upstream changes trigger virtual dataset revalidation. (5b)
- [x] Browser preview sandbox (sql.js carve-out) contract documented and enforced in code. (hygiene patch PR #6)

## Review focus

- Critical: query endpoint accepts arbitrary writes or exposes credentials. Enforce read-only operations and server-side secrets.
- Critical: untrusted identifier reaches generated SQL. Allowlist metadata and quote identifiers.
- High: virtual dataset can reference itself or form a cycle. Reject the save with a dependency path.
- High: schema change bypasses contract validation. Trigger validation from the revision workflow.
- Medium: result payload has no bound. Enforce row, byte, and timeout limits.
- Low: unsupported SQL dependency is presented as precise lineage. Label it table-level/unknown.
