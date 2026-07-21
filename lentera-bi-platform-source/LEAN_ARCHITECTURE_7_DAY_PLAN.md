# Lentera Lean Architecture: 7-Day Execution Plan

**Period:** 20-26 July 2026
**Rule:** one day, one phase, one measurable result.
**Status:** ✅ COMPLETE — all 7 phases merged to `main`.

## Target outcome

```text
CSV/XLSX/Parquet -> physical table -> SQL/Python dataset -> semantic model -> chart -> dashboard
                                      |
                                      +-> scheduled refresh -> output revision
                                  |                                      |
                                  +-> revision/audit -> contracts -> relationship manager -> lineage -> impact
```

Lentera is not only a BI builder. It is a change-safe BI workspace: every semantic change is attributable, validated, impact-scored, and recoverable before it silently breaks a dashboard.

## Phases

1. ✓ [Day 1 - Runtime and baseline](docs/architecture-phases/01-runtime-baseline.md) — merged PR #2
2. ✓ [Day 2 - Route-based application shell](docs/architecture-phases/02-route-based-shell.md) — merged PR #3
3. ✓ [Day 3 - Client boundaries and bundle](docs/architecture-phases/03-client-boundary-bundle.md) — merged PR #5
4. ✓ [Day 4 - Local metadata, revisions, audit, and job definitions](docs/architecture-phases/04-sqlite-metadata.md) — merged PR #7
5. ✓ [Day 5 - Secure query plane, Python execution, and virtual datasets](docs/architecture-phases/05-server-query-plane.md) — merged PR #8 + #9
6. ✓ [Day 6 - Universal ingestion, BI authoring, and scheduled refresh](docs/architecture-phases/06-duckdb-bi-core-flow.md) — merged PR #10
7. ✓ [Day 7 - Change-safe semantic governance](docs/architecture-phases/07-lineage-final-hardening.md) — merged PR #11

_Also:_
- [Phase 2/3 hygiene patch](docs/architecture-phases/02-route-based-shell.md) — merged PR #6 (cross-phase regression + side-effect + wasm asset fix)
- [Phase status + cross-phase notes](docs/architecture-phases/02-route-based-shell.md) — merged PR #7

## Architecture at a glance (post-Phase 7)

| Layer | Provides | Key modules |
|---|---|---|
| **Runtime** (Phase 1) | Cross-platform standalone build, Windows-compatible | `scripts/prepare-standalone.mjs` |
| **Routes** (Phase 2) | URL-driven feature navigation, auth proxy | `src/app/(platform)/[view]/`, `src/proxy.ts` |
| **Client** (Phase 3) | Route-scoped bundles, dynamic imports | `src/components/home-client.tsx`, `next/dynamic` |
| **Metadata** (Phase 4) | SQLite metadata, immutable revisions, audit events, job scheduler schema | `prisma/schema.prisma`, `src/lib/revisions.ts` |
| **Query plane** (Phase 5) | Read-only SQL contract, ClickHouse adapter, virtual dataset validation, dependency tracking, cycle detection, semantic contracts, bounded preview | `src/lib/query/`, `src/app/api/query/`, `src/app/api/datasets/` |
| **Ingestion** (Phase 6) | CSV/TSV/JSON file upload, type inference, SQLite-backed scheduler runner | `src/lib/ingest/`, `src/lib/scheduler/` |
| **Governance** (Phase 7) | Relationship manager, impact analysis (BFS), audit timeline | `src/lib/governance/`, `src/app/api/relationships/`, `src/app/api/governance/` |

## Final metrics

| Metric | Value |
|---|---|
| Total test files | 14 |
| Total tests | 242 |
| API routes | 23 |
| Prisma migrations | 6 |
| Governed asset types | 7 (connector, table, dataset, metric, relationship, chart, dashboard) |
| Total PRs | 11 |

## Scope boundaries

- One Next.js application; no new microservices.
- SQLite stores local metadata, revisions, audit events, semantic definitions, and relationship definitions.
- PapaParse-based CSV/TSV/JSON ingestion; DuckDB upgrade path documented for Parquet.
- ClickHouse is the first external connector via HTTP adapter (no client library).
- Full files and connector secrets never enter browser memory or API responses.
- Git-like history means immutable asset revisions, diffs, approval state, and restore inside Lentera. It does not mean embedding a Git server.
- Column-level dependency capture is limited to SQL expressions that can be parsed confidently. Unknown expressions remain table-level and are labeled as such.
- Airflow, Redis, distributed workers, OpenLineage receiver, collaboration automation, extra connectors, and natural-language query generation are deferred. Local scheduling uses one SQLite-backed scheduler process with per-job locks and bounded retries.

## Product differentiator

Commodity BI features are import, SQL, charts, dashboards, and static lineage. Lentera differentiates with a **change intelligence loop**:

1. A user proposes a source, schema, virtual dataset, metric, or relationship change.
2. Lentera stores a revision with actor, time, before/after payload, and reason.
3. It validates semantic contracts and calculates downstream impact.
4. It blocks or warns on broken metrics, ambiguous joins, row multiplication, missing columns, and incompatible types.
5. It explains the failure and suggests a verified replacement candidate when confidence is sufficient.
6. A reviewer publishes, rejects, or restores the revision.

## Branch lifecycle rules

1. One large phase equals one dedicated branch.
2. Start each phase from an up-to-date `main`.
3. After a phase PR is merged, checkout `main` and pull `main` before starting the next large phase.
4. Commit only work belonging to the active phase.
5. Keep unrelated local files, archives, backups, credentials, and other phase work out of the branch.
6. **Precedent** — A cross-phase regression fix (e.g. PR #6, Phase 2 layout bug) may land in its own dedicated branch and merge to `main` before the next phase rebase. The affected phase docs are updated as part of that PR.

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