import { db } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { appendAssetRevision } from '@/lib/revisions';

// ponytail: single-process SQLite-backed scheduler. Claims one runnable
// job at a time with a per-job lock, executes the SQL/Python dataset code,
// records the outcome as a JobRun. No cron parsing — the caller (API
// endpoint or external cron) decides when to tick.

const JOB_LOCK_TTL_MS = 5 * 60_000; // 5 min

export interface SchedulerTickResult {
  jobsRun: number;
  jobsSkipped: number;
  errors: string[];
}

export async function schedulerTick(): Promise<SchedulerTickResult> {
  const now = new Date();
  const errors: string[] = [];
  let runCount = 0;
  let skipCount = 0;

  // Find jobs that are enabled, due, and not currently locked.
  const dueJobs = await db.jobDefinition.findMany({
    where: {
      enabled: true,
      OR: [
        { nextRunAt: { lte: now } },
        { nextRunAt: null },
      ],
      lockKey: null,
    },
    take: 5,
  });

  for (const job of dueJobs) {
    const lockKey = randomUUID();
    // Claim the job.
    const claimed = await db.jobDefinition.updateMany({
      where: { id: job.id, lockKey: null },
      data: { lockKey, lockedAt: now },
    });

    if (claimed.count === 0) { skipCount++; continue; }

    try {
      const dataset = await db.dataset.findFirst({
        where: { id: job.assetType === 'dataset' ? job.assetId : undefined },
        select: { id: true, name: true, code: true, connectorId: true, language: true },
      });

      if (!dataset || !dataset.code) {
        await db.jobRun.create({
          data: { jobId: job.id, status: 'failed', errorSummary: 'Dataset or code not found', finishedAt: new Date() },
        });
        await db.jobDefinition.update({ where: { id: job.id }, data: { lockKey: null, consecutiveFailures: (job.consecutiveFailures || 0) + 1 } });
        errors.push(`Job ${job.id}: dataset not found`);
        continue;
      }

      // Execute via the existing ClickHouse adapter.
      const { executeClickHouseQuery } = await import('@/lib/query/clickhouse');
      const connector = await db.connector.findUnique({ where: { id: dataset.connectorId! } });

      if (!connector || connector.status !== 'connected') {
        await db.jobRun.create({
          data: { jobId: job.id, status: 'failed', errorSummary: 'Connector not connected', finishedAt: new Date() },
        });
        errors.push(`Job ${job.id}: connector not connected`);
      } else {
        const result = await executeClickHouseQuery({
          sql: `${dataset.code} LIMIT 1000`,
          connector: {
            host: connector.host!,
            port: connector.port!,
            database: connector.database!,
            username: connector.username!,
            password: connector.password ?? '',
          },
          timeout: 300_000,
          maxRows: 1000,
          maxBytes: 5_242_880,
        });

        const revision = await appendAssetRevision({
          assetType: 'dataset',
          assetId: dataset.id,
          action: 'scheduled_run',
          after: { rowCount: result.rowCount, columns: result.columns.map(c => c.name) },
        });

        await db.jobRun.create({
          data: {
            jobId: job.id,
            status: 'success',
            outputRevisionId: revision.id,
            finishedAt: new Date(),
          },
        });
      }

      runCount++;
      // Clear lock for next tick.
      await db.jobDefinition.update({
        where: { id: job.id },
        data: { lockKey: null, nextRunAt: new Date(Date.now() + 3600_000), consecutiveFailures: 0 },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await db.jobRun.create({
        data: { jobId: job.id, status: 'failed', errorSummary: message, finishedAt: new Date() },
      });
      await db.jobDefinition.update({
        where: { id: job.id },
        data: { lockKey: null, consecutiveFailures: (job.consecutiveFailures || 0) + 1 },
      });
      errors.push(`Job ${job.id}: ${message}`);
    }
  }

  // Unlock stale jobs (> TTL since lock).
  const stale = await db.jobDefinition.findMany({
    where: { lockKey: { not: null }, lockedAt: { lte: new Date(Date.now() - JOB_LOCK_TTL_MS) } },
  });
  for (const s of stale) {
    await db.jobDefinition.update({ where: { id: s.id }, data: { lockKey: null } });
    skipCount++;
  }

  return { jobsRun: runCount, jobsSkipped: skipCount, errors };
}