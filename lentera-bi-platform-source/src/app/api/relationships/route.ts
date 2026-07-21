import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { appendAssetRevision } from '@/lib/revisions';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  try {
    if (id) {
      const rel = await db.relationship.findUnique({ where: { id } });
      if (!rel) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(rel);
    }
    const rels = await db.relationship.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json(rels);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch relationships' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceTableId, targetTableId, sourceColumn, targetColumn, cardinality, filterDirection } = body;
    if (!sourceTableId || !targetTableId || !sourceColumn || !targetColumn) {
      return NextResponse.json({ error: 'sourceTableId, targetTableId, sourceColumn, and targetColumn are required.' }, { status: 400 });
    }
    const rel = await db.relationship.create({
      data: { sourceTableId, targetTableId, sourceColumn, targetColumn, cardinality: cardinality || 'many_to_one', filterDirection: filterDirection || 'both' },
    });
    await appendAssetRevision({ assetType: 'relationship', assetId: rel.id, action: 'create', after: { sourceTableId, targetTableId, sourceColumn, targetColumn } });
    return NextResponse.json(rel);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create relationship' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, cardinality, filterDirection, isActive, validationStatus } = body;
    if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

    const before = await db.relationship.findUnique({ where: { id }, select: { cardinality: true, isActive: true, validationStatus: true } });
    if (!before) return NextResponse.json({ error: 'Relationship not found.' }, { status: 404 });

    const rel = await db.relationship.update({
      where: { id },
      data: {
        ...(cardinality !== undefined ? { cardinality } : {}),
        ...(filterDirection !== undefined ? { filterDirection } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(validationStatus !== undefined ? { validationStatus } : {}),
      },
    });

    await appendAssetRevision({
      assetType: 'relationship',
      assetId: id,
      action: 'update',
      before: { cardinality: before.cardinality, isActive: before.isActive, validationStatus: before.validationStatus },
      after: { cardinality: rel.cardinality, isActive: rel.isActive, validationStatus: rel.validationStatus },
    });

    return NextResponse.json(rel);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update relationship' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    const rel = await db.relationship.findUnique({ where: { id }, select: { sourceTableId: true, targetTableId: true } });
    await db.relationship.delete({ where: { id } });
    if (rel) {
      await appendAssetRevision({
        assetType: 'relationship',
        assetId: id,
        action: 'delete',
        reason: 'Relationship deleted via API',
        before: { sourceTableId: rel.sourceTableId, targetTableId: rel.targetTableId },
        after: null,
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete relationship' }, { status: 500 });
  }
}
