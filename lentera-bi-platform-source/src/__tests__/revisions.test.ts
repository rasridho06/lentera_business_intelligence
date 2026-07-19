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

  it('handles concurrent appends without revision collision', async () => {
    // ponytail: SQLite default journal does not serialize the read-then-write
    // pattern. Without retry-on-P2002, concurrent appendAssetRevision calls
    // for the same asset would race on MAX(revision) and surface a unique
    // constraint error. This test proves the retry path arbitrates the
    // collision and produces sequential, distinct revision numbers.
    const results = await Promise.all([
      appendAssetRevision({ assetType: 'dataset', assetId: 'race-test', action: 'create', after: { v: 1 } }),
      appendAssetRevision({ assetType: 'dataset', assetId: 'race-test', action: 'create', after: { v: 2 } }),
      appendAssetRevision({ assetType: 'dataset', assetId: 'race-test', action: 'create', after: { v: 3 } }),
    ]);

    const revisions = await db.assetRevision.findMany({
      where: { assetId: 'race-test' },
      orderBy: { revision: 'asc' },
    });

    expect(revisions.map(r => r.revision)).toEqual([1, 2, 3]);
    expect(new Set(revisions.map(r => r.revision)).size).toBe(3);
    expect(results.map(r => r.revision).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});