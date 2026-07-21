import { NextResponse } from 'next/server';
import { schedulerTick } from '@/lib/scheduler/runner';

// POST /api/scheduler/tick — trigger one scheduler tick.
// Intended to be called by an external cron job or manual trigger.
export async function POST() {
  try {
    const result = await schedulerTick();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Scheduler tick failed.' }, { status: 500 });
  }
}