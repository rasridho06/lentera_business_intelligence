import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createDatasetSchema, updateDatasetSchema, validateBody } from '@/lib/validations';
import { validateVirtualDataset, replaceDependencies, detectCycles } from '@/lib/query/dependency';
import { appendAssetRevision } from '@/lib/revisions';

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

    // Phase 5b: validate SQL + resolve dependencies before saving.
    if (body.code && body.language === 'sql' && body.connectorId) {
      const result = await validateVirtualDataset({
        sql: body.code,
        language: body.language,
        connectorId: body.connectorId,
      });
      if (!result.valid) {
        return NextResponse.json({ error: result.error, code: result.errorCode }, { status: 400 });
      }
      // Check for self-referencing cycle during create (deps written after create).
      // ponytail: defer full cycle check to after row exists; immediate validation
      // only rejects non-read-only SQL and unresolvable connector refs.
    }

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

    // Populate dependencies after create so the row exists for cycle check.
    if (body.code && body.language === 'sql' && body.connectorId) {
      const depsResult = await validateVirtualDataset({
        sql: body.code,
        language: body.language,
        connectorId: body.connectorId,
        datasetId: dataset.id,
      });
      if (depsResult.valid && depsResult.dependencies) {
        await replaceDependencies(dataset.id, depsResult.dependencies);
      }
    }

    // Write an immutable revision.
    await appendAssetRevision({
      assetType: 'dataset',
      assetId: dataset.id,
      action: 'create',
      after: { name: dataset.name, type: dataset.type, language: dataset.language, status: dataset.status },
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

    // Phase 5b: validate SQL + resolve dependencies before saving.
    if (body.code && body.language === 'sql' && body.connectorId) {
      const result = await validateVirtualDataset({
        sql: body.code,
        language: body.language,
        connectorId: body.connectorId,
        datasetId: body.id,
      });
      if (!result.valid) {
        return NextResponse.json({ error: result.error, code: result.errorCode }, { status: 400 });
      }
    }

    const before = await db.dataset.findUnique({ where: { id: body.id }, select: { name: true, code: true, status: true } });

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

    // Refresh dependencies.
    if (body.code && body.connectorId && body.language === 'sql') {
      const depsResult = await validateVirtualDataset({
        sql: body.code,
        language: body.language,
        connectorId: body.connectorId,
        datasetId: body.id,
      });
      if (depsResult.valid && depsResult.dependencies) {
        await replaceDependencies(body.id, depsResult.dependencies);
      }
    }

    // Write revision.
    await appendAssetRevision({
      assetType: 'dataset',
      assetId: dataset.id,
      action: 'update',
      before: before ? { name: before.name, status: before.status } : null,
      after: { name: dataset.name, status: dataset.status },
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
    const dataset = await db.dataset.findUnique({ where: { id }, select: { name: true } });
    await db.datasetDependency.deleteMany({ where: { datasetId: id } });
    await db.dataset.delete({ where: { id } });
    if (dataset) {
      await appendAssetRevision({
        assetType: 'dataset',
        assetId: id,
        action: 'delete',
        reason: 'Dataset deleted via API',
        before: { name: dataset.name },
        after: null,
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dataset DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete dataset' }, { status: 500 });
  }
}