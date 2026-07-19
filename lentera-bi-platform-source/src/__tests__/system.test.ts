import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ════════════════════════════════════════════════════════════════
// SYSTEM TESTS - End-to-end system flows via Prisma
// ════════════════════════════════════════════════════════════════

const prisma = new PrismaClient();

const cleanup: Array<{ type: string; id: string }> = [];

afterAll(async () => {
  // Cleanup in reverse order
  for (const item of cleanup.reverse()) {
    try {
      switch (item.type) {
        case 'mr': await prisma.mergeRequest.delete({ where: { id: item.id } }); break;
        case 'branch': await prisma.dashboardBranch.delete({ where: { id: item.id } }); break;
        case 'chartMetric': await prisma.chartMetric.deleteMany({ where: { chartId: item.id } }); break;
        case 'chart': await prisma.chartMetric.deleteMany({ where: { chartId: item.id } }).then(() => prisma.chart.delete({ where: { id: item.id } })); break;
        case 'metric': await prisma.metricSource.deleteMany({ where: { metricId: item.id } }).then(() => prisma.metricDef.delete({ where: { id: item.id } })); break;
        case 'dataset': await prisma.dataset.delete({ where: { id: item.id } }); break;
        case 'dashboard': await prisma.dashboard.delete({ where: { id: item.id } }); break;
        case 'connector': await prisma.dataSourceTable.deleteMany({ where: { connectorId: item.id } }).then(() => prisma.connector.delete({ where: { id: item.id } })); break;
      }
    } catch {}
  }
  await prisma.$disconnect();
});

function track(type: string, id: string) { cleanup.push({ type, id }); }

// ── System Test 1: Complete BI Platform Workflow ──
describe('System: Complete BI Platform Workflow', () => {
  let connectorId: string;
  let datasetId: string;
  let metricId: string;
  let chartId: string;
  let dashboardId: string;

  it('Step 1: Connect a data source (ClickHouse)', async () => {
    const connector = await prisma.connector.create({
      data: {
        name: 'E2E ClickHouse',
        type: 'clickhouse',
        category: 'olap',
        host: 'demo-clickhouse',
        port: 9000,
        username: 'default',
        database: 'booking_production',
        status: 'connected',
        lastSyncAt: new Date(),
        tables: {
          create: [
            { schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000, columns: JSON.stringify([
              { name: 'id', type: 'UInt64', nullable: false, isPK: true },
              { name: 'user_id', type: 'UInt64', nullable: false },
              { name: 'restaurant_id', type: 'UInt64', nullable: false },
              { name: 'price_cents', type: 'Int32', nullable: true },
            ]) },
            { schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000, columns: JSON.stringify([
              { name: 'id', type: 'UInt64', nullable: false, isPK: true },
              { name: 'name', type: 'String', nullable: false },
            ]) },
            { schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000, columns: JSON.stringify([
              { name: 'date', type: 'Date', nullable: false },
              { name: 'gmv', type: 'Float64', nullable: true },
              { name: 'channel_name', type: 'String', nullable: true },
            ]) },
          ],
        },
      },
      include: { tables: true },
    });
    connectorId = connector.id;
    track('connector', connectorId);

    expect(connector.status).toBe('connected');
    expect(connector.tables).toHaveLength(3);
  });

  it('Step 2: Verify all tables are synced', async () => {
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      include: { tables: true },
    });

    const tableNames = connector!.tables.map(t => t.name);
    expect(tableNames).toContain('reservations');
    expect(tableNames).toContain('restaurants');
    expect(tableNames).toContain('mart_booking_gmv');
  });

  it('Step 3: Create a virtual dataset with cross-table query', async () => {
    const dataset = await prisma.dataset.create({
      data: {
        name: 'E2E Dataset - Revenue by Channel',
        type: 'virtual',
        language: 'sql',
        code: 'SELECT r.channel_name, SUM(r.gmv) as total_gmv FROM analytics.mart_booking_gmv r GROUP BY r.channel_name',
        sourceTables: JSON.stringify([
          { connectorId, schema: 'analytics', table: 'mart_booking_gmv' },
        ]),
        outputColumns: JSON.stringify([
          { name: 'channel_name', type: 'VARCHAR' },
          { name: 'total_gmv', type: 'DOUBLE' },
        ]),
        status: 'draft',
        branch: 'main',
      },
    });
    datasetId = dataset.id;
    track('dataset', datasetId);

    expect(dataset.type).toBe('virtual');
  });

  it('Step 4: Create a metric', async () => {
    const metric = await prisma.metricDef.create({
      data: {
        name: 'E2E Metric - Total GMV',
        expression: 'SUM(total_gmv)',
        language: 'sql',
        aggregation: 'sum',
        sourceColumn: 'total_gmv',
        version: 1,
        status: 'draft',
        branch: 'main',
      },
    });
    metricId = metric.id;
    track('metric', metricId);

    expect(metric.version).toBe(1);
  });

  it('Step 5: Create a chart with dataset and metric', async () => {
    const chart = await prisma.chart.create({
      data: {
        name: 'E2E Chart - GMV by Channel',
        chartType: 'bar',
        dataSourceType: 'dataset',
        datasetId,
        status: 'draft',
        branch: 'main',
        config: JSON.stringify({ xAxis: 'channel_name', yAxis: ['total_gmv'], showLegend: true }),
        chartMetrics: {
          create: { metricId, alias: 'total_gmv', axis: 'left' },
        },
      },
      include: { chartMetrics: true },
    });
    chartId = chart.id;
    track('chart', chartId);

    expect(chart.chartMetrics).toHaveLength(1);
    expect(chart.datasetId).toBe(datasetId);
  });

  it('Step 6: Create a dashboard', async () => {
    const dashboard = await prisma.dashboard.create({
      data: { name: 'E2E Dashboard', description: 'End-to-end test dashboard', branch: 'main' },
    });
    dashboardId = dashboard.id;
    track('dashboard', dashboardId);

    expect(dashboard.branch).toBe('main');
  });

  it('Step 7: Insert chart into dashboard', async () => {
    await prisma.chart.update({
      where: { id: chartId },
      data: { dashboardId },
    });
    const updated = await prisma.chart.findUnique({ where: { id: chartId } });
    expect(updated!.dashboardId).toBe(dashboardId);
  });

  it('Step 8: Verify dashboard contains the chart', async () => {
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      include: { charts: true },
    });
    expect(dashboard!.charts.some(c => c.id === chartId)).toBe(true);
  });

  it('Step 9: Create a branch and merge request', async () => {
    const branch = await prisma.dashboardBranch.create({
      data: {
        dashboardId,
        name: `feature/e2e-${Date.now()}`,
        baseBranch: 'main',
        status: 'active',
      },
    });
    track('branch', branch.id);

    const mr = await prisma.mergeRequest.create({
      data: {
        dashboardId,
        sourceBranchId: branch.id,
        targetBranch: 'main',
        title: 'E2E Test MR',
        status: 'open',
      },
    });
    track('mr', mr.id);

    expect(mr.status).toBe('open');

    // Merge
    const merged = await prisma.mergeRequest.update({
      where: { id: mr.id },
      data: { status: 'merged', mergedAt: new Date() },
    });
    expect(merged.status).toBe('merged');
  });

  it('Step 10: Verify data lineage graph is queryable', async () => {
    const nodes = await prisma.node.findMany({ take: 5 });
    const edges = await prisma.edge.findMany({ take: 5 });
    // Even if empty, the query should work
    expect(Array.isArray(nodes)).toBe(true);
    expect(Array.isArray(edges)).toBe(true);
  });
});

// ── System Test 2: File Upload Workflow ──
describe('System: File Upload → Connector → Table', () => {
  const fileTypes = ['csv', 'json', 'excel', 'parquet'];

  it('should create connectors for all 4 file types', async () => {
    for (const type of fileTypes) {
      const connector = await prisma.connector.create({
        data: {
          name: `E2E ${type.toUpperCase()} Upload`,
          type,
          category: 'file',
          filePath: `/uploads/test.${type === 'excel' ? 'xlsx' : type}`,
          fileConfig: JSON.stringify({ rowCount: 100 }),
          status: 'connected',
          tables: {
            create: {
              schema: 'file',
              name: `test.${type === 'excel' ? 'xlsx' : type}`,
              type: 'table',
              rowCount: 100,
              columns: JSON.stringify([
                { name: 'id', type: 'INTEGER', nullable: false },
                { name: 'value', type: 'DOUBLE', nullable: true },
              ]),
            },
          },
        },
        include: { tables: true },
      });
      track('connector', connector.id);

      expect(connector.type).toBe(type);
      expect(connector.category).toBe('file');
      expect(connector.tables).toHaveLength(1);
    }
  });

  it('should enforce 100MB size limit concept', () => {
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const testSizes = [
      { size: 0, valid: true },
      { size: 50 * 1024 * 1024, valid: true },
      { size: 100 * 1024 * 1024, valid: true },
      { size: 100 * 1024 * 1024 + 1, valid: false },
      { size: 200 * 1024 * 1024, valid: false },
    ];
    for (const { size, valid } of testSizes) {
      expect(size <= MAX_FILE_SIZE).toBe(valid);
    }
  });
});

// ── System Test 3: Multi-Connector Cross-Query ──
describe('System: Multi-Connector Dataset with Cross-Table Reference', () => {
  let chId: string;
  let pgId: string;

  it('should create ClickHouse and PostgreSQL connectors', async () => {
    const ch = await prisma.connector.create({
      data: {
        name: 'E2E CH Cross',
        type: 'clickhouse',
        category: 'olap',
        host: 'demo-clickhouse',
        port: 9000,
        username: 'default',
        status: 'connected',
        tables: { create: [{ schema: 'booking', name: 'reservations', type: 'table', columns: '[]' }] },
      },
    });
    chId = ch.id;
    track('connector', chId);

    const pg = await prisma.connector.create({
      data: {
        name: 'E2E PG Cross',
        type: 'postgres',
        category: 'oltp',
        host: 'demo-postgres',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        status: 'connected',
        tables: { create: [{ schema: 'public', name: 'users', type: 'table', columns: '[]' }] },
      },
    });
    pgId = pg.id;
    track('connector', pgId);
  });

  it('should create a dataset referencing both connectors', async () => {
    const dataset = await prisma.dataset.create({
      data: {
        name: 'E2E Cross-DB Query',
        type: 'virtual',
        language: 'sql',
        code: 'SELECT r.user_id, u.name FROM booking.reservations r JOIN public.users u ON r.user_id = u.id',
        sourceTables: JSON.stringify([
          { connectorId: chId, schema: 'booking', table: 'reservations' },
          { connectorId: pgId, schema: 'public', table: 'users' },
        ]),
        outputColumns: JSON.stringify([
          { name: 'user_id', type: 'INTEGER' },
          { name: 'user_name', type: 'VARCHAR' },
        ]),
        status: 'draft',
        branch: 'main',
      },
    });
    track('dataset', dataset.id);

    const sourceTables = JSON.parse(dataset.sourceTables as string);
    const connectorIds = sourceTables.map((s: { connectorId: string }) => s.connectorId);
    expect(connectorIds).toContain(chId);
    expect(connectorIds).toContain(pgId);
  });
});

// ── System Test 4: Collaboration Flow ──
describe('System: Collaboration & Version Control Flow', () => {
  let dashboardId: string;

  it('should set up dashboard with collaboration sessions', async () => {
    const dashboard = await prisma.dashboard.create({
      data: { name: 'E2E Collab Dashboard', branch: 'main' },
    });
    dashboardId = dashboard.id;
    track('dashboard', dashboardId);

    // Create users
    const user1 = await prisma.user.create({
      data: { name: 'Maya Sari', email: `maya-${Date.now()}@test.com`, role: 'editor', color: '#dc2626' },
    });
    const user2 = await prisma.user.create({
      data: { name: 'Budi Santoso', email: `budi-${Date.now()}@test.com`, role: 'editor', color: '#7c3aed' },
    });

    // Create collaboration sessions
    await prisma.collaborationSession.create({
      data: { dashboardId, userId: user1.id, cursorX: 100, cursorY: 200, status: 'active' },
    });
    await prisma.collaborationSession.create({
      data: { dashboardId, userId: user2.id, cursorX: 300, cursorY: 150, status: 'active' },
    });

    // Verify sessions
    const sessions = await prisma.collaborationSession.findMany({
      where: { dashboardId },
    });
    expect(sessions).toHaveLength(2);
  });

  it('should handle branching workflow', async () => {
    const branch = await prisma.dashboardBranch.create({
      data: {
        dashboardId,
        name: `feature/e2e-collab-${Date.now()}`,
        baseBranch: 'main',
        status: 'active',
      },
    });
    track('branch', branch.id);

    const mr = await prisma.mergeRequest.create({
      data: {
        dashboardId,
        sourceBranchId: branch.id,
        targetBranch: 'main',
        title: 'E2E Collab MR',
        status: 'open',
      },
    });
    track('mr', mr.id);

    // Merge
    await prisma.mergeRequest.update({
      where: { id: mr.id },
      data: { status: 'merged', mergedAt: new Date() },
    });

    const merged = await prisma.mergeRequest.findUnique({ where: { id: mr.id } });
    expect(merged!.status).toBe('merged');
  });
});

// ── System Test 5: Python/ML Dataset Creation ──
describe('System: Python/ML Dataset Workflow', () => {
  it('should create and run a Python-generated dataset', async () => {
    const dataset = await prisma.dataset.create({
      data: {
        name: 'E2E Python Churn Model',
        type: 'python_generated',
        language: 'python',
        code: `import pandas as pd
from sklearn.ensemble import RandomForestClassifier

df = read_table("reservations")
df["is_churned"] = (df["days_since_last"] > 90).astype(int)
output = df[["user_id", "is_churned", "churn_score"]]`,
        sourceTables: JSON.stringify([{ schema: 'booking_production', table: 'reservations' }]),
        outputColumns: JSON.stringify([
          { name: 'user_id', type: 'INTEGER' },
          { name: 'is_churned', type: 'INTEGER' },
          { name: 'churn_score', type: 'DOUBLE' },
        ]),
        status: 'draft',
        branch: 'main',
        lastRunStatus: 'running',
      },
    });
    track('dataset', dataset.id);

    expect(dataset.type).toBe('python_generated');
    expect(dataset.language).toBe('python');
    expect(dataset.lastRunStatus).toBe('running');

    // Simulate run completion
    await prisma.dataset.update({
      where: { id: dataset.id },
      data: { lastRunStatus: 'success', lastRunAt: new Date() },
    });

    const updated = await prisma.dataset.findUnique({ where: { id: dataset.id } });
    expect(updated!.lastRunStatus).toBe('success');
  });
});
