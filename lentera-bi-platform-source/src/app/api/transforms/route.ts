import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createTransformSchema, updateTransformSchema, validateBody } from '@/lib/validations';

export async function GET() {
  try {
    const transforms = await db.transform.findMany({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json(transforms);
  } catch (error) {
    console.error('Transforms GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch transforms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(createTransformSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const transform = await db.transform.create({
      data: {
        name: body.name,
        description: body.description || null,
        type: body.type || 'sql',
        code: body.code || '',
        config: body.config ? JSON.stringify(body.config) : null,
        inputTables: body.inputTables ? JSON.stringify(body.inputTables) : null,
        outputSpec: body.outputSpec ? JSON.stringify(body.outputSpec) : null,
        schedule: body.schedule || 'manual',
        environment: body.environment ? JSON.stringify(body.environment) : null,
        status: 'draft',
        branch: 'main',
        ownerUserId: body.ownerUserId || null,
      },
    });
    return NextResponse.json(transform);
  } catch (error) {
    console.error('Transform POST error:', error);
    return NextResponse.json({ error: 'Failed to create transform' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(updateTransformSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const transform = await db.transform.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description || null,
        type: body.type,
        code: body.code,
        config: body.config ? JSON.stringify(body.config) : undefined,
        inputTables: body.inputTables ? JSON.stringify(body.inputTables) : undefined,
        outputSpec: body.outputSpec ? JSON.stringify(body.outputSpec) : undefined,
        schedule: body.schedule,
        environment: body.environment ? JSON.stringify(body.environment) : undefined,
        status: body.status,
        lastRunStatus: body.lastRunStatus,
        lastRunAt: body.lastRunAt ? new Date(body.lastRunAt) : undefined,
      },
    });
    return NextResponse.json(transform);
  } catch (error) {
    console.error('Transform PUT error:', error);
    return NextResponse.json({ error: 'Failed to update transform' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.transform.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Transform DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete transform' }, { status: 500 });
  }
}
