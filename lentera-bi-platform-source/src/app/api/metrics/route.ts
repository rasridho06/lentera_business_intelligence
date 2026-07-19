import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');

    const canonicalMetrics = await db.canonicalMetric.findMany(
      name ? { where: { OR: [{ name: { contains: name } }, { aliases: { contains: name } }] } } : undefined
    );

    // Get observed metrics from nodes
    const observedMetrics = await db.node.findMany({
      where: { nodeType: 'metric' },
    });

    // For each canonical metric, find matching observed metrics
    const comparisons = canonicalMetrics.map((cm) => {
      const matching = observedMetrics.filter((om) => {
        const aliases: string[] = cm.aliases ? JSON.parse(cm.aliases) : [];
        return om.name.toLowerCase() === cm.name.toLowerCase() ||
          aliases.some((a) => a.toLowerCase() === om.name.toLowerCase());
      });

      return {
        canonical: {
          id: cm.id,
          name: cm.name,
          aliases: cm.aliases ? JSON.parse(cm.aliases) : [],
          description: cm.description,
          expression: cm.expression,
          aggregation: cm.aggregation,
          requiredFilters: cm.requiredFilters ? JSON.parse(cm.requiredFilters) : [],
          dimensions: cm.dimensions ? JSON.parse(cm.dimensions) : [],
          currencyRequirement: cm.currencyRequirement,
          timeGrain: cm.timeGrain,
          owner: cm.owner,
          version: cm.version,
          severityOnDrift: cm.severityOnDrift,
        },
        observed: matching.map((om) => ({
          id: om.id,
          name: om.name,
          qualifiedName: om.qualifiedName,
          description: om.description,
          metadata: om.metadata ? JSON.parse(om.metadata) : {},
        })),
        driftStatus: matching.length === 0 ? 'unmapped' : 'potential_drift',
      };
    });

    return NextResponse.json({
      canonicalMetrics: canonicalMetrics.map((cm) => ({
        id: cm.id,
        name: cm.name,
        aliases: cm.aliases ? JSON.parse(cm.aliases) : [],
        description: cm.description,
        expression: cm.expression,
        aggregation: cm.aggregation,
        requiredFilters: cm.requiredFilters ? JSON.parse(cm.requiredFilters) : [],
        dimensions: cm.dimensions ? JSON.parse(cm.dimensions) : [],
        currencyRequirement: cm.currencyRequirement,
        timeGrain: cm.timeGrain,
        owner: cm.owner,
        version: cm.version,
        severityOnDrift: cm.severityOnDrift,
      })),
      observedMetrics: observedMetrics.map((om) => ({
        id: om.id,
        name: om.name,
        qualifiedName: om.qualifiedName,
        description: om.description,
        owner: om.owner,
        metadata: om.metadata ? JSON.parse(om.metadata) : {},
      })),
      comparisons,
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
