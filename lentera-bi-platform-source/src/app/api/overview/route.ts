import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [latestRun, nodeCounts, findingCounts, totalEdges, totalCanonicalMetrics] = await Promise.all([
      db.buildRun.findFirst({ orderBy: { createdAt: 'desc' } }),
      db.node.groupBy({ by: ['nodeType'], _count: { id: true } }),
      db.finding.groupBy({ by: ['severity'], _count: { id: true } }),
      db.edge.count(),
      db.canonicalMetric.count(),
    ]);

    const nodeTypeMap: Record<string, number> = {};
    nodeCounts.forEach((item) => {
      nodeTypeMap[item.nodeType] = item._count.id;
    });

    const severityMap: Record<string, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    findingCounts.forEach((item) => {
      severityMap[item.severity] = item._count.id;
    });

    // Calculate lineage coverage
    const totalDatasets = nodeTypeMap['dataset'] || 0;
    const unmatchedDatasets = await db.node.count({
      where: {
        nodeType: 'dataset',
        qualifiedName: { startsWith: 'external_api' },
      },
    });
    const resolvedDatasets = totalDatasets > 0 ? (totalDatasets - unmatchedDatasets) / totalDatasets : 0;

    // Metric drift summary
    const driftFindings = await db.finding.findMany({
      where: { ruleId: 'R3' },
      include: { node: { select: { name: true, qualifiedName: true } } },
    });

    return NextResponse.json({
      buildRun: latestRun,
      nodeCounts: nodeTypeMap,
      severityCounts: severityMap,
      totalNodes: Object.values(nodeTypeMap).reduce((a, b) => a + b, 0),
      totalEdges,
      totalCanonicalMetrics,
      lineageCoverage: resolvedDatasets,
      driftFindings: driftFindings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        node: f.node?.name,
        evidence: f.evidence ? JSON.parse(f.evidence) : null,
      })),
      platformCounts: (await db.node.groupBy({ by: ['platform'], _count: { id: true } })).reduce((acc: Record<string, number>, item) => {
        acc[item.platform] = item._count.id;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
