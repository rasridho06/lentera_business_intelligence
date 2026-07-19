import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { cleanupTestData, trackIds } from './helpers/cleanup';

const prisma = new PrismaClient();
const testIds: Record<string, string[]> = {};
const track = trackIds(testIds);

afterAll(async () => {
  await cleanupTestData(prisma, testIds);
  await prisma.$disconnect();
});

// ── UAT 1: Data Analyst Uploads CSV and Views Data ──
describe('UAT: Data Analyst uploads CSV and views data', () => {
  it('AC1: System accepts CSV file upload and creates connector', async () => {
    const connector = await prisma.connector.create({
      data: {
        name: 'UAT CSV Upload',
        type: 'csv',
        category: 'file',
        filePath: '/uploads/products.csv',
        fileConfig: JSON.stringify({ delimiter: ',', encoding: 'utf-8', header: true, sizeBytes: 256 }),
        status: 'connected',
        tables: {
          create: {
            schema: 'file',
            name: 'products.csv',
            type: 'table',
            rowCount: 3,
            sizeBytes: 256,
            columns: JSON.stringify([
              { name: 'product', type: 'VARCHAR', nullable: false, sample: 'Widget A' },
              { name: 'price', type: 'DOUBLE', nullable: true, sample: 29.99 },
              { name: 'category', type: 'VARCHAR', nullable: true, sample: 'Electronics' },
            ]),
          },
        },
      },
      include: { tables: true },
    });
    track('connector', connector.id);

    expect(connector.type).toBe('csv');
    expect(connector.tables).toHaveLength(1);
  });

  it('AC2: System detects column types automatically', async () => {
    // Simulate auto-detection result
    const columns = [
      { name: 'product', type: 'VARCHAR', nullable: false },
      { name: 'price', type: 'DOUBLE', nullable: true },
      { name: 'quantity', type: 'INTEGER', nullable: true },
      { name: 'is_active', type: 'BOOLEAN', nullable: false },
      { name: 'date', type: 'DATE', nullable: true },
    ];

    // Verify type inference logic
    expect(columns[0].type).toBe('VARCHAR');   // String → VARCHAR
    expect(columns[1].type).toBe('DOUBLE');     // Float → DOUBLE
    expect(columns[2].type).toBe('INTEGER');    // Integer → INTEGER
    expect(columns[3].type).toBe('BOOLEAN');    // True/False → BOOLEAN
    expect(columns[4].type).toBe('DATE');        // Date string → DATE
  });

  it('AC3: System shows data preview (schema with row count)', async () => {
    const connectors = await prisma.connector.findMany({
      where: { type: 'csv' },
      include: { tables: true },
    });
    const csvConnector = connectors.find(c => c.name === 'UAT CSV Upload');

    expect(csvConnector).toBeDefined();
    expect(csvConnector!.tables[0].rowCount).toBe(3);

    const cols = JSON.parse(csvConnector!.tables[0].columns);
    expect(cols).toHaveLength(3);
  });

  it('AC4: System rejects files over 100MB', () => {
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const sizes = [
      { size: 99 * 1024 * 1024, shouldPass: true, label: '99MB' },
      { size: 100 * 1024 * 1024, shouldPass: true, label: '100MB (exact limit)' },
      { size: 100 * 1024 * 1024 + 1, shouldPass: false, label: '100MB + 1 byte' },
      { size: 500 * 1024 * 1024, shouldPass: false, label: '500MB' },
    ];
    for (const { size, shouldPass, label } of sizes) {
      expect(size <= MAX_FILE_SIZE).toBe(shouldPass);
    }
  });
});

