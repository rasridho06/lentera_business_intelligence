import { db } from '@/lib/db';

// ponytail: traverse downstream impact from a governed asset through the
// dependency graph (DatasetDependency + Edge). Returns affected charts,
// dashboards, metrics, and datasets reachable from the starting asset.
// Bounded at depth 5 and 50 nodes to prevent runaway traversal on large
// lineage graphs.

export interface ImpactResult {
  assetId: string;
  downstream: {
    datasets: { id: string; name: string }[];
    charts: { id: string; name: string }[];
    dashboards: { id: string; name: string }[];
    metrics: { id: string; name: string }[];
  };
  depth: number;
  truncated: boolean;
}

const MAX_DEPTH = 5;
const MAX_NODES = 50;

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function computeImpact(assetId: string): Promise<ImpactResult> {
  const downstream = {
    datasets: [] as { id: string; name: string }[],
    charts: [] as { id: string; name: string }[],
    dashboards: [] as { id: string; name: string }[],
    metrics: [] as { id: string; name: string }[],
  };
  const visited = new Set<string>();
  const queue: string[] = [assetId];
  let depth = 0;
  let truncated = false;

  while (queue.length > 0 && depth < MAX_DEPTH) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const current = queue.shift()!;
      if (visited.has(current) || visited.size >= MAX_NODES) { truncated = true; continue; }
      visited.add(current);

      // Walk DatasetDependency: what depends on this dataset?
      // ponytail: only dataset IDs produce dependency rows — skip chart/dashboard/metric nodes.
      const deps = await db.datasetDependency.findMany({
        where: { dependsOnDatasetId: current },
        select: { dataset: { select: { id: true, name: true } } },
      });
      for (const d of deps) {
        if (!visited.has(d.dataset.id)) {
          downstream.datasets.push(d.dataset);
          queue.push(d.dataset.id);
        }
      }

      // Walk Edge lineage: what charts/dashboards/metrics reference this node?
      const edges = await db.edge.findMany({
        where: { sourceNodeId: current },
        select: { targetNode: { select: { id: true, name: true, nodeType: true } } },
      });
      for (const e of edges) {
        const t = e.targetNode;
        if (!t || visited.has(t.id)) continue;
        if (t.nodeType === 'chart') downstream.charts.push({ id: t.id, name: t.name });
        if (t.nodeType === 'dashboard') downstream.dashboards.push({ id: t.id, name: t.name });
        if (t.nodeType === 'metric') downstream.metrics.push({ id: t.id, name: t.name });
        // ponytail: push only dataset/edge nodes. Chart/dashboard/metric IDs
        // won't produce dependencies, but they may have outgoing edges.
        queue.push(t.id);
      }
    }
    depth++;
  }

  // ponytail: deduplicate — the same entity can be reached through both
  // a DatasetDependency chain and an Edge walk.
  return {
    assetId,
    downstream: {
      datasets: dedupe(downstream.datasets),
      charts: dedupe(downstream.charts),
      dashboards: dedupe(downstream.dashboards),
      metrics: dedupe(downstream.metrics),
    },
    depth,
    truncated,
  };
}
