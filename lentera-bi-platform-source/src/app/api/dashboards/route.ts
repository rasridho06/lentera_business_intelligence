import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createDashboardSchema, updateDashboardSchema, validateBody } from '@/lib/validations';

export async function GET() {
  try {
    const dashboards = await db.dashboard.findMany({
      include: {
        charts: { include: { chartMetrics: { include: { metric: true } } } },
        datasets: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(dashboards);
  } catch (error) {
    console.error('Dashboards GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboards' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(createDashboardSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const dashboard = await db.dashboard.create({
      data: {
        name: body.name,
        description: body.description || null,
        layout: body.layout ? JSON.stringify(body.layout) : null,
        filters: body.filters ? JSON.stringify(body.filters) : null,
        isPublic: body.isPublic || false,
        status: 'draft',
        branch: 'main',
        ownerUserId: body.ownerUserId || null,
      },
      include: { charts: true },
    });
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('Dashboard POST error:', error);
    return NextResponse.json({ error: 'Failed to create dashboard' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(updateDashboardSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const dashboard = await db.dashboard.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description || null,
        layout: body.layout ? JSON.stringify(body.layout) : undefined,
        filters: body.filters ? JSON.stringify(body.filters) : undefined,
        isPublic: body.isPublic,
        status: body.status,
      },
      include: { charts: { include: { chartMetrics: true } } },
    });
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('Dashboard PUT error:', error);
    return NextResponse.json({ error: 'Failed to update dashboard' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.chartMetric.deleteMany({ where: { chart: { dashboardId: id } } });
    await db.chart.deleteMany({ where: { dashboardId: id } });
    await db.dashboard.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dashboard DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete dashboard' }, { status: 500 });
  }
}
