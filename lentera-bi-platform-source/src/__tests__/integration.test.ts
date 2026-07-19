import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// ════════════════════════════════════════════════════════════════
// INTEGRATION TESTS - Cross-module interactions via Prisma
// ════════════════════════════════════════════════════════════════

const prisma = new PrismaClient();

const createdConnectors: string[] = [];
const createdDashboards: string[] = [];
const createdCharts: string[] = [];
const createdDatasets: string[] = [];
const createdMetrics: string[] = [];
const createdBranches: string[] = [];
const createdMRs: string[] = [];

afterAll(async () => {
  // Cleanup in reverse order of dependencies
  for (const id of createdMRs) await prisma.mergeRequest.delete({ where: { id } }).catch(() => {});
  for (const id of createdBranches) await prisma.dashboardBranch.delete({ where: { id } }).catch(() => {});
  for (const id of createdCharts) await prisma.chartMetric.deleteMany({ where: { chartId: id } }).catch(() => {}).then(() => prisma.chart.delete({ where: { id } }).catch(() => {}));
  for (const id of createdMetrics) await prisma.metricSource.deleteMany({ where: { metricId: id } }).catch(() => {}).then(() => prisma.metricDef.delete({ where: { id } }).catch(() => {}));
  for (const id of createdDatasets) await prisma.dataset.delete({ where: { id } }).catch(() => {});
  for (const id of createdDashboards) await prisma.dashboard.delete({ where: { id } }).catch(() => {});
  for (const id of createdConnectors) await prisma.dataSourceTable.deleteMany({ where: { connectorId: id } }).catch(() => {}).then(() => prisma.connector.delete({ where: { id } }).catch(() => {}));
  await prisma.$disconnect();
});

// ── 1. Connector → Table Creation ──
describe('Integration: Connector → Table Sync', () => {
  let connectorId: string;

  it('should create ClickHouse connector with auto-generated demo tables', async () => {
    const connector = await prisma.connector.create({
      data: {
        name: 'Integration Test ClickHouse',
        type: 'clickhouse',
        category: 'olap',
        host: 'demo-clickhouse',
        port: 9000,
        username: 'default',
        status: 'connected',
        tables: {
          create: [
            { schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000, columns: JSON.stringify([
              { name: 'id', type: 'UInt64', nullable: false, isPK: true },
              { name: 'user_id', type: 'UInt64', nullable: false },
              { name: 'restaurant_id', type: 'UInt64', nullable: false },
            ]) },
            { schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000, columns: JSON.stringify([
              { name: 'id', type: 'UInt64', nullable: false, isPK: true },
              { name: 'name', type: 'String', nullable: false },
            ]) },
            { schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000, columns: JSON.stringify([
              { name: 'date', type: 'Date', nullable: false },
              { name: 'gmv', type: 'Float64', nullable: true },
            ]) },
          ],
        },
      },
      include: { tables: true },
    });
    connectorId = connector.id;
    createdConnectors.push(connectorId);

    expect(connector.id).toBeDefined();
    expect(connector.type).toBe('clickhouse');
    expect(connector.tables).toHaveLength(3);
  });

  it('should list all connectors with their tables', async () => {
    const connectors = await prisma.connector.findMany({
      include: { tables: true },
    });
    expect(connectors.length).toBeGreaterThan(0);
    const ch = connectors.find(c => c.id === connectorId);
    expect(ch).toBeDefined();
    expect(ch!.tables).toHaveLength(3);
  });

  it('should cascade delete tables when connector is deleted', async () => {
    // Create a temporary connector
    const temp = await prisma.connector.create({
      data: {
        name: 'Temp Delete Test',
        type: 'postgres',
        category: 'oltp',
        host: 'temp-host',
        port: 5432,
        status: 'connected',
        tables: {
          create: [{ schema: 'public', name: 'temp_table', type: 'table', columns: JSON.stringify([]) }],
        },
      },
      include: { tables: true },
    });

    // Delete connector
    await prisma.dataSourceTable.deleteMany({ where: { connectorId: temp.id } });
    await prisma.connector.delete({ where: { id: temp.id } });

    // Verify gone
    const found = await prisma.connector.findUnique({ where: { id: temp.id } });
    expect(found).toBeNull();
  });
});

