> Part 5 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 5 - Phase 5: Server query plane

Focus: warehouse queries execute safely on the server.

## Branch rule
One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 5.0 - Contract and auth boundary
- [ ] Define one query endpoint and response fields: `columns`, `rows`, `rowCount`, `truncated`, `durationMs`, `error`.
- [ ] Validate input at the trust boundary.
- [ ] Resolve session and connector ownership before execution.
- [ ] Keep credentials server-side.

## 5.1 - Read-only guard
- [ ] Allow one read-only statement.
- [ ] Reject writes and multi-statement input.
- [ ] Apply default/max row limits and timeout.
- [ ] Sanitize errors and redact connection details.

## 5.2 - ClickHouse connector
- [ ] Implement ClickHouse as the first connector.
- [ ] Query ClickHouse directly; never copy warehouse tables to SQLite.
- [ ] Ensure connection strings never appear in responses or logs.
- [ ] Connect the SQL editor to the endpoint.

## 5.3 - Tests and handoff
- [ ] Test valid reads, rejected writes, multi-statements, limits, timeout, ownership, and redaction.
- [ ] Review endpoint, connector caller, auth boundary, and logs.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Definition of done
- [ ] SQL editor uses the server endpoint.
- [ ] ClickHouse executes a real read query.
- [ ] Browser receives bounded results.
- [ ] Writes and multi-statements are rejected.
- [ ] No Redis or worker is added.

## Review focus
- Critical: raw write or multi-statement SQL executes. Enforce single read-only validation.
- Critical: credentials appear in browser/logs/errors. Enforce server-only secrets and redaction.
- High: no row limit or timeout. Apply both to every request.
- High: connector ownership is not checked. Enforce session permissions.
- Medium: raw database errors reach clients. Map to a stable contract.
- Low: response omits truncation or duration. Always return rowCount, truncated, and durationMs.
