import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { checkContracts, type ColumnContract } from '@/lib/query/contract-check';
import { appendAssetRevision } from '@/lib/revisions';

describe('dataset contracts', () => {
  let datasetId: string;
  let connectorId: string;

  beforeAll(async () => {
    const c = await db.connector.create({
      data: {
        name: 'contract-test',
        type: 'clickhouse',
        host: 'localhost',
        port: 8123,
        database: 'default',
        username: 'default',
        password: '',
        status: 'connected',
        tables: { create: [{ schema: 'public', name: 'users', type: 'table', columns: '[]' }] },
      },
    });
    connectorId = c.id;

    const ds = await db.dataset.create({
      data: { name: 'contract-ds', type: 'virtual', language: 'sql', code: 'SELECT 1', connectorId },
    });
    datasetId = ds.id;
  });

  afterAll(async () => {
    await db.datasetContract.deleteMany({ where: { datasetId } });
    await db.assetRevision.deleteMany({ where: { assetId: datasetId } });
    await db.auditEvent.deleteMany();
    await db.dataset.delete({ where: { id: datasetId } }).catch(() => {});
    await db.dataSourceTable.deleteMany({ where: { connectorId } });
    await db.connector.delete({ where: { id: connectorId } }).catch(() => {});
  });

  it('passes when no contract exists', async () => {
    const result = await checkContracts(datasetId, {
      rows: [{ name: 'Alice', age: 30 }],
      columns: [{ name: 'name', type: 'String' }, { name: 'age', type: 'Int32' }],
      rowCount: 1,
      truncated: false,
      elapsedMs: 0,
    });
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects missing column', async () => {
    const columns: ColumnContract[] = [{ name: 'name', type: 'String' }, { name: 'email', type: 'String' }];
    await db.datasetContract.upsert({
      where: { datasetId },
      create: { datasetId, columns: JSON.stringify(columns) },
      update: { columns: JSON.stringify(columns) },
    });

    const result = await checkContracts(datasetId, {
      rows: [{ name: 'Alice' }],
      columns: [{ name: 'name', type: 'String' }],
      rowCount: 1,
      truncated: false,
      elapsedMs: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.rule === 'missing_column')).toBe(true);
  });

  it('detects incompatible type', async () => {
    const columns: ColumnContract[] = [{ name: 'name', type: 'Int64' }];
    await db.datasetContract.upsert({
      where: { datasetId },
      create: { datasetId, columns: JSON.stringify(columns) },
      update: { columns: JSON.stringify(columns) },
    });

    const result = await checkContracts(datasetId, {
      rows: [{ name: 'Alice' }],
      columns: [{ name: 'name', type: 'String' }],
      rowCount: 1,
      truncated: false,
      elapsedMs: 0,
    });

    expect(result.violations.some((v) => v.rule === 'incompatible_type')).toBe(true);
  });

  it('detects uniqueness violation', async () => {
    const columns: ColumnContract[] = [{ name: 'category', type: 'String', unique: true }];
    await db.datasetContract.upsert({
      where: { datasetId },
      create: { datasetId, columns: JSON.stringify(columns) },
      update: { columns: JSON.stringify(columns) },
    });

    const result = await checkContracts(datasetId, {
      rows: [{ category: 'A' }, { category: 'A' }, { category: 'B' }],
      columns: [{ name: 'category', type: 'String' }],
      rowCount: 3,
      truncated: false,
      elapsedMs: 0,
    });

    expect(result.violations.some((v) => v.rule === 'uniqueness')).toBe(true);
  });

  it('detects accepted values violation', async () => {
    const columns: ColumnContract[] = [{ name: 'status', type: 'String' }];
    await db.datasetContract.upsert({
      where: { datasetId },
      create: {
        datasetId,
        columns: JSON.stringify(columns),
        acceptedValues: JSON.stringify({ status: ['active', 'inactive'] }),
      },
      update: {
        columns: JSON.stringify(columns),
        acceptedValues: JSON.stringify({ status: ['active', 'inactive'] }),
      },
    });

    const result = await checkContracts(datasetId, {
      rows: [{ status: 'deleted' }],
      columns: [{ name: 'status', type: 'String' }],
      rowCount: 1,
      truncated: false,
      elapsedMs: 0,
    });

    expect(result.violations.some((v) => v.rule === 'accepted_values' && v.actual === 'deleted')).toBe(true);
  });

  it('passes when all contracts are satisfied', async () => {
    const columns: ColumnContract[] = [{ name: 'name', type: 'String' }, { name: 'age', type: 'Int32' }];
    await db.datasetContract.upsert({
      where: { datasetId },
      create: { datasetId, columns: JSON.stringify(columns) },
      update: { columns: JSON.stringify(columns) },
    });

    const result = await checkContracts(datasetId, {
      rows: [{ name: 'Alice', age: 30 }],
      columns: [{ name: 'name', type: 'String' }, { name: 'age', type: 'Int32' }],
      rowCount: 1,
      truncated: false,
      elapsedMs: 0,
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('creates audit-linked revision on check', async () => {
    const columns: ColumnContract[] = [{ name: 'x', type: 'String' }];
    await db.datasetContract.upsert({
      where: { datasetId },
      create: { datasetId, columns: JSON.stringify(columns) },
      update: { columns: JSON.stringify(columns) },
    });

    const result = await checkContracts(datasetId, {
      rows: [{ x: 'ok' }],
      columns: [{ name: 'x', type: 'String' }],
      rowCount: 1,
      truncated: false,
      elapsedMs: 0,
    });

    expect(result.passed).toBe(true);

    const revision = await db.assetRevision.findFirst({
      where: { assetId: datasetId, action: 'contract_passed' },
      orderBy: { createdAt: 'desc' },
    });
    expect(revision).not.toBeNull();
  });
});