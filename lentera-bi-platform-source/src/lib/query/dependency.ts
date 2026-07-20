import { db } from '@/lib/db';
import { extractTableRefs, isReadOnlySQL } from './sql-validator';

// ponytail: resolve table references from a virtual dataset's SQL to either
// connector tables or other virtual datasets. Populate DatasetDependency
// rows so Phase 5c contract checks and Phase 7 impact analysis can walk the
// graph. Cycle detection is done before saving — BFS from the new dependency
// set to see if we loop back to the dataset being saved.
// Upgrade path: sqlglot for column-precise parsing.

export interface ResolvedDependency {
  dependsOnTable?: string;
  dependsOnDatasetId?: string;
  connectorId?: string;
  dependencyType: 'source_table' | 'virtual_dataset';
}

export async function resolveDependencies(
  sql: string,
  baseConnectorId: string,
  excludeDatasetId?: string,
): Promise<ResolvedDependency[]> {
  const tableRefs = extractTableRefs(sql);
  const results: ResolvedDependency[] = [];

  const datasets = await db.dataset.findMany({
    where: { id: excludeDatasetId ? { not: excludeDatasetId } : undefined },
    select: { id: true, name: true },
  });
  const lowerNameToId = new Map(datasets.map((d) => [d.name.toLowerCase(), d.id]));

  const connectorTables = await db.dataSourceTable.findMany({
    where: { connectorId: baseConnectorId },
    select: { name: true },
  });
  const connectorTableSet = new Set(connectorTables.map((t) => t.name.toLowerCase()));

  for (const ref of tableRefs) {
    const lower = ref.toLowerCase();

    if (connectorTableSet.has(lower)) {
      results.push({
        dependsOnTable: lower,
        connectorId: baseConnectorId,
        dependencyType: 'source_table',
      });
    } else {
      const datasetId = lowerNameToId.get(lower);
      if (datasetId) {
        results.push({ dependsOnDatasetId: datasetId, dependencyType: 'virtual_dataset' });
      }
    }
    // ponytail: unresolved references are silently dropped — they may be
    // valid at runtime within the SQL engine but not traceable by our parser.
  }

  return results;
}

export async function detectCycles(datasetId: string): Promise<string[] | null> {
  const seen = new Set<string>();
  const path: string[] = [];

  async function walk(currentId: string): Promise<string[] | null> {
    if (seen.has(currentId)) {
      const idx = path.indexOf(currentId);
      return idx >= 0 ? [...path.slice(idx), currentId] : null;
    }
    seen.add(currentId);
    path.push(currentId);

    const deps = await db.datasetDependency.findMany({
      where: { datasetId: currentId, dependsOnDatasetId: { not: null } },
      select: { dependsOnDatasetId: true },
    });

    for (const dep of deps) {
      if (dep.dependsOnDatasetId) {
        const cycle = await walk(dep.dependsOnDatasetId);
        if (cycle) return cycle;
      }
    }

    path.pop();
    return null;
  }

  const deps = await db.datasetDependency.findMany({
    where: { datasetId, dependsOnDatasetId: { not: null } },
    select: { dependsOnDatasetId: true },
  });

  for (const dep of deps) {
    if (dep.dependsOnDatasetId) {
      const cycle = await walk(dep.dependsOnDatasetId);
      if (cycle) return cycle;
    }
  }

  return null;
}

export async function replaceDependencies(
  datasetId: string,
  deps: ResolvedDependency[],
) {
  await db.datasetDependency.deleteMany({ where: { datasetId } });

  if (deps.length === 0) return;

  await db.datasetDependency.createMany({
    data: deps.map((d) => ({
      datasetId,
      dependsOnDatasetId: d.dependsOnDatasetId,
      dependsOnTable: d.dependsOnTable,
      connectorId: d.connectorId,
      dependencyType: d.dependencyType,
    })),
  });
}

export interface ValidateResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  dependencies?: ResolvedDependency[];
}

// ponytail: in-memory cycle check — avoids writing temp edges to DB.
// Builds an adjacency graph from ALL existing dataset→dataset deps,
// injects the proposed new edges, then walks from each new target up
// through the graph to see if we loop back to the dataset being validated.
async function wouldCreateCycle(
  datasetId: string,
  newTargets: string[],
): Promise<boolean> {
  if (newTargets.length === 0) return false;

  const rows = await db.datasetDependency.findMany({
    where: { dependsOnDatasetId: { not: null } },
    select: { datasetId: true, dependsOnDatasetId: true },
  });

  const graph = new Map<string, Set<string>>();
  for (const { datasetId: src, dependsOnDatasetId: tgt } of rows) {
    if (!tgt) continue;
    if (!graph.has(src)) graph.set(src, new Set());
    graph.get(src)!.add(tgt);
  }

  // Inject the proposed edges.
  if (!graph.has(datasetId)) graph.set(datasetId, new Set());
  for (const t of newTargets) graph.get(datasetId)!.add(t);

  // Walk from each new target toward datasetId.
  for (const start of newTargets) {
    const visited = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === datasetId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = graph.get(current);
      if (neighbors) for (const n of neighbors) queue.push(n);
    }
  }

  return false;
}

export async function validateVirtualDataset(params: {
  sql: string;
  language: string;
  connectorId: string;
  datasetId?: string; // present on update, absent on create
}): Promise<ValidateResult> {
  const { sql, language, connectorId, datasetId } = params;

  if (language === 'sql') {
    if (!isReadOnlySQL(sql)) {
      return { valid: false, errorCode: 'SQL_NOT_READ_ONLY', error: 'Virtual dataset SQL must be read-only.' };
    }
  }
  // ponytail: Python validation is deferred to Phase 5c sandbox.

  const deps = await resolveDependencies(sql, connectorId, datasetId);

  if (datasetId) {
    const newDatasetDeps = deps.filter((d) => d.dependsOnDatasetId).map((d) => d.dependsOnDatasetId!);
    if (newDatasetDeps.length > 0) {
      const cycled = await wouldCreateCycle(datasetId, newDatasetDeps);
      if (cycled) {
        return {
          valid: false,
          errorCode: 'CIRCULAR_DEPENDENCY',
          error: `Circular dependency detected: dataset refers upstream to itself.`,
        };
      }
    }
  }

  return { valid: true, dependencies: deps };
}