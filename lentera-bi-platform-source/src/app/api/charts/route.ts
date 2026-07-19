import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createChartSchema, updateChartSchema, validateBody } from '@/lib/validations';

export async function GET() {
  try {
    const charts = await db.chart.findMany({
      include: { chartMetrics: { include: { metric: true } }, dashboard: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(charts);
  } catch (error) {
    console.error('Charts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch charts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(createChartSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const chart = await db.chart.create({
      data: {
        dashboardId: body.dashboardId || null,
        name: body.name,
        description: body.description || null,
        chartType: body.chartType || 'bar',
        dataSourceId: body.dataSourceId || null,
        dataSourceType: body.dataSourceType || 'table',
        datasetId: body.datasetId || null,
        config: body.config ? JSON.stringify(body.config) : null,
        customSQL: body.customSQL || null,
        layout: body.layout ? JSON.stringify(body.layout) : null,
        status: 'draft',
        branch: 'main',
        ownerUserId: body.ownerUserId || null,
      },
      include: { chartMetrics: true, dashboard: { select: { name: true } } },
    });

    // Link metrics if provided
    if (body.metricIds && Array.isArray(body.metricIds)) {
      for (const mId of body.metricIds) {
        await db.chartMetric.create({
          data: { chartId: chart.id, metricId: mId },
        });
      }
    }

    return NextResponse.json(chart);
  } catch (error) {
    console.error('Chart POST error:', error);
    return NextResponse.json({ error: 'Failed to create chart' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(updateChartSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const chart = await db.chart.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description || null,
        chartType: body.chartType,
        dataSourceId: body.dataSourceId || null,
        dataSourceType: body.dataSourceType,
        datasetId: body.datasetId,
        config: body.config ? JSON.stringify(body.config) : undefined,
        customSQL: body.customSQL,
        layout: body.layout ? JSON.stringify(body.layout) : undefined,
        status: body.status,
        dashboardId: body.dashboardId !== undefined ? (body.dashboardId || null) : undefined,
      },
      include: { chartMetrics: { include: { metric: true } } },
    });
    return NextResponse.json(chart);
  } catch (error) {
    console.error('Chart PUT error:', error);
    return NextResponse.json({ error: 'Failed to update chart' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.chartMetric.deleteMany({ where: { chartId: id } });
    await db.chart.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chart DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete chart' }, { status: 500 });
  }
}
