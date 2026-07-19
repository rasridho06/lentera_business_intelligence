> Part 7 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 7 - Phase 7: Lineage and final hardening

Focus: table-level lineage works from source to dashboard.

## Branch rule
One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then create the next phase branch.

## 7.0 - Graph contract
- [ ] Define namespace, database, schema, and table identifiers.
- [ ] Reuse the existing Node and Edge model; do not add a graph database.
- [ ] Define empty-graph, orphan-edge, depth, and node-limit behavior.

## 7.1 - Runtime lineage events
- [ ] Upsert a dataset node when a dataset is created.
- [ ] Create dataset-to-chart and chart-to-dashboard edges from persistence events.
- [ ] Store source platform and extraction method.

## 7.2 - dbt importer
- [ ] Import manifest sources, models, seeds, and exposures.
- [ ] Map depends_on.nodes to edges.
- [ ] Validate references before creating edges.
- [ ] Use stable external IDs and upsert semantics.
- [ ] Prove a second import creates no duplicates.

## 7.3 - Graph UI and impact
- [ ] Display source/model, dataset, chart, and dashboard nodes.
- [ ] Add downstream impact traversal.
- [ ] Guard traversal with visited set, depth limit, and result-node limit.
- [ ] Add search/filter for large graphs.
- [ ] Render empty graphs and orphan warnings safely.

## 7.4 - Final hardening and handoff
- [ ] Test importer, deduplication, detail, and impact traversal.
- [ ] Run full tests and production build.
- [ ] Re-measure RAM, response time, and bundle against Phase 1.
- [ ] Update README setup and demo flow.
- [ ] Review identifiers, upserts, edges, traversal, and callers.
- [ ] Fix Critical/High before merge and Medium in this PR.
- [ ] After merge, checkout `main`, pull `main`, then finish or create the next release branch.

## Definition of done
- [ ] Table-level lineage works end-to-end.
- [ ] Repeated dbt imports create no duplicates.
- [ ] Downstream impact reaches charts and dashboards.
- [ ] Tests and build pass.
- [ ] No PostgreSQL, Redis, worker, or microservice is required.

## Review focus
- Critical: lineage connects the wrong dataset or hides a dependency. Use unique identifiers and reference validation.
- High: importer is not idempotent. Use stable IDs, constraints, upserts, and a two-import test.
- High: chart/dashboard edges are not created from persistence events. Create edges in the asset transaction.
- High: traversal has no cycle guard. Use visited set, depth, and result limits.
- Medium: empty graph/orphan edge crashes UI. Add empty state, orphan skipping, and warnings.
- Low: provenance is hidden. Store and display source platform, extraction method, and import timestamp.
