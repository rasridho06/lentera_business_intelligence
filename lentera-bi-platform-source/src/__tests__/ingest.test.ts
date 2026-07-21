import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { ingestFile } from '@/lib/ingest/duckdb';
import { db } from '@/lib/db';
import { appendAssetRevision } from '@/lib/revisions';

const TMP_DIR = join(process.cwd(), 'prisma');
const csvPath = join(TMP_DIR, 'test-ingest.csv');
const tsvPath = join(TMP_DIR, 'test-ingest.tsv');
const jsonPath = join(TMP_DIR, 'test-ingest.json');

describe('Phase 6 — file ingestion', () => {
  beforeAll(async () => {
    await writeFile(csvPath, 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCarol,35,SF');
    await writeFile(tsvPath, 'product\tprice\tstock\nWidget\t9.99\t100\nGadget\t19.99\t50');
    await writeFile(jsonPath, JSON.stringify([
      { id: 1, name: 'Alice', active: true },
      { id: 2, name: 'Bob', active: false },
    ]));
  });

  afterAll(async () => {
    for (const p of [csvPath, tsvPath, jsonPath]) {
      if (existsSync(p)) await unlink(p).catch(() => {});
    }
  });

  it('ingests CSV and infers types', async () => {
    const result = await ingestFile({ filePath: csvPath, format: 'csv', tableName: 'csv_test' });
    expect(result.columns).toHaveLength(3);
    expect(result.rowCount).toBe(3);
    expect(result.columns[0].name).toBe('name');
    expect(result.columns[1].type).toBe('Int64');
  });

  it('ingests TSV', async () => {
    const result = await ingestFile({ filePath: tsvPath, format: 'tsv', tableName: 'tsv_test' });
    expect(result.rowCount).toBe(2);
  });

  it('ingests JSON', async () => {
    const result = await ingestFile({ filePath: jsonPath, format: 'json', tableName: 'json_test' });
    expect(result.rowCount).toBe(2);
  });

  it('respects maxRows limit', async () => {
    const result = await ingestFile({ filePath: csvPath, format: 'csv', tableName: 'limit_test', maxRows: 1 });
    expect(result.rowCount).toBe(1);
  });

  it('infers type from sample values', async () => {
    // age column is all integers
    const result = await ingestFile({ filePath: csvPath, format: 'csv' });
    const ageCol = result.columns.find(c => c.name === 'age');
    expect(ageCol!.type).toBe('Int64');
  });
});

describe('Phase 6 — upload + revision integration', () => {
  let connectorId = '';

  afterAll(async () => {
    if (connectorId) {
      await db.dataSourceTable.deleteMany({ where: { connectorId } }).catch(() => {});
      await db.assetRevision.deleteMany({ where: { assetId: connectorId } }).catch(() => {});
      await db.connector.delete({ where: { id: connectorId } }).catch(() => {});
    }
  });

  it('creates connector + tables + revision on upload', async () => {
    const c = await db.connector.create({
      data: {
        name: 'test.csv',
        type: 'csv',
        category: 'file',
        filePath: csvPath,
        fileConfig: JSON.stringify({ format: 'csv' }),
        status: 'connected',
        tables: { create: [{ schema: 'uploaded', name: 'csv_test', type: 'table', rowCount: 2, columns: JSON.stringify([{ name: 'name', type: 'String' }, { name: 'score', type: 'Int64' }]) }] },
      },
      include: { tables: true },
    });
    connectorId = c.id;
    expect(c.tables).toHaveLength(1);

    await appendAssetRevision({
      assetType: 'connector', assetId: c.id, action: 'create',
      after: { name: 'test.csv', type: 'csv', rowCount: 2, columns: 2 },
    });
    const rev = await db.assetRevision.findFirst({ where: { assetId: c.id }, orderBy: { revision: 'desc' } });
    expect(rev).not.toBeNull();
    expect(rev!.action).toBe('create');
  });
});