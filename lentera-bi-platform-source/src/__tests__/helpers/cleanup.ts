import { PrismaClient } from '@prisma/client';

const MODEL_MAP: Record<string, { model: string; via: string }> = {
  mr: { model: 'mergeRequest', via: 'id' },
  branch: { model: 'dashboardBranch', via: 'id' },
  finding: { model: 'finding', via: 'id' },
  edge: { model: 'edge', via: 'id' },
  node: { model: 'node', via: 'id' },
  chartMetric: { model: 'chartMetric', via: 'chartId' },
  chart: { model: 'chart', via: 'id' },
  metricSource: { model: 'metricSource', via: 'metricId' },
  metric: { model: 'metricDef', via: 'id' },
  dataset: { model: 'dataset', via: 'id' },
  dashboard: { model: 'dashboard', via: 'id' },
  connectorTable: { model: 'dataSourceTable', via: 'connectorId' },
  connector: { model: 'connector', via: 'id' },
  collabSession: { model: 'collaborationSession', via: 'id' },
};

export async function cleanupTestData(prisma: PrismaClient, ids: Record<string, string[]>) {
  const ORDER = ['mr', 'branch', 'finding', 'edge', 'node', 'chartMetric', 'chart', 'metricSource', 'metric', 'dataset', 'dashboard', 'connectorTable', 'connector', 'collabSession'];

  for (const key of ORDER) {
    const values = ids[key];
    if (!values?.length) continue;
    const { model, via } = MODEL_MAP[key];
    const where = via === 'id' ? { id: { in: values } } : { [via]: { in: values } };
    try {
      await (prisma as any)[model].deleteMany({ where });
    } catch { }
  }
}

export function trackIds(cleanup: Record<string, string[]>) {
  return function track(type: string, id: string) {
    if (!cleanup[type]) cleanup[type] = [];
    cleanup[type].push(id);
    return id;
  };
}
