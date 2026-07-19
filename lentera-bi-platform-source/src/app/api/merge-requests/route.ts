import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const mergeRequests = await db.mergeRequest.findMany({
      include: { sourceBranch: { include: { dashboard: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(mergeRequests);
  } catch (error) {
    console.error('MergeRequests GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch merge requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Simulate conflict detection
    const sourceBranch = await db.dashboardBranch.findUnique({
      where: { id: body.sourceBranchId },
    });
    if (!sourceBranch) return NextResponse.json({ error: 'Source branch not found' }, { status: 404 });

    // Check for conflicts: if another MR targets same dashboard+branch and is open
    const conflictingMRs = await db.mergeRequest.findMany({
      where: {
        sourceBranch: { dashboardId: sourceBranch.dashboardId },
        targetBranch: body.targetBranch || 'main',
        status: { in: ['open', 'reviewing'] },
      },
    });

    let conflictDetails = null;
    let status = 'open';
    if (conflictingMRs.length > 0) {
      status = 'conflict';
      conflictDetails = JSON.stringify({
        reason: 'Another merge request is already pending for the same target branch',
        conflictingMRs: conflictingMRs.map(mr => mr.id),
        suggestion: 'Resolve the existing merge request first, or rebase your branch',
      });
    }

    const mr = await db.mergeRequest.create({
      data: {
        dashboardId: sourceBranch.dashboardId,
        sourceBranchId: body.sourceBranchId,
        targetBranch: body.targetBranch || 'main',
        title: body.title,
        description: body.description || null,
        status,
        conflictDetails,
        ownerUserId: body.ownerUserId || null,
        reviewerUserId: body.reviewerUserId || null,
      },
      include: { sourceBranch: true },
    });
    return NextResponse.json(mr);
  } catch (error) {
    console.error('MergeRequest POST error:', error);
    return NextResponse.json({ error: 'Failed to create merge request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'merge') {
      // Merge: update status and mark branch as merged
      const mr = await db.mergeRequest.update({
        where: { id: body.id },
        data: {
          status: 'merged',
          mergedAt: new Date(),
        },
        include: { sourceBranch: true },
      });
      if (mr.sourceBranch) {
        await db.dashboardBranch.update({
          where: { id: mr.sourceBranchId },
          data: { status: 'merged' },
        });
      }
      return NextResponse.json(mr);
    }

    if (body.action === 'resolve_conflict') {
      const mr = await db.mergeRequest.update({
        where: { id: body.id },
        data: {
          status: 'open',
          conflictDetails: null,
        },
      });
      return NextResponse.json(mr);
    }

    const mr = await db.mergeRequest.update({
      where: { id: body.id },
      data: { status: body.status },
    });
    return NextResponse.json(mr);
  } catch (error) {
    console.error('MergeRequest PUT error:', error);
    return NextResponse.json({ error: 'Failed to update merge request' }, { status: 500 });
  }
}
