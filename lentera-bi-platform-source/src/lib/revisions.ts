import { createHash, randomUUID } from 'node:crypto';
import { db } from '@/lib/db';

export const GOVERNED_ASSET_TYPES = [
  'connector', 'table', 'dataset', 'metric', 'relationship', 'chart', 'dashboard',
] as const;

type Snapshot = Record<string, unknown> | null;

type AppendRevisionInput = {
  assetType: (typeof GOVERNED_ASSET_TYPES)[number];
  assetId: string;
  actorId?: string;
  action: string;
  reason?: string;
  before?: Snapshot;
  after: Snapshot;
  auditEventId?: string;
  correlationId?: string;
};

const redactedKey = /password|secret|token|api[-_]?key|credential|filecontents?|rawfile/i;

export function sanitizeRevisionSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeRevisionSnapshot);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    redactedKey.test(key) ? '[REDACTED]' : sanitizeRevisionSnapshot(item),
  ]));
}

function stringifySnapshot(snapshot: Snapshot) {
  return JSON.stringify(sanitizeRevisionSnapshot(snapshot) ?? null);
}

export async function appendAssetRevision(input: AppendRevisionInput) {
  return db.$transaction(async (tx) => {
    const auditEvent = input.auditEventId
      ? await tx.auditEvent.findUniqueOrThrow({ where: { id: input.auditEventId } })
      : await tx.auditEvent.create({
          data: {
            correlationId: input.correlationId ?? randomUUID(),
            actorId: input.actorId,
            action: input.action,
            reason: input.reason,
          },
        });
    const latest = await tx.assetRevision.findFirst({
      where: { assetType: input.assetType, assetId: input.assetId },
      orderBy: { revision: 'desc' },
    });
    const afterJson = stringifySnapshot(input.after);

    return tx.assetRevision.create({
      data: {
        assetType: input.assetType,
        assetId: input.assetId,
        revision: (latest?.revision ?? 0) + 1,
        actorId: input.actorId,
        action: input.action,
        reason: input.reason,
        beforeJson: input.before === undefined ? latest?.afterJson ?? null : stringifySnapshot(input.before),
        afterJson,
        contentHash: createHash('sha256').update(afterJson).digest('hex'),
        auditEventId: auditEvent.id,
      },
    });
  });
}

export async function restoreAssetRevision(input: {
  assetType: AppendRevisionInput['assetType'];
  assetId: string;
  targetRevisionId: string;
  actorId?: string;
  reason: string;
}) {
  const target = await db.assetRevision.findFirstOrThrow({
    where: { id: input.targetRevisionId, assetType: input.assetType, assetId: input.assetId },
  });

  return appendAssetRevision({
    assetType: input.assetType,
    assetId: input.assetId,
    actorId: input.actorId,
    action: 'restore',
    reason: input.reason,
    after: JSON.parse(target.afterJson) as Snapshot,
  });
}