> Part 5 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 5 - Phase 5: Secure query plane and virtual datasets

Focus: queries and virtual datasets execute on the server, have bounded results, and carry explicit dependency metadata.

## Branch rule

One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 5.0 - Query boundary

- [ ] Inventory every browser-side SQL or database call.
- [ ] Define a single authenticated server query contract with timeout, row limit, byte limit, and structured error response.
- [ ] Reject non-read-only SQL for preview and virtual dataset execution.
- [ ] Keep database credentials and full result sets on the server.

## 5.1 - Source adapters

- [ ] Add a ClickHouse adapter behind the server contract.
- [ ] Use allowlisted connector IDs and server-side stored credentials only.
- [ ] Quote identifiers and bind values; reject unknown tables and columns.
- [ ] Return bounded JSON rows plus schema and query diagnostics.

## 5.2 - Virtual SQL datasets

- [ ] Persist virtual dataset SQL, source asset IDs, output schema snapshot, owner, and revision ID.
- [ ] Validate SQL before save and resolve direct dependencies.
- [ ] Reject circular virtual dataset references.
- [ ] Revalidate a virtual dataset when an upstream schema or relationship changes.
- [ ] Label dependency precision as column-level only when parsing is confident; otherwise retain a table-level edge.

## 5.3 - Semantic contracts and preview

- [ ] Add contracts for column existence, type, nullability, uniqueness, freshness, and accepted values.
- [ ] Run a bounded preview and contract check before publish.
- [ ] Return machine-readable failures: missing column, incompatible type, stale source, or join ambiguity.
- [ ] Persist validation outcome as an audit-linked revision event.

## 5.4 - Handoff and review

- [ ] Test unauthorized calls, invalid SQL, unknown identifiers, timeout, row limit, virtual dataset cycle, and contract failure.
- [ ] Run full tests and production build.
- [ ] Review authentication, SQL construction, secret boundaries, dependency extraction, and revision callers.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Definition of done

- [ ] Browser never receives database credentials or unbounded result sets.
- [ ] Virtual datasets are SQL-backed, versioned, and dependency-aware.
- [ ] Bad SQL and contract violations return actionable structured errors.
- [ ] Upstream changes trigger virtual dataset revalidation.

## Review focus

- Critical: query endpoint accepts arbitrary writes or exposes credentials. Enforce read-only operations and server-side secrets.
- Critical: untrusted identifier reaches generated SQL. Allowlist metadata and quote identifiers.
- High: virtual dataset can reference itself or form a cycle. Reject the save with a dependency path.
- High: schema change bypasses contract validation. Trigger validation from the revision workflow.
- Medium: result payload has no bound. Enforce row, byte, and timeout limits.
- Low: unsupported SQL dependency is presented as precise lineage. Label it table-level/unknown.