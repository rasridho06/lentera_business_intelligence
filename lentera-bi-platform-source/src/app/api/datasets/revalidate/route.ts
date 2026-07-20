import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateVirtualDataset, replaceDependencies } from '@/lib/query/dependency';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { datasetId } = body;

    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId is required.' }, { status: 400 });
    }

    const dataset = await db.dataset.findUnique({
      where: { id: datasetId },
      select: { id: true, code: true, language: true, connectorId: true, name: true },
    });

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }

    if (!dataset.code || !dataset.connectorId) {
      return NextResponse.json({
        datasetId,
        status: 'skipped',
        reason: 'Dataset has no code or connectorId to validate against.',
      });
    }

    const result = await validateVirtualDataset({
      sql: dataset.code,
      language: dataset.language,
      connectorId: dataset.connectorId,
      datasetId: dataset.id,
    });

    if (!result.valid) {
      // Clear dependencies on failure so stale ones don't persist.
      await replaceDependencies(dataset.id, []);
      return NextResponse.json({
        datasetId,
        status: 'invalid',
        error: result.error,
        errorCode: result.errorCode,
      });
    }

    return NextResponse.json({
      datasetId,
      status: 'valid',
      dependencyCount: result.dependencies?.length ?? 0,
      dependencies: result.dependencies,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Revalidation failed' },
      { status: 500 },
    );
  }
}