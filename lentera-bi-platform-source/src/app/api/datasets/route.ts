import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createDatasetSchema, updateDatasetSchema, validateBody } from '@/lib/validations';

export async function GET() {
  try {
    const datasets = await db.dataset.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json(datasets);
  } catch (error) {
    console.error('Datasets GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch datasets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(createDatasetSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const dataset = await db.dataset.create({
      data: {
        name: body.name,
        description: body.description || null,
        type: body.type || 'virtual',
        language: body.language || 'sql',
        code: body.code || null,
        sourceTables: body.sourceTables ? JSON.stringify(body.sourceTables) : null,
        outputColumns: body.outputColumns ? JSON.stringify(body.outputColumns) : null,
        connectorId: body.connectorId || null,
        schedule: body.schedule || 'manual',
        status: 'draft',
        branch: 'main',
        ownerUserId: body.ownerUserId || null,
        dashboardId: body.dashboardId || null,
      },
    });
    return NextResponse.json(dataset);
  } catch (error) {
    console.error('Dataset POST error:', error);
    return NextResponse.json({ error: 'Failed to create dataset' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(updateDatasetSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const dataset = await db.dataset.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description || null,
        type: body.type,
        language: body.language,
        code: body.code,
        sourceTables: body.sourceTables ? JSON.stringify(body.sourceTables) : undefined,
        outputColumns: body.outputColumns ? JSON.stringify(body.outputColumns) : undefined,
        connectorId: body.connectorId,
        schedule: body.schedule,
        status: body.status,
        lastRunStatus: body.lastRunStatus,
        lastRunAt: body.lastRunAt ? new Date(body.lastRunAt) : undefined,
      },
    });
    return NextResponse.json(dataset);
  } catch (error) {
    console.error('Dataset PUT error:', error);
    return NextResponse.json({ error: 'Failed to update dataset' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.dataset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dataset DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete dataset' }, { status: 500 });
  }
}