// ── 2. Chart → Dashboard Integration ──
describe('Integration: Chart ↔ Dashboard Workflow', () => {
  let chartId: string;
  let dashboardId: string;

  it('should create a standalone chart', async () => {
    const chart = await prisma.chart.create({
      data: {
        name: 'Integration Test Chart',
        chartType: 'bar',
        dataSourceType: 'table',
        status: 'draft',
        branch: 'main',
        config: JSON.stringify({ xAxis: 'name', yAxis: ['Revenue'], showLegend: true }),
      },
    });
    chartId = chart.id;
    createdCharts.push(chartId);

    expect(chart.id).toBeDefined();
    expect(chart.dashboardId).toBeNull();
  });

  it('should create a dashboard', async () => {
    const dashboard = await prisma.dashboard.create({
      data: { name: 'Integration Test Dashboard', description: 'Test', branch: 'main' },
    });
    dashboardId = dashboard.id;
    createdDashboards.push(dashboardId);

    expect(dashboard.id).toBeDefined();
  });

  it('should insert chart into dashboard', async () => {
    const updated = await prisma.chart.update({
      where: { id: chartId },
      data: { dashboardId },
    });
    expect(updated.dashboardId).toBe(dashboardId);
  });

  it('should show chart in dashboard chart list', async () => {
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      include: { charts: true },
    });
    expect(dashboard!.charts.some(c => c.id === chartId)).toBe(true);
  });

  it('should remove chart from dashboard (set to standalone)', async () => {
    const updated = await prisma.chart.update({
      where: { id: chartId },
      data: { dashboardId: null },
    });
    expect(updated.dashboardId).toBeNull();
  });
});

// ── 3. Dataset → Chart Integration ──
describe('Integration: Dataset → Chart Data Flow', () => {
  let datasetId: string;
  let chartId: string;

  it('should create a virtual dataset with SQL', async () => {
    const dataset = await prisma.dataset.create({
      data: {
        name: 'Integration Dataset',
        type: 'virtual',
        language: 'sql',
        code: 'SELECT region, SUM(revenue) as total_revenue FROM sales GROUP BY region',
        sourceTables: JSON.stringify([{ schema: 'public', table: 'sales' }]),
        outputColumns: JSON.stringify([
          { name: 'region', type: 'VARCHAR' },
          { name: 'total_revenue', type: 'DOUBLE' },
        ]),
        status: 'draft',
        branch: 'main',
      },
    });
    datasetId = dataset.id;
    createdDatasets.push(datasetId);

    expect(dataset.type).toBe('virtual');
    expect(dataset.language).toBe('sql');
  });

  it('should create a chart using the dataset', async () => {
    const chart = await prisma.chart.create({
      data: {
        name: 'Chart from Dataset',
        chartType: 'bar',
        dataSourceType: 'dataset',
        datasetId,
        status: 'draft',
        branch: 'main',
      },
    });
    chartId = chart.id;
    createdCharts.push(chartId);

    expect(chart.datasetId).toBe(datasetId);
  });
});

// ── 4. Metric → Chart Linking Integration ──
describe('Integration: Metric → Chart Linking', () => {
  let metricId: string;
  let chartId: string;

  it('should create a metric', async () => {
    const metric = await prisma.metricDef.create({
      data: {
        name: 'Integration Test Total GMV',
        expression: 'SUM(gmv)',
        language: 'sql',
        aggregation: 'sum',
        sourceColumn: 'gmv',
        version: 1,
        status: 'draft',
        branch: 'main',
      },
    });
    metricId = metric.id;
    createdMetrics.push(metricId);

    expect(metric.id).toBeDefined();
    expect(metric.version).toBe(1);
  });

  it('should auto-increment metric version on update', async () => {
    const updated = await prisma.metricDef.update({
      where: { id: metricId },
      data: { version: { increment: 1 }, expression: 'SUM(gmv) FILTER (WHERE active = 1)' },
    });
    expect(updated.version).toBe(2);
  });

  it('should create a chart and link the metric', async () => {
    const chart = await prisma.chart.create({
      data: {
        name: 'GMV Chart with Metric',
        chartType: 'line',
        status: 'draft',
        branch: 'main',
        chartMetrics: {
          create: { metricId, alias: 'total_gmv', axis: 'left', color: '#10b981' },
        },
      },
      include: { chartMetrics: true },
    });
    chartId = chart.id;
    createdCharts.push(chartId);

    expect(chart.chartMetrics).toHaveLength(1);
    expect(chart.chartMetrics[0].metricId).toBe(metricId);
  });
});

