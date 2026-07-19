import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nodeId = searchParams.get('nodeId');
    const direction = searchParams.get('direction') || 'downstream';

    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId required' }, { status: 400 });
    }

    const node = await db.node.findFirst({
      where: { OR: [{ id: nodeId }, { externalId: nodeId }] },
    });

    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const affectedNodes: Record<string, unknown>[] = [];
    const affectedPaths: Record<string, unknown>[] = [];
    const visited = new Set<string>();
    let currentLevel = [{ id: node.id, path: [node.id] }];
    visited.add(node.id);

    const maxDepth = 10;

    for (let d = 0; d < maxDepth && currentLevel.length > 0; d++) {
      const edgeWhere = direction === 'downstream'
        ? { sourceNodeId: { in: currentLevel.map((c) => c.id) } }
        : { targetNodeId: { in: currentLevel.map((c) => c.id) } };

      const edges = await db.edge.findMany({ where: edgeWhere });
      const nextLevel: { id: string; path: string[] }[] = [];

      for (const edge of edges) {
        const connectedId = direction === 'downstream' ? edge.targetNodeId : edge.sourceNodeId;
        if (!visited.has(connectedId)) {
          visited.add(connectedId);
          const parentPath = currentLevel.find((c) => c.id === edge.sourceNodeId || c.id === edge.targetNodeId)?.path || [];
          const newPath = [...parentPath, connectedId];
          nextLevel.push({ id: connectedId, path: newPath });
          affectedPaths.push({
            from: edge.sourceNodeId,
            to: edge.targetNodeId,
            edgeType: edge.edgeType,
            confidence: edge.confidence,
          });
        }
      }

      currentLevel = nextLevel;
    }

    // Fetch details for affected nodes
    const affectedNodeDetails = await db.node.findMany({
      where: { id: { in: Array.from(visited).filter((id) => id !== node.id) } },
    });

    // Group by type
    const byType: Record<string, string[]> = {};
    for (const n of affectedNodeDetails) {
      if (!byType[n.nodeType]) byType[n.nodeType] = [];
      byType[n.nodeType].push(n.id);
    }

    // Confidence summary
    const confidenceSummary: Record<string, number> = {};
    for (const path of affectedPaths) {
      const conf = (path as Record<string, unknown>).confidence as string;
      confidenceSummary[conf] = (confidenceSummary[conf] || 0) + 1;
    }

    return NextResponse.json({
      sourceNode: {
        id: node.id,
        name: node.name,
        type: node.nodeType,
        qualifiedName: node.qualifiedName,
      },
      direction,
      affectedNodes: affectedNodeDetails.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.nodeType,
        platform: n.platform,
        qualifiedName: n.qualifiedName,
        owner: n.owner,
        status: n.status,
      })),
      affectedPaths,
      byType,
      confidenceSummary,
      totalAffected: affectedNodeDetails.length,
    });
  } catch (error) {
    console.error('Impact API error:', error);
    return NextResponse.json({ error: 'Impact analysis failed' }, { status: 500 });
  }
}