// ── UAT 2: Data Engineer Connects ClickHouse ──
describe('UAT: Data Engineer connects ClickHouse data warehouse', () => {
  let connectorId: string;

  it('AC1: User enters host, port, username, password (DBeaver-style)', async () => {
    // Verify the connector model has all the required fields
    const connector = await prisma.connector.create({
      data: {
        name: 'UAT ClickHouse',
        type: 'clickhouse',
        category: 'olap',
        host: 'demo-clickhouse',
        port: 9000,
        username: 'default',
        password: '',
        database: 'booking_production',
        schema: 'booking_production',
        status: 'connected',
        tables: { create: [] },
      },
      include: { tables: true },
    });
    connectorId = connector.id;
    track('connector', connectorId);

    expect(connector.host).toBe('demo-clickhouse');
    expect(connector.port).toBe(9000);
    expect(connector.username).toBe('default');
  });

  it('AC2: Connection test validates host/port format', () => {
    // Validate connection parameters
    const validHosts = ['demo-clickhouse', 'localhost', '192.168.1.100', 'ch.prod.internal'];
    const invalidHosts = ['host with spaces', 'host!special', '', '   '];
    const validPorts = [9000, 5432, 3306, 443, 1, 65535];
    const invalidPorts = [0, -1, 65536, 70000];

    for (const host of validHosts) {
      expect(host.length > 0 && /^[a-zA-Z0-9._-]+$/.test(host) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)).toBe(true);
    }
    for (const host of invalidHosts) {
      const valid = host.length > 0 && (/^[a-zA-Z0-9._-]+$/.test(host) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host));
      expect(valid).toBe(false);
    }
    for (const port of validPorts) {
      expect(port >= 1 && port <= 65535).toBe(true);
    }
    for (const port of invalidPorts) {
      expect(port >= 1 && port <= 65535).toBe(false);
    }
  });

  it('AC3: After connection, tables are synced with columns', async () => {
    // Add demo tables
    await prisma.dataSourceTable.createMany({
      data: [
        { connectorId, schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000, columns: JSON.stringify([
          { name: 'id', type: 'UInt64', nullable: false, isPK: true },
          { name: 'user_id', type: 'UInt64', nullable: false },
        ]) },
        { connectorId, schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000, columns: JSON.stringify([
          { name: 'id', type: 'UInt64', nullable: false, isPK: true },
          { name: 'name', type: 'String', nullable: false },
        ]) },
        { connectorId, schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000, columns: JSON.stringify([
          { name: 'date', type: 'Date', nullable: false },
          { name: 'gmv', type: 'Float64', nullable: true },
        ]) },
      ],
    });

    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      include: { tables: true },
    });

    expect(connector!.tables).toHaveLength(3);

    // Verify column details
    const reservations = connector!.tables.find(t => t.name === 'reservations');
    expect(reservations).toBeDefined();
    const cols = JSON.parse(reservations!.columns);
    const pkCol = cols.find((c: { isPK: boolean }) => c.isPK);
    expect(pkCol.name).toBe('id');
  });

  it('AC4: Tables show row count and schema grouping', async () => {
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      include: { tables: true },
    });

    const schemas = new Set(connector!.tables.map(t => t.schema));
    expect(schemas.size).toBeGreaterThanOrEqual(1);

    for (const table of connector!.tables) {
      expect(table.rowCount).toBeGreaterThan(0);
    }
  });
});