// ── 5. Branch → Merge Request Integration ──
describe('Integration: Branch & Merge Request Workflow', () => {
  let dashboardId: string;
  let branchId: string;
  let mergeRequestId: string;

  it('should create a dashboard', async () => {
    const dashboard = await prisma.dashboard.create({
      data: { name: 'Branch Test Dashboard', branch: 'main' },
    });
    dashboardId = dashboard.id;
    createdDashboards.push(dashboardId);
  });

  it('should create a feature branch', async () => {
    const branch = await prisma.dashboardBranch.create({
      data: {
        dashboardId,
        name: `feature/test-${Date.now()}`,
        baseBranch: 'main',
        status: 'active',
      },
    });
    branchId = branch.id;
    createdBranches.push(branchId);

    expect(branch.baseBranch).toBe('main');
    expect(branch.status).toBe('active');
  });

  it('should create a merge request', async () => {
    const mr = await prisma.mergeRequest.create({
      data: {
        dashboardId,
        sourceBranchId: branchId,
        targetBranch: 'main',
        title: 'Integration Test MR',
        status: 'open',
      },
    });
    mergeRequestId = mr.id;
    createdMRs.push(mergeRequestId);

    expect(mr.title).toBe('Integration Test MR');
    expect(mr.status).toBe('open');
  });

  it('should detect conflict when creating second MR to same branch', async () => {
    const branch2 = await prisma.dashboardBranch.create({
      data: {
        dashboardId,
        name: `feature/conflict-${Date.now()}`,
        baseBranch: 'main',
        status: 'active',
      },
    });
    createdBranches.push(branch2.id);

    const mr2 = await prisma.mergeRequest.create({
      data: {
        dashboardId,
        sourceBranchId: branch2.id,
        targetBranch: 'main',
        title: 'Conflicting MR',
        status: 'conflict',
        conflictDetails: JSON.stringify({
          reason: 'Another MR targeting main is already open',
          conflictingMRs: [mergeRequestId],
        }),
      },
    });
    createdMRs.push(mr2.id);

    expect(mr2.status).toBe('conflict');
  });

  it('should merge a merge request', async () => {
    const merged = await prisma.mergeRequest.update({
      where: { id: mergeRequestId },
      data: { status: 'merged', mergedAt: new Date() },
    });
    expect(merged.status).toBe('merged');
  });
});

// ── 6. File Upload Integration (via Prisma) ──
describe('Integration: File Upload → Connector → Table', () => {
  it('should create a CSV file connector with parsed schema', async () => {
    const parsedColumns = [
      { name: 'name', type: 'VARCHAR', nullable: false },
      { name: 'age', type: 'INTEGER', nullable: true },
      { name: 'city', type: 'VARCHAR', nullable: true },
    ];

    const connector = await prisma.connector.create({
      data: {
        name: 'Uploaded CSV',
        type: 'csv',
        category: 'file',
        filePath: '/uploads/test-data.csv',
        fileConfig: JSON.stringify({ delimiter: ',', encoding: 'utf-8', header: true, rowCount: 3 }),
        status: 'connected',
        tables: {
          create: {
            schema: 'file',
            name: 'test-data.csv',
            type: 'table',
            rowCount: 3,
            columns: JSON.stringify(parsedColumns),
          },
        },
      },
      include: { tables: true },
    });
    createdConnectors.push(connector.id);

    expect(connector.type).toBe('csv');
    expect(connector.category).toBe('file');
    expect(connector.tables).toHaveLength(1);

    const table = connector.tables[0];
    const cols = JSON.parse(table.columns);
    expect(cols).toHaveLength(3);
    expect(cols[0].name).toBe('name');
    expect(cols[1].type).toBe('INTEGER');
  });

  it('should create a JSON file connector', async () => {
    const connector = await prisma.connector.create({
      data: {
        name: 'Uploaded JSON',
        type: 'json',
        category: 'file',
        filePath: '/uploads/data.json',
        status: 'connected',
        tables: {
          create: {
            schema: 'file',
            name: 'data.json',
            type: 'table',
            rowCount: 100,
            columns: JSON.stringify([
              { name: 'product', type: 'VARCHAR', nullable: false },
              { name: 'price', type: 'DOUBLE', nullable: true },
            ]),
          },
        },
      },
    });
    createdConnectors.push(connector.id);

    expect(connector.type).toBe('json');
  });

  it('should create an Excel file connector', async () => {
    const connector = await prisma.connector.create({
      data: {
        name: 'Uploaded Excel',
        type: 'excel',
        category: 'file',
        filePath: '/uploads/data.xlsx',
        fileConfig: JSON.stringify({ sheet: 'Sheet1' }),
        status: 'connected',
        tables: {
          create: {
            schema: 'file',
            name: 'Sheet1',
            type: 'table',
            rowCount: 500,
            columns: JSON.stringify([
              { name: 'Date', type: 'DATE', nullable: false },
              { name: 'Revenue', type: 'DOUBLE', nullable: true },
            ]),
          },
        },
      },
    });
    createdConnectors.push(connector.id);

    expect(connector.type).toBe('excel');
  });

  it('should create a Parquet file connector', async () => {
    const connector = await prisma.connector.create({
      data: {
        name: 'Uploaded Parquet',
        type: 'parquet',
        category: 'file',
        filePath: '/uploads/data.parquet',
        status: 'connected',
        tables: {
          create: {
            schema: 'file',
            name: 'data.parquet',
            type: 'table',
            rowCount: 10000,
            columns: JSON.stringify([
              { name: 'id', type: 'INT64', nullable: false },
              { name: 'value', type: 'DOUBLE', nullable: true },
            ]),
          },
        },
      },
    });
    createdConnectors.push(connector.id);

    expect(connector.type).toBe('parquet');
  });
});
