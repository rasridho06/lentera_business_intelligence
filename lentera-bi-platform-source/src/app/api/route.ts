import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'healthy', db: 'connected' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'unhealthy', db: 'disconnected' }, { status: 503 });
  }
}