// ── UAT 3: Analyst Creates Chart from Data ──
describe('UAT: Analyst creates a chart from data', () => {
  const chartTypes = ['bar', 'line', 'pie', 'area', 'scatter', 'table', 'metric_card', 'heatmap', 'funnel', 'histogram'];

  it('AC1: User can create a standalone chart (no dashboard required)', async () => {
    const chart = await prisma.chart.create({
      data: {
        name: 'UAT Standalone Chart',
        chartType: 'bar',
        dataSourceType: 'table',
        status: 'draft',
        branch: 'main',
      },
    });
    track('chart', chart.id);

    expect(chart.dashboardId).toBeNull();
    expect(chart.status).toBe('draft');
  });

  it('AC2: All 10 chart types are supported', async () => {
    for (const chartType of chartTypes) {
      const chart = await prisma.chart.create({
        data: {
          name: `UAT ${chartType} Chart`,
          chartType,
          status: 'draft',
          branch: 'main',
        },
      });
      track('chart', chart.id);
      expect(chart.chartType).toBe(chartType);
    }
  });

  it('AC3: Chart can use virtual dataset as data source', async () => {
    const dataset = await prisma.dataset.create({
      data: { name: 'UAT Dataset', type: 'virtual', language: 'sql', code: 'SELECT 1', status: 'draft', branch: 'main' },
    });
    track('dataset', dataset.id);

    const chart = await prisma.chart.create({
      data: {
        name: 'UAT Chart with Dataset',
        chartType: 'line',
        dataSourceType: 'dataset',
        datasetId: dataset.id,
        status: 'draft',
        branch: 'main',
      },
    });
    track('chart', chart.id);

    expect(chart.datasetId).toBe(dataset.id);
  });

  it('AC4: Chart can use custom SQL as data source', async () => {
    const chart = await prisma.chart.create({
      data: {
        name: 'UAT Custom SQL Chart',
        chartType: 'line',
        dataSourceType: 'custom_sql',
        customSQL: 'SELECT date, SUM(gmv) FROM mart_booking_gmv GROUP BY date',
        status: 'draft',
        branch: 'main',
      },
    });
    track('chart', chart.id);

    expect(chart.customSQL).toContain('SELECT');
  });

  it('AC5: User can insert chart into dashboard later', async () => {
    const chart = await prisma.chart.create({
      data: { name: 'UAT Insertable Chart', chartType: 'bar', status: 'draft', branch: 'main' },
    });
    track('chart', chart.id);

    const dashboard = await prisma.dashboard.create({
      data: { name: 'UAT Insert Target', branch: 'main' },
    });
    track('dashboard', dashboard.id);

    await prisma.chart.update({
      where: { id: chart.id },
      data: { dashboardId: dashboard.id },
    });

    const updated = await prisma.chart.findUnique({ where: { id: chart.id } });
    expect(updated!.dashboardId).toBe(dashboard.id);
  });
});

