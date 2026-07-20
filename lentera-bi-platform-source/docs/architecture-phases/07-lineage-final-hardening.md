> Part 7 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 7 - Phase 7: Change-safe semantic governance

Focus: relationship management, end-to-end lineage, Git-like audit history, and impact validation make BI changes safe before dashboards silently produce wrong numbers.

## Branch rule

One large phase equals one dedicated branch. After merge, checkout `main`, pull `main`, then finish or create the next release branch.

## 7.0 - Governed asset graph

- [ ] Define stable identifiers for file, physical table, virtual dataset, metric, relationship, chart, and dashboard assets.
- [ ] Reuse the existing Node and Edge model; do not add a graph database.
- [ ] Define empty graph, orphan edge, depth, node-limit, and dependency-confidence behavior.
- [ ] Link every edge to the asset revision and extraction evidence that created it.

### 7.0a - Lineage linkage retrofit

Edge columns `assetType`, `assetId`, and `sourceRevisionId` were added in Phase 4 (remedial R6) so the Phase 7 lineage workflow can backfill semantic asset references without requiring a retroactive migration.

- [ ] Populate `Edge.assetType` and `Edge.assetId` from revision create/update events — map the governed asset (connector, dataset, metric, chart, dashboard) to the edge's source and target nodes.
- [ ] Link each Edge to the `AssetRevision` that produced it via `sourceRevisionId` so lineage traversal can walk from a governance event to every affected edge.
- [ ] Migrate legacy lineage-only Edges (dbt / Superset imports) — leave `assetType` nullable for existing rows; populate as Phase 7.2 contracts+lineage processing links source schemas to revisions.
- [ ] Use the index on `(assetType, assetId)` for impact-traversal queries that begin from a governed asset and walk through edges to discover downstream breakage.

## 7.1 - Relationship manager

- [ ] Create and edit relationships between table columns with cardinality, filter direction, active state, and owner.
- [ ] Profile candidate keys from schema and distinct-value statistics; present suggestions but require explicit approval.
- [ ] Detect one-to-many violations, many-to-many joins, ambiguous filter paths, cycles, inactive relationships, and row multiplication.
- [ ] Recommend a bridge table or star-schema shape when two fact tables create an unsafe many-to-many relationship.
- [ ] Validate relationship changes before publish and record their revision diff.

## 7.2 - Contracts, lineage, and impact

- [ ] Create lineage from source file/connector through table, SQL/Python virtual dataset, metric, chart, and dashboard.
- [ ] Link scheduler job definitions and job runs to the Python/SQL output revision that they produced.
- [ ] Run contract checks when a source schema, SQL definition, metric, or relationship changes.
- [ ] Identify downstream breakage: missing column, incompatible type, metric failure, dashboard query failure, or changed join cardinality.
- [ ] Traverse downstream impact with visited set, depth limit, and result-node limit.
- [ ] Show evidence and confidence for each lineage edge; never claim unsupported SQL is column-precise.

## 7.3 - Change intelligence and repair suggestions

- [ ] Display an append-only timeline with actor, time, reason, revision, before/after diff, validation outcome, job-run status, and impacted assets.
- [ ] Support draft, review, publish, reject, restore, and rollback-as-new-revision states.
- [ ] Before publish, simulate impacted virtual datasets, metrics, charts, and dashboards against the proposed revision.
- [ ] For a missing or renamed column, suggest replacement candidates using compatible type, normalized name, source lineage, and schema profile.
- [ ] Never auto-rewrite production SQL; suggestions require user review and become a new revision when accepted.

## 7.4 - Trust and incident UX

- [ ] Show certified asset, owner, freshness/SLA, contract status, relationship quality, and last successful validation.
- [ ] Render a clear incident explanation: what changed, who changed it, when, what broke, why, and the verified repair candidate.
- [ ] Support empty graphs, orphan warnings, no-impact changes, and unresolved suggestions safely.

## 7.5 - Final hardening and handoff

- [ ] Test relationship cardinality, ambiguous path, row multiplication, contract failure, revision diff, restore, lineage, impact, and repair suggestion confidence.
- [ ] Run full tests and production build.
- [ ] Re-measure RAM, response time, and bundle against Phase 1.
- [ ] Update README setup and end-to-end demo flow.
- [ ] Review identifiers, secrets, revisions, contracts, relationship validation, traversal, and callers.
- [ ] Fix Critical/High before merge and Medium in this PR.

## Mandatory browser quality gate

Run this gate after every subphase that can affect runtime or user-visible behavior and again before merge. A successful build or an HTTP status alone is not browser validation.

1. Run `npm run lint`, `npm test`, and `npm run build` in that order.
2. Start the production runtime, sign in, and open every affected route in a real browser.
3. Confirm the sidebar and main content render together inside the viewport, then test the primary action, refresh, and Back/Forward navigation.
4. Fail the gate on an uncaught page error, React console error or warning, unexpected `4xx/5xx` response, missing runtime asset, blank page, or content rendered outside the viewport.
5. Save screenshots of the relationship, lineage, audit, impact, and repair flows, then record the commands, route, interaction, console result, network result, and screenshot path in the implementation record or PR.
6. A PR cannot merge until lint, tests, build, and the authenticated browser smoke test pass. Until this flow is automated in CI, execute it manually and attach the evidence.

## Definition of done

- [ ] CSV, XLSX, or Parquet can reach a versioned physical table, virtual dataset, chart, dashboard, and lineage graph.
- [ ] A relationship is validated before it can create ambiguous or multiplying joins.
- [ ] A schema, dataset, metric, or relationship change has actor/time/before-after audit history.
- [ ] A breaking change identifies every impacted downstream asset and explains the failure.
- [ ] Repair suggestions are reviewable and never silently alter SQL.
- [ ] Tests and build pass without PostgreSQL, Redis, workers, or a microservice requirement.

## Review focus

- Critical: a source/semantic change can silently produce wrong dashboard numbers. Block publish on failed contracts, unsafe relationship validation, or failed impacted queries.
- Critical: connector credentials or uploaded data enter revisions, audit events, or browser responses. Redact metadata and keep data server-side.
- High: relationship change creates many-to-many multiplication or ambiguous filter propagation. Reject it or require an explicit approved bridge design.
- High: audit event lacks actor, before/after state, or immutable revision. Write the full event transactionally.
- High: impact traversal misses dependent metric/chart/dashboard or loops indefinitely. Use dependency edges, visited set, depth, and node limits.
- Medium: repair suggestion has weak evidence. Show confidence and evidence; require manual acceptance.
- Low: empty graph, no-impact change, or orphan edge is hard to interpret. Add clear status and next action.
