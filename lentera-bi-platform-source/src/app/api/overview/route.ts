import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [latestRun, allNodes, allFindings, totalEdges, totalCanonicalMetrics] = await Promise.all([
      db.buildRun.findFirst({ orderBy: { createdAt: 'desc' } }),
      db.node.findMany({ select: { nodeType: true, platform: true } }),
      db.finding.findMany({ select: { severity: true } }),
      db.edge.count(),
      db.canonicalMetric.count(),
    ]);

    // ponytail: SQLite in Prisma doesn't support groupBy — aggregate in-memory.
    const nodeTypeMap: Record<string, number> = {};
    const platformCounts: Record<string, number> = {};
    for (const n of allNodes) {
      nodeTypeMap[n.nodeType] = (nodeTypeMap[n.nodeType] || 0) + 1;
      platformCounts[n.platform] = (platformCounts[n.platform] || 0) + 1;
    }

    const severityMap: Record<string, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    for (const f of allFindings) {
      const sev = f.severity;
      if (severityMap[sev] !== undefined) severityMap[sev]++;
    }

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
      totalNodes: allNodes.length,
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
      platformCounts,
    });
  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}