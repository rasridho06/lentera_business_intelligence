import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nodeType = searchParams.get('type');
    const platform = searchParams.get('platform');
    const focusId = searchParams.get('focus');
    const direction = searchParams.get('direction') || 'both'; // upstream, downstream, both
    const depth = parseInt(searchParams.get('depth') || '3');

    const nodeWhere: Prisma.NodeWhereInput = {};
    if (nodeType) nodeWhere.nodeType = nodeType;
    if (platform) nodeWhere.platform = platform;

    let focusNodeIds: string[] = [];

    if (focusId) {
      // Find the focus node and expand lineage
      const focusNode = await db.node.findFirst({
        where: {
          OR: [
            { id: focusId },
            { externalId: focusId },
            { name: { contains: focusId } },
          ],
        },
      });

      if (focusNode) {
        focusNodeIds = [focusNode.id];

        // Expand upstream
        if (direction === 'upstream' || direction === 'both') {
          let currentIds = [focusNode.id];
          for (let i = 0; i < depth; i++) {
            const upstreamEdges = await db.edge.findMany({
              where: { targetNodeId: { in: currentIds } },
              select: { sourceNodeId: true },
            });
            const newIds = upstreamEdges.map((e) => e.sourceNodeId).filter((id) => !focusNodeIds.includes(id));
            if (newIds.length === 0) break;
            focusNodeIds.push(...newIds);
            currentIds = newIds;
          }
        }

        // Expand downstream
        if (direction === 'downstream' || direction === 'both') {
          let currentIds = [focusNode.id];
          for (let i = 0; i < depth; i++) {
            const downstreamEdges = await db.edge.findMany({
              where: { sourceNodeId: { in: currentIds } },
              select: { targetNodeId: true },
            });
            const newIds = downstreamEdges.map((e) => e.targetNodeId).filter((id) => !focusNodeIds.includes(id));
            if (newIds.length === 0) break;
            focusNodeIds.push(...newIds);
            currentIds = newIds;
          }
        }
      }
    }

    // Fetch nodes
    const nodes = focusNodeIds.length > 0
      ? await db.node.findMany({ where: { id: { in: focusNodeIds } } })
      : await db.node.findMany({ where: nodeWhere });

    const nodeIds = nodes.map((n) => n.id);

    // Fetch edges between these nodes
    const edges = await db.edge.findMany({
      where: {
        sourceNodeId: { in: nodeIds },
        targetNodeId: { in: nodeIds },
      },
    });

    // Fetch findings for these nodes
    const findings = await db.finding.findMany({
      where: { nodeId: { in: nodeIds } },
    });

    // Format for graph visualization
    const graphNodes = nodes.map((n) => ({
      id: n.id,
      externalId: n.externalId,
      name: n.name,
      type: n.nodeType,
      platform: n.platform,
      qualifiedName: n.qualifiedName,
      description: n.description,
      owner: n.owner,
      status: n.status,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
      findings: findings.filter((f) => f.nodeId === n.id).length,
    }));

    const graphEdges = edges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: e.edgeType,
      confidence: e.confidence,
      extractionMethod: e.extractionMethod,
      expression: e.expression,
      sourcePlatform: e.sourcePlatform,
    }));

    return NextResponse.json({
      nodes: graphNodes,
      edges: graphEdges,
      findings: findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        severity: f.severity,
        title: f.title,
        nodeId: f.nodeId,
      })),
    });
  } catch (error) {
    console.error('Lineage API error:', error);
    return NextResponse.json({ error: 'Failed to fetch lineage' }, { status: 500 });
  }
}
