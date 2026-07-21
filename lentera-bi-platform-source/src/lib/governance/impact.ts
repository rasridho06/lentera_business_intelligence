import { db } from '@/lib/db';

// ponytail: traverse downstream impact from a governed asset through the
// dependency graph (DatasetDependency + Edge). Returns affected charts,
// dashboards, metrics, and datasets reachable from the starting asset.

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

export async function computeImpact(assetId: string): Promise<ImpactResult> {
  const downstream = { datasets: [] as { id: string; name: string }[], charts: [] as { id: string; name: string }[], dashboards: [] as { id: string; name: string }[], metrics: [] as { id: string; name: string }[] };
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

      // Walk Edge lineage: what charts/dashboards reference this?
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
        queue.push(t.id);
      }
    }
    depth++;
  }

  return { assetId, downstream, depth, truncated };
}