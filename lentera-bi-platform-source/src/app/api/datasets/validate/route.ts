import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateVirtualDataset } from '@/lib/query/dependency';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, language, connectorId, datasetId } = body;

    if (!code || !language || !connectorId) {
      return NextResponse.json(
        { valid: false, error: 'code, language, and connectorId are required.' },
        { status: 400 },
      );
    }

    const connector = await db.connector.findUnique({ where: { id: connectorId } });
    if (!connector) {
      return NextResponse.json(
        { valid: false, errorCode: 'CONNECTOR_NOT_FOUND', error: `Connector "${connectorId}" not found.` },
        { status: 404 },
      );
    }

    const result = await validateVirtualDataset({
      sql: code,
      language,
      connectorId,
      datasetId: datasetId || undefined,
    });

    if (!result.valid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      dependencies: result.dependencies,
      dependencyCount: result.dependencies?.length ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 },
    );
  }
}