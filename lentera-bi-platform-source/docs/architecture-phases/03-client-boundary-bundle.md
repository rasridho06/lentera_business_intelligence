> Part 3 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 3 - Phase 3: Client boundaries and bundle

Focus: each route loads only the JavaScript it needs.

## Branch rule
One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 3.0 - Guard rails
- [ ] Record Phase 1/2 chunk and route baselines.
- [ ] Confirm no route, API, schema, or business-logic changes are needed.
- [ ] Do not add a bundle-analyzer dependency.

## 3.1 - Audit boundaries
- [ ] Inventory every `'use client'`.
- [ ] Classify server-only, interactive client, and shared components.
- [ ] Trace root-layout imports.
- [ ] Prove Prisma, connectors, and secrets never enter browser bundles.

## 3.2 - Reduce shared client code
- [ ] Remove `'use client'` from pages without browser APIs.
- [ ] Move initial metadata fetches into Server Components.
- [ ] Keep the smallest interactive client boundary.
- [ ] Add loading/error states at dynamic boundaries.

## 3.3 - Isolate heavy libraries
- [ ] Load ReactFlow only on lineage.
- [ ] Load Recharts only on charts/dashboards.
- [ ] Load dnd-kit only on the dashboard builder.
- [ ] Load the query engine only on query.
- [ ] Remove duplicate views and unused dependencies after import proof.

## 3.4 - Measure
- [ ] Run import and server-secret scans.
- [ ] Run production build.
- [ ] Record five largest client chunks.
- [ ] Compare with the baseline and smoke-test every primary route.

## 3.5 - Handoff and review
- [x] Run tests, build, import audit, and route smoke tests.
- [ ] Review import chains and classify Critical/High/Medium/Low.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, and create the next phase branch.

## Definition of done
- [x] Root layout is not a full client application.
- [x] Heavy libraries are isolated to owning routes.
- [x] Duplicate views/dependencies are removed.
- [x] Before/after bundle sizes are recorded.
- [x] Tests, build, and route smoke tests pass.

## Review focus
- Critical: server modules or credentials reach the browser. Move them behind Server Components/API routes and return safe DTOs.
- High: heavy library enters the initial route. Lazy-load it on its owning route.
- High: removing a client boundary breaks browser APIs. Restore the smallest required boundary.
- Medium: dead dependency remains. Remove package and lockfile entry.
- Low: dynamic import has no loading/error state. Add shared fallback and error boundary.

## Implementation record

- Root layout now renders only document metadata, styles, and route children. `Providers` and `Toaster` are scoped to `src/app/(platform)/layout.tsx`, so `/login` does not load the platform client runtime.
- `HomeClient` keeps route views behind `next/dynamic`; the unused enhanced lineage view was removed.
- Import audit after production build: ReactFlow appears only in its lineage chunk, Recharts only in its chart chunk, and no Prisma, database URL, encryption key, or decrypt helper appears in browser chunks.
| Measurement | Before audit cleanup | After audit cleanup |
| --- | ---: | ---: |
| Largest browser chunk 1 | 488,563 B | 488,563 B |
| Largest browser chunk 2 | 227,539 B | 227,539 B |
| Largest browser chunk 3 | 137,998 B | 141,755 B |
| Largest browser chunk 4 | 135,853 B | 137,998 B |
| Largest browser chunk 5 | 112,594 B | 112,594 B |

Chunk hashes and grouping changed between builds; the table records the measurements without claiming a false size reduction.
- Validation: 132 tests passed, `npm run build` completed successfully, and standalone smoke tests returned `/login` 200, `/overview` 307, `/lineage` 307, and `/api` 401.

## Review result

- Critical: none. Server-only modules and secrets remain outside browser chunks.
- High: none. Heavy libraries are route-scoped through dynamic imports.
- Medium: resolved. Dead UI wrappers, the enhanced lineage view, and 26 unused direct dependencies were removed.
- Low: resolved. Before/after chunk measurements are now recorded; existing loading and error boundaries remain in `HomeClient`.
