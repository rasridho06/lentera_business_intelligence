import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
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

// ponytail: SQLite default journal does not serialize the read-then-write
// pattern. Two concurrent appendAssetRevision calls for the same asset
// both read the same MAX(revision), both attempt insert with revision+1,
// one wins and the other hits P2002 on the unique(assetType,assetId,revision).
// Retry the read+write a bounded number of times instead of surfacing the
// error. Upgrade path: per-asset serialized lock or INSERT ... SELECT MAX+1
// if contention becomes measurable.
const MAX_REVISION_ATTEMPTS = 3;

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

async function createRevisionWithRetry(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  baseData: {
    assetType: string;
    assetId: string;
    revision: number;
    actorId?: string;
    action: string;
    reason?: string;
    beforeJson: string | null;
    afterJson: string;
    contentHash: string;
    auditEventId: string;
  },
) {
  let data = { ...baseData };
  for (let attempt = 1; attempt <= MAX_REVISION_ATTEMPTS; attempt++) {
    try {
      return await tx.assetRevision.create({ data });
    } catch (err) {
      if (!isUniqueConstraintError(err) || attempt === MAX_REVISION_ATTEMPTS) throw err;
      // ponytail: collision on unique(assetType, assetId, revision) — recompute latest.
      const latest = await tx.assetRevision.findFirst({
        where: { assetType: baseData.assetType, assetId: baseData.assetId },
        orderBy: { revision: 'desc' },
      });
      data = { ...baseData, revision: (latest?.revision ?? 0) + 1 };
    }
  }
  // unreachable — loop either returns or throws on the final attempt
  throw new Error('createRevisionWithRetry: exhausted retries without resolution');
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

    return createRevisionWithRetry(tx, {
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