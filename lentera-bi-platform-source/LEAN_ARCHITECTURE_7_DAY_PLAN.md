# Lentera Lean Architecture: 7-Day Execution Plan

**Period:** 20-26 July 2026
**Rule:** one day, one phase, one measurable result.

## Target outcome

```text
login -> source/file -> dataset -> query -> chart -> dashboard -> table lineage
```

## Phases

1. [Day 1 - Runtime and baseline](docs/architecture-phases/01-runtime-baseline.md)
2. [Day 2 - Route-based application shell](docs/architecture-phases/02-route-based-shell.md)
3. [Day 3 - Client boundary and bundle](docs/architecture-phases/03-client-boundary-bundle.md)
4. [Day 4 - Local SQLite metadata](docs/architecture-phases/04-sqlite-metadata.md)
5. [Day 5 - Server query plane](docs/architecture-phases/05-server-query-plane.md)
6. [Day 6 - DuckDB and BI core flow](docs/architecture-phases/06-duckdb-bi-core-flow.md)
7. [Day 7 - Lineage and final hardening](docs/architecture-phases/07-lineage-final-hardening.md)

## Scope boundaries

- One Next.js application; no new microservices.
- SQLite for local metadata, DuckDB for analytics files, and ClickHouse as the first connector.
- Table-level lineage only; column-level lineage, Redis, workers, OpenLineage receiver, collaboration, and extra connectors are deferred.

## Branch lifecycle rules

1. One large phase equals one dedicated branch.
2. Start each phase from an up-to-date `main`.
3. After a phase PR is merged, checkout `main` and pull `main` before starting the next large phase.
4. Commit only work belonging to the active phase.
5. Keep unrelated local files, archives, backups, credentials, and other phase work out of the branch.

## Required daily routine

- Start with the phase branch, `git status`, and a short baseline.
- Finish with relevant tests, the full test suite, a production build, smoke tests, and before/after notes.
- Review the phase PR by priority: Critical, High, Medium, then Low.

## Daily report format

```markdown
### Day N result

- Status: done / partial / blocked
- Branch:
- Commit:
- Test:
- Build:
- Before:
- After:
- Completed:
- Deferred:
- Blocker:
```