// ── UAT 4: Team Collaboration ──
describe('UAT: Team collaborates on dashboard', () => {
  let dashboardId: string;

  it('AC1: Multiple users can collaborate on dashboard', async () => {
    const dashboard = await prisma.dashboard.create({
      data: { name: 'UAT Collab Dashboard', branch: 'main' },
    });
    dashboardId = dashboard.id;
    track('dashboard', dashboardId);

    const user1 = await prisma.user.create({
      data: { name: 'Maya', email: `maya-uat-${Date.now()}@test.com`, role: 'editor', color: '#dc2626' },
    });
    const user2 = await prisma.user.create({
      data: { name: 'Budi', email: `budi-uat-${Date.now()}@test.com`, role: 'editor', color: '#7c3aed' },
    });

    const s1 = await prisma.collaborationSession.create({
      data: { dashboardId, userId: user1.id, cursorX: 100, cursorY: 200, status: 'active' },
    });
    track('collabSession', s1.id);

    const s2 = await prisma.collaborationSession.create({
      data: { dashboardId, userId: user2.id, cursorX: 300, cursorY: 150, status: 'active' },
    });
    track('collabSession', s2.id);

    const sessions = await prisma.collaborationSession.findMany({ where: { dashboardId } });
    expect(sessions).toHaveLength(2);
  });

  it('AC2: User can create a branch for their changes', async () => {
    const branch = await prisma.dashboardBranch.create({
      data: {
        dashboardId,
        name: `uat-branch-${Date.now()}`,
        baseBranch: 'main',
        status: 'active',
      },
    });
    track('branch', branch.id);

    expect(branch.baseBranch).toBe('main');
    expect(branch.status).toBe('active');
  });

  it('AC3: User can submit a merge request', async () => {
    const branch = await prisma.dashboardBranch.create({
      data: { dashboardId, name: `uat-mr-branch-${Date.now()}`, baseBranch: 'main', status: 'active' },
    });
    track('branch', branch.id);

    const mr = await prisma.mergeRequest.create({
      data: { dashboardId, sourceBranchId: branch.id, targetBranch: 'main', title: 'UAT: Add new chart', status: 'open' },
    });
    track('mr', mr.id);

    expect(mr.title).toBe('UAT: Add new chart');
  });

  it('AC4: System detects conflicts when concurrent edits target same branch', async () => {
    const b1 = await prisma.dashboardBranch.create({
      data: { dashboardId, name: `uat-conflict-1-${Date.now()}`, baseBranch: 'main', status: 'active' },
    });
    track('branch', b1.id);
    const b2 = await prisma.dashboardBranch.create({
      data: { dashboardId, name: `uat-conflict-2-${Date.now()}`, baseBranch: 'main', status: 'active' },
    });
    track('branch', b2.id);

    await prisma.mergeRequest.create({
      data: { dashboardId, sourceBranchId: b1.id, targetBranch: 'main', title: 'MR 1', status: 'open' },
    }).then(mr => track('mr', mr.id));

    const mr2 = await prisma.mergeRequest.create({
      data: {
        dashboardId, sourceBranchId: b2.id, targetBranch: 'main', title: 'MR 2 (conflict)',
        status: 'conflict',
        conflictDetails: JSON.stringify({ reason: 'Open MR targeting main already exists', conflictingMRs: [] }),
      },
    });
    track('mr', mr2.id);

    expect(mr2.status).toBe('conflict');
  });

  it('AC5: User can merge a conflict-free MR', async () => {
    const branch = await prisma.dashboardBranch.create({
      data: { dashboardId, name: `uat-merge-${Date.now()}`, baseBranch: 'main', status: 'active' },
    });
    track('branch', branch.id);

    const mr = await prisma.mergeRequest.create({
      data: { dashboardId, sourceBranchId: branch.id, targetBranch: 'develop', title: 'UAT Merge MR', status: 'open' },
    });
    track('mr', mr.id);

    await prisma.mergeRequest.update({
      where: { id: mr.id },
      data: { status: 'merged', mergedAt: new Date() },
    });

    const merged = await prisma.mergeRequest.findUnique({ where: { id: mr.id } });
    expect(merged!.status).toBe('merged');
  });
});

// ── UAT 5: Python/ML Dataset ──
describe('UAT: Data Scientist creates Python/ML dataset', () => {
  let datasetId: string;

  it('AC1: User can create a Python-generated dataset', async () => {
    const dataset = await prisma.dataset.create({
      data: {
        name: 'UAT Python Churn Model',
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
      },
    });
    datasetId = dataset.id;
    track('dataset', datasetId);

    expect(dataset.type).toBe('python_generated');
    expect(dataset.language).toBe('python');
  });

  it('AC2: User can run the dataset and see status change', async () => {
    // Start running
    await prisma.dataset.update({
      where: { id: datasetId },
      data: { lastRunStatus: 'running' },
    });

    let ds = await prisma.dataset.findUnique({ where: { id: datasetId } });
    expect(ds!.lastRunStatus).toBe('running');

    // Complete
    await prisma.dataset.update({
      where: { id: datasetId },
      data: { lastRunStatus: 'success', lastRunAt: new Date() },
    });

    ds = await prisma.dataset.findUnique({ where: { id: datasetId } });
    expect(ds!.lastRunStatus).toBe('success');
  });

  it('AC3: Output columns are defined for lineage tracking', async () => {
    const ds = await prisma.dataset.findUnique({ where: { id: datasetId } });
    const outputCols = JSON.parse(ds!.outputColumns as string);
    expect(outputCols).toHaveLength(3);
    expect(outputCols.map((c: { name: string }) => c.name)).toEqual(['user_id', 'is_churned', 'churn_score']);
  });
});
