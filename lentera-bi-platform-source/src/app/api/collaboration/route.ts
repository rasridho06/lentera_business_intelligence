import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const dashboardId = request.nextUrl.searchParams.get('dashboardId');
    if (dashboardId) {
      const sessions = await db.collaborationSession.findMany({
        where: { dashboardId, status: 'active' },
      });
      // Add user info
      const enriched = await Promise.all(sessions.map(async (s) => {
        const user = await db.user.findUnique({ where: { id: s.userId } });
        return { ...s, user };
      }));
      return NextResponse.json(enriched);
    }
    const allSessions = await db.collaborationSession.findMany({
      where: { status: 'active' },
    });
    return NextResponse.json(allSessions);
  } catch (error) {
    console.error('Collaboration GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await db.collaborationSession.upsert({
      where: { dashboardId_userId: { dashboardId: body.dashboardId, userId: body.userId } },
      create: {
        dashboardId: body.dashboardId,
        userId: body.userId,
        cursorX: body.cursorX || 0,
        cursorY: body.cursorY || 0,
        activeChartId: body.activeChartId || null,
        status: 'active',
        lastSeenAt: new Date(),
      },
      update: {
        cursorX: body.cursorX ?? undefined,
        cursorY: body.cursorY ?? undefined,
        activeChartId: body.activeChartId ?? undefined,
        status: 'active',
        lastSeenAt: new Date(),
      },
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error('Collaboration POST error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
