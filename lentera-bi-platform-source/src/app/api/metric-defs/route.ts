import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createMetricSchema, updateMetricSchema, validateBody } from '@/lib/validations';

export async function GET() {
  try {
    const metrics = await db.metricDef.findMany({
      include: { metricSources: true, chartMetrics: { include: { chart: { select: { id: true, name: true, dashboardId: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Metrics GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(createMetricSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const metric = await db.metricDef.create({
      data: {
        name: body.name,
        description: body.description || null,
        expression: body.expression || null,
        language: body.language || 'sql',
        aggregation: body.aggregation || null,
        sourceTableId: body.sourceTableId || null,
        sourceColumn: body.sourceColumn || null,
        filters: body.filters ? JSON.stringify(body.filters) : null,
        dimensions: body.dimensions ? JSON.stringify(body.dimensions) : null,
        timeGrain: body.timeGrain || null,
        status: 'draft',
        branch: 'main',
        ownerUserId: body.ownerUserId || null,
      },
    });

    // Create metric sources (cross-table references)
    if (body.sources && Array.isArray(body.sources)) {
      for (const src of body.sources) {
        await db.metricSource.create({
          data: {
            metricId: metric.id,
            tableId: src.tableId || null,
            connectorId: src.connectorId || null,
            schemaName: src.schemaName || null,
            tableName: src.tableName,
            columnName: src.columnName || null,
            role: src.role || 'measure',
            expression: src.expression || null,
          },
        });
      }
    }

    const result = await db.metricDef.findUnique({
      where: { id: metric.id },
      include: { metricSources: true },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Metric POST error:', error);
    return NextResponse.json({ error: 'Failed to create metric' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(updateMetricSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const metric = await db.metricDef.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description || null,
        expression: body.expression,
        language: body.language,
        aggregation: body.aggregation,
        sourceTableId: body.sourceTableId || null,
        sourceColumn: body.sourceColumn,
        filters: body.filters ? JSON.stringify(body.filters) : undefined,
        dimensions: body.dimensions ? JSON.stringify(body.dimensions) : undefined,
        timeGrain: body.timeGrain,
        status: body.status,
        version: { increment: 1 },
      },
      include: { metricSources: true },
    });
    return NextResponse.json(metric);
  } catch (error) {
    console.error('Metric PUT error:', error);
    return NextResponse.json({ error: 'Failed to update metric' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.chartMetric.deleteMany({ where: { metricId: id } });
    await db.metricSource.deleteMany({ where: { metricId: id } });
    await db.metricDef.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Metric DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete metric' }, { status: 500 });
  }
}
