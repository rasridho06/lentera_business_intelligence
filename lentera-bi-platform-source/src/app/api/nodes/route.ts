import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const node = await db.node.findFirst({
      where: { OR: [{ id }, { externalId: id }] },
    });

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Get all edges connected to this node
    const [upstreamEdges, downstreamEdges] = await Promise.all([
      db.edge.findMany({
        where: { targetNodeId: node.id },
        include: { sourceNode: true },
      }),
      db.edge.findMany({
        where: { sourceNodeId: node.id },
        include: { targetNode: true },
      }),
    ]);

    // Get findings for this node
    const findings = await db.finding.findMany({
      where: { nodeId: node.id },
    });

    // Get canonical metric comparison if this is a metric
    let canonicalComparison = null;
    if (node.nodeType === 'metric') {
      const canonicalMetrics = await db.canonicalMetric.findMany();
      for (const cm of canonicalMetrics) {
        const aliases: string[] = cm.aliases ? JSON.parse(cm.aliases) : [];
        if (node.name.toLowerCase() === cm.name.toLowerCase() || aliases.some((a) => a.toLowerCase() === node.name.toLowerCase())) {
          canonicalComparison = {
            canonical: {
              id: cm.id,
              name: cm.name,
              expression: cm.expression,
              aggregation: cm.aggregation,
              requiredFilters: cm.requiredFilters ? JSON.parse(cm.requiredFilters) : [],
              dimensions: cm.dimensions ? JSON.parse(cm.dimensions) : [],
            },
            observed: {
              name: node.name,
              metadata: node.metadata ? JSON.parse(node.metadata) : {},
            },
          };
          break;
        }
      }
    }

    return NextResponse.json({
      node: {
        id: node.id,
        externalId: node.externalId,
        name: node.name,
        type: node.nodeType,
        platform: node.platform,
        qualifiedName: node.qualifiedName,
        description: node.description,
        owner: node.owner,
        status: node.status,
        metadata: node.metadata ? JSON.parse(node.metadata) : null,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      },
      upstream: upstreamEdges.map((e) => ({
        edgeId: e.id,
        edgeType: e.edgeType,
        confidence: e.confidence,
        expression: e.expression,
        node: {
          id: e.sourceNode.id,
          name: e.sourceNode.name,
          type: e.sourceNode.nodeType,
          platform: e.sourceNode.platform,
          qualifiedName: e.sourceNode.qualifiedName,
        },
      })),
      downstream: downstreamEdges.map((e) => ({
        edgeId: e.id,
        edgeType: e.edgeType,
        confidence: e.confidence,
        expression: e.expression,
        node: {
          id: e.targetNode.id,
          name: e.targetNode.name,
          type: e.targetNode.nodeType,
          platform: e.targetNode.platform,
          qualifiedName: e.targetNode.qualifiedName,
        },
      })),
      findings: findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        severity: f.severity,
        title: f.title,
        description: f.description,
        evidence: f.evidence ? JSON.parse(f.evidence) : null,
        recommendation: f.recommendation,
        status: f.status,
      })),
      canonicalComparison,
    });
  } catch (error) {
    console.error('Node detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch node detail' }, { status: 500 });
  }
}
