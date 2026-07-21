import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { appendAssetRevision } from '@/lib/revisions';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: datasetId } = await params;
  try {
    const body = await request.json();
    const { columns, freshnessSeconds, acceptedValues } = body;

    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json({ error: 'columns (array) is required.' }, { status: 400 });
    }

    const ds = await db.dataset.findUnique({ where: { id: datasetId } });
    if (!ds) return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });

    const contract = await db.datasetContract.upsert({
      where: { datasetId },
      create: {
        datasetId,
        columns: JSON.stringify(columns),
        freshnessSeconds: freshnessSeconds ?? null,
        acceptedValues: acceptedValues ? JSON.stringify(acceptedValues) : null,
      },
      update: {
        columns: JSON.stringify(columns),
        freshnessSeconds: freshnessSeconds ?? null,
        acceptedValues: acceptedValues ? JSON.stringify(acceptedValues) : null,
      },
    });

    await appendAssetRevision({
      assetType: 'dataset',
      assetId: datasetId,
      action: 'contract_updated',
      after: { columns: columns.length, freshnessSeconds },
    });

    return NextResponse.json({ id: contract.id, columns, freshnessSeconds, acceptedValues });
  } catch (error) {
    console.error('Contract POST error:', error);
    return NextResponse.json({ error: 'Failed to save contract' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await db.datasetContract.findUnique({ where: { datasetId: id } });
  if (!contract) return NextResponse.json({ error: 'No contract found.' }, { status: 404 });
  return NextResponse.json({
    id: contract.id,
    columns: JSON.parse(contract.columns as string),
    freshnessSeconds: contract.freshnessSeconds,
    acceptedValues: contract.acceptedValues ? JSON.parse(contract.acceptedValues as string) : null,
  });
}