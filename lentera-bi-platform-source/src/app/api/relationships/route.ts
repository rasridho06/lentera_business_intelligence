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

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  try {
    await db.relationship.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete relationship' }, { status: 500 });
  }
}