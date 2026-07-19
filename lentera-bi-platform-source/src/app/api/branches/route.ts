import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createBranchSchema, validateBody } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const dashboardId = request.nextUrl.searchParams.get('dashboardId');
    if (dashboardId) {
      const branches = await db.dashboardBranch.findMany({
        where: { dashboardId },
        include: { mergeRequests: true },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(branches);
    }
    const allBranches = await db.dashboardBranch.findMany({
      include: { mergeRequests: true, dashboard: { select: { name: true } } },
    });
    return NextResponse.json(allBranches);
  } catch (error) {
    console.error('Branches GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(createBranchSchema, body);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });
    const branch = await db.dashboardBranch.create({
      data: {
        dashboardId: body.dashboardId,
        name: body.name,
        description: body.description || null,
        baseBranch: body.baseBranch || 'main',
        baseCommitAt: new Date(),
        status: 'active',
        ownerUserId: body.ownerUserId || null,
      },
    });
    return NextResponse.json(branch);
  } catch (error) {
    console.error('Branch POST error:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}
