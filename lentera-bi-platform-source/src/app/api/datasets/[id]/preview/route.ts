import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { executeClickHouseQuery } from '@/lib/query/clickhouse';
import { validateQuery } from '@/lib/query/sql-validator';
import { checkContracts } from '@/lib/query/contract-check';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: datasetId } = await params;
  try {
    const dataset = await db.dataset.findUnique({
      where: { id: datasetId },
      select: { id: true, name: true, code: true, language: true, connectorId: true },
    });

    if (!dataset) return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    if (!dataset.code || !dataset.connectorId) {
      return NextResponse.json({ error: 'Dataset has no code or connector.' }, { status: 400 });
    }

    const connector = await db.connector.findUnique({
      where: { id: dataset.connectorId },
      include: { tables: true },
    });

    if (!connector || connector.status !== 'connected') {
      return NextResponse.json({ error: 'Connector is not connected.' }, { status: 400 });
    }

    const allowedTables = connector.tables.map((t) => t.name);
    const validation = validateQuery(dataset.code!, allowedTables);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errorDetail, code: validation.errorCode }, { status: 400 });
    }

    let result;
    try {
      result = await executeClickHouseQuery({
        sql: `${dataset.code} LIMIT 50`,
        connector: {
          host: connector.host!,
          port: connector.port!,
          database: connector.database!,
          username: connector.username!,
          password: connector.password!,
        },
        timeout: 15_000,
        maxRows: 50,
        maxBytes: 1_048_576,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('ECONNREFUSED')) {
        return NextResponse.json({ error: 'Preview requires the connector to be reachable.', previewAvailable: false });
      }
      return NextResponse.json({
        error: 'Preview execution failed.',
        detail: message.slice(0, 500),
        previewAvailable: false,
      }, { status: 502 });
    }

    const contractResult = await checkContracts(datasetId, result);

    return NextResponse.json({
      preview: {
        rows: result.rows.slice(0, 10),
        columns: result.columns,
        totalRows: result.rowCount,
      },
      contract: {
        passed: contractResult.passed,
        violations: contractResult.violations,
      },
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Preview failed.' }, { status: 500 });
  }
}