import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import {
  resolveDependencies,
  detectCycles,
  replaceDependencies,
  validateVirtualDataset,
} from '@/lib/query/dependency';
import { isReadOnlySQL, extractTableRefs } from '@/lib/query/sql-validator';

describe('virtual dataset dependencies', () => {
  let connectorId: string;
  let datasetA: string;
  let datasetB: string;
  let datasetC: string;

  beforeAll(async () => {
    const c = await db.connector.create({
      data: {
        name: 'dep-test',
        type: 'clickhouse',
        host: 'localhost',
        port: 8123,
        database: 'default',
        username: 'default',
        password: '',
        status: 'connected',
        tables: {
          create: [
            { schema: 'public', name: 'orders', type: 'table', columns: '[]' },
            { schema: 'public', name: 'users', type: 'table', columns: '[]' },
          ],
        },
      },
    });
    connectorId = c.id;

    const a = await db.dataset.create({
      data: {
        name: 'virtual_orders',
        type: 'virtual',
        language: 'sql',
        code: 'SELECT * FROM orders',
        connectorId,
      },
    });
    datasetA = a.id;

    const b = await db.dataset.create({
      data: {
        name: 'virtual_enriched',
        type: 'virtual',
        language: 'sql',
        code: 'SELECT * FROM orders o JOIN users u ON o.user_id = u.id',
        connectorId,
      },
    });
    datasetB = b.id;

    const dc = await db.dataset.create({
      data: {
        name: 'virtual_metrics',
        type: 'virtual',
        language: 'sql',
        code: 'SELECT * FROM virtual_enriched',
        connectorId,
      },
    });
    datasetC = dc.id;
  });

  afterAll(async () => {
    await db.datasetDependency.deleteMany();
    await db.dataset.deleteMany({ where: { connectorId } });
    await db.dataSourceTable.deleteMany({ where: { connectorId } });
    await db.connector.delete({ where: { id: connectorId } }).catch(() => {});
  });

  describe('resolveDependencies', () => {
    it('resolves source-table references', async () => {
      const deps = await resolveDependencies('SELECT * FROM orders', connectorId);
      expect(deps).toHaveLength(1);
      expect(deps[0].dependencyType).toBe('source_table');
      expect(deps[0].dependsOnTable).toBe('orders');
    });

    it('resolves virtual-dataset references by name', async () => {
      const deps = await resolveDependencies('SELECT * FROM virtual_metrics', connectorId);
      expect(deps.some((d) => d.dependsOnDatasetId === datasetC)).toBe(true);
    });

    it('handles mixed source and dataset refs', async () => {
      const deps = await resolveDependencies('SELECT * FROM orders JOIN virtual_enriched', connectorId);
      const types = deps.map((d) => d.dependencyType);
      expect(types).toContain('source_table');
      expect(types).toContain('virtual_dataset');
    });
  });

  describe('cycle detection', () => {
    it('detects a direct cycle', async () => {
      await replaceDependencies(datasetA, [
        { dependsOnDatasetId: datasetB, dependencyType: 'virtual_dataset' },
      ]);
      await replaceDependencies(datasetB, [
        { dependsOnDatasetId: datasetA, dependencyType: 'virtual_dataset' },
      ]);

      const cycle = await detectCycles(datasetA);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await replaceDependencies(datasetA, []);
      await replaceDependencies(datasetB, []);
    });

    it('detects a transitive cycle (A → B → C → A)', async () => {
      await replaceDependencies(datasetA, [
        { dependsOnDatasetId: datasetB, dependencyType: 'virtual_dataset' },
      ]);
      await replaceDependencies(datasetB, [
        { dependsOnDatasetId: datasetC, dependencyType: 'virtual_dataset' },
      ]);
      await replaceDependencies(datasetC, [
        { dependsOnDatasetId: datasetA, dependencyType: 'virtual_dataset' },
      ]);

      const cycle = await detectCycles(datasetA);
      expect(cycle).not.toBeNull();

      // Clean up
      await replaceDependencies(datasetA, []);
      await replaceDependencies(datasetB, []);
      await replaceDependencies(datasetC, []);
    });

    it('returns null when no cycle exists', async () => {
      await replaceDependencies(datasetA, [
        { dependsOnDatasetId: datasetB, dependencyType: 'virtual_dataset' },
      ]);
      await replaceDependencies(datasetB, [
        { dependsOnDatasetId: datasetC, dependencyType: 'virtual_dataset' },
      ]);
      // No edge from C back to A or B.

      const cycle = await detectCycles(datasetA);
      expect(cycle).toBeNull();

      // Clean up
      await replaceDependencies(datasetA, []);
      await replaceDependencies(datasetB, []);
    });
  });

  describe('validateVirtualDataset', () => {
    it('rejects non-read-only SQL', async () => {
      const result = await validateVirtualDataset({
        sql: 'DROP TABLE orders',
        language: 'sql',
        connectorId,
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('SQL_NOT_READ_ONLY');
    });

    it('rejects circular dependency', async () => {
      // Set up: A references B. Now if B tries to reference A, it's a cycle.
      await replaceDependencies(datasetA, [
        { dependsOnDatasetId: datasetB, dependencyType: 'virtual_dataset' },
      ]);

      // B's new SQL references dataset A (virtual_orders) → creates A→B→A cycle.
      const result = await validateVirtualDataset({
        sql: 'SELECT * FROM virtual_orders',
        language: 'sql',
        connectorId,
        datasetId: datasetB,
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CIRCULAR_DEPENDENCY');

      // Clean up
      await replaceDependencies(datasetA, []);
      await replaceDependencies(datasetB, []);
    });

    it('accepts valid SQL with source-table deps', async () => {
      const result = await validateVirtualDataset({
        sql: 'SELECT * FROM orders JOIN users',
        language: 'sql',
        connectorId,
      });
      expect(result.valid).toBe(true);
      expect(result.dependencies!.some((d) => d.dependencyType === 'source_table')).toBe(true);
    });
  });
});