import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { appendAssetRevision, restoreAssetRevision, sanitizeRevisionSnapshot } from '@/lib/revisions';

afterEach(async () => {
  await db.jobRun.deleteMany();
  await db.jobDefinition.deleteMany();
  await db.assetRevision.deleteMany();
  await db.auditEvent.deleteMany();
});

describe('asset revisions', () => {
  it('redacts secrets, appends revisions, and restores without rewriting history', async () => {
    expect(sanitizeRevisionSnapshot({ password: 'secret', rawFile: 'rows', name: 'Sales' }))
      .toEqual({ password: '[REDACTED]', rawFile: '[REDACTED]', name: 'Sales' });

    const first = await appendAssetRevision({
      assetType: 'dataset', assetId: 'dataset-revision-test', actorId: 'user-1', action: 'create',
      after: { name: 'Sales', password: 'secret', rawFile: 'rows' },
    });
    const second = await appendAssetRevision({
      assetType: 'dataset', assetId: 'dataset-revision-test', actorId: 'user-1', action: 'update',
      after: { name: 'Revenue' },
    });
    const restored = await restoreAssetRevision({
      assetType: 'dataset', assetId: 'dataset-revision-test', targetRevisionId: first.id,
      actorId: 'user-2', reason: 'Restore the approved dataset definition',
    });
    const job = await db.jobDefinition.create({
      data: { assetType: 'dataset', assetId: 'dataset-revision-test', schedule: '0 2 * * *', enabled: true },
    });
    const run = await db.jobRun.create({
      data: { jobId: job.id, status: 'success', outputRevisionId: restored.id, auditEventId: restored.auditEventId },
    });

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    expect(restored.revision).toBe(3);
    expect(JSON.parse(first.afterJson)).toMatchObject({ password: '[REDACTED]', rawFile: '[REDACTED]' });
    expect(JSON.parse(restored.afterJson)).toMatchObject({ name: 'Sales' });
    expect(run.outputRevisionId).toBe(restored.id);
  });
});