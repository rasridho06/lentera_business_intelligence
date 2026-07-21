import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/governance/timeline?assetType=dataset&assetId=xxx
// Returns the append-only revision timeline for a governed asset.
export async function GET(request: NextRequest) {
  const assetType = request.nextUrl.searchParams.get('assetType');
  const assetId = request.nextUrl.searchParams.get('assetId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

  if (!assetType || !assetId) {
    return NextResponse.json({ error: 'assetType and assetId required' }, { status: 400 });
  }

  try {
    const revisions = await db.assetRevision.findMany({
      where: { assetType, assetId },
      orderBy: { revision: 'desc' },
      take: limit,
      include: { auditEvent: { select: { actorId: true, action: true, reason: true, createdAt: true } } },
    });

    const timeline = revisions.map((r) => ({
      revision: r.revision,
      action: r.action,
      actorId: r.actorId || r.auditEvent.actorId,
      reason: r.reason || r.auditEvent.reason,
      before: r.beforeJson ? JSON.parse(r.beforeJson) : null,
      after: JSON.parse(r.afterJson),
      contentHash: r.contentHash,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ assetType, assetId, revisions: timeline });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}