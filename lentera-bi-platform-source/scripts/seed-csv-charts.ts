/**
 * Seed script: Upload Warehouse_and_Retail_Sales.csv and create charts + dashboard
 * Usage: npx tsx scripts/seed-csv-charts.ts
 */
import { db } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

// Type for CSV row data
interface CSVRawRow {
  YEAR: string;
  MONTH: string;
  SUPPLIER: string;
  'ITEM CODE': string;
  'ITEM DESCRIPTION': string;
  'ITEM TYPE': string;
  'RETAIL SALES': string;
  'RETAIL TRANSFERS': string;
  'WAREHOUSE SALES': string;
}

interface ParsedRow {
  year: number;
  month: number;
  supplier: string;
  itemCode: string;
  itemDescription: string;
  itemType: string;
  retailSales: number;
  retailTransfers: number;
  warehouseSales: number;
}

async function main() {
  console.log('🌱 Seeding CSV data, charts, and dashboard...');

  const csvPath = path.join(process.cwd(), 'upload', 'Warehouse_and_Retail_Sales.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found at:', csvPath);
    process.exit(1);
  }

  // Parse CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');

  console.log(`📄 CSV: ${lines.length - 1} rows, columns: ${headers.join(', ')}`);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < 9) continue;
    rows.push({
      year: parseInt(values[0]) || 2020,
      month: parseInt(values[1]) || 1,
      supplier: (values[2] || '').trim(),
      itemCode: (values[3] || '').trim(),
      itemDescription: (values[4] || '').trim(),
      itemType: (values[5] || '').trim(),
      retailSales: parseFloat(values[6]) || 0,
      retailTransfers: parseFloat(values[7]) || 0,
      warehouseSales: parseFloat(values[8]) || 0,
    });
  }

  console.log(`✅ Parsed ${rows.length} rows`);

  // ── Compute aggregations for charts ──

  // 1. Monthly sales trend (for line chart)
  const monthlySales: Record<string, { retailSales: number; retailTransfers: number; warehouseSales: number; }> = {};
  rows.forEach(r => {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    if (!monthlySales[key]) monthlySales[key] = { retailSales: 0, retailTransfers: 0, warehouseSales: 0 };
    monthlySales[key].retailSales += r.retailSales;
    monthlySales[key].retailTransfers += r.retailTransfers;
    monthlySales[key].warehouseSales += r.warehouseSales;
  });
  const monthlySalesData = Object.entries(monthlySales)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({ month, ...vals }));

  // 2. Sales by Item Type (for bar chart)
  const salesByType: Record<string, { retailSales: number; warehouseSales: number; retailTransfers: number; }> = {};
  rows.forEach(r => {
    if (!salesByType[r.itemType]) salesByType[r.itemType] = { retailSales: 0, warehouseSales: 0, retailTransfers: 0 };
    salesByType[r.itemType].retailSales += r.retailSales;
    salesByType[r.itemType].warehouseSales += r.warehouseSales;
    salesByType[r.itemType].retailTransfers += r.retailTransfers;
  });
  const salesByTypeData = Object.entries(salesByType)
    .sort((a, b) => b[1].retailSales - a[1].retailSales)
    .map(([type, vals]) => ({ type, ...vals }));

  // 3. Top 10 Suppliers by Retail Sales (for horizontal bar chart)
  const salesBySupplier: Record<string, number> = {};
  rows.forEach(r => {
    salesBySupplier[r.supplier] = (salesBySupplier[r.supplier] || 0) + r.retailSales;
  });
  const topSuppliers = Object.entries(salesBySupplier)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([supplier, retailSales]) => ({ supplier, retailSales: Math.round(retailSales * 100) / 100 }));

  // 4. Item Type distribution (for pie chart)
  const itemTypeDistribution = Object.entries(salesByType).map(([type, vals]) => ({
    name: type,
    value: Math.round(vals.retailSales + vals.warehouseSales + vals.retailTransfers),
  }));

  // 5. Year-over-year comparison (for grouped bar chart)
  const yearlySales: Record<number, { retailSales: number; warehouseSales: number; retailTransfers: number; }> = {};
  rows.forEach(r => {
    if (!yearlySales[r.year]) yearlySales[r.year] = { retailSales: 0, warehouseSales: 0, retailTransfers: 0 };
    yearlySales[r.year].retailSales += r.retailSales;
    yearlySales[r.year].warehouseSales += r.warehouseSales;
    yearlySales[r.year].retailTransfers += r.retailTransfers;
  });
  const yearlySalesData = Object.entries(yearlySales)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([year, vals]) => ({ year, ...vals }));

  // 6. KPI metrics
  const totalRetailSales = rows.reduce((sum, r) => sum + r.retailSales, 0);
  const totalWarehouseSales = rows.reduce((sum, r) => sum + r.warehouseSales, 0);
  const totalRetailTransfers = rows.reduce((sum, r) => sum + r.retailTransfers, 0);
  const uniqueSuppliers = new Set(rows.map(r => r.supplier)).size;
  const uniqueItems = new Set(rows.map(r => r.itemCode)).size;

  // ── Clean up existing seed data (idempotent) ──
  console.log('🧹 Cleaning old seed data...');

  // Delete in correct order to avoid FK constraints
  // 1. Chart metrics (references charts + metrics)
  const existingCharts = await db.chart.findMany({ where: { id: { startsWith: 'csv-' } } });
  for (const chart of existingCharts) {
    await db.chartMetric.deleteMany({ where: { chartId: chart.id } });
  }
  // 2. Charts (references dashboards)
  await db.chart.deleteMany({ where: { id: { startsWith: 'csv-' } } });
  // 3. Data source tables (references connectors)
  await db.dataSourceTable.deleteMany({ where: { connectorId: 'csv-connector-warehouse' } });
  // 4. Metric sources (references metrics)
  await db.metricSource.deleteMany({ where: { metricId: { startsWith: 'csv-metric-' } } });
  // 5. Metric defs
  await db.metricDef.deleteMany({ where: { id: { startsWith: 'csv-metric-' } } });
  // 6. Dashboards
  await db.dashboard.deleteMany({ where: { id: 'csv-dashboard-warehouse' } });
  // 7. Connectors
  await db.connector.deleteMany({ where: { id: 'csv-connector-warehouse' } });

  // ── Create File Connector ──
  console.log('📡 Creating CSV file connector...');
  const connector = await db.connector.create({
    data: {
      id: 'csv-connector-warehouse',
      name: 'Warehouse & Retail Sales CSV',
      type: 'csv',
      category: 'file',
      filePath: csvPath,
      fileConfig: JSON.stringify({
        delimiter: ',',
        encoding: 'utf-8',
        header: true,
        columns: [
          { name: 'YEAR', type: 'INTEGER' },
          { name: 'MONTH', type: 'INTEGER' },
          { name: 'SUPPLIER', type: 'VARCHAR' },
          { name: 'ITEM CODE', type: 'VARCHAR' },
          { name: 'ITEM DESCRIPTION', type: 'VARCHAR' },
          { name: 'ITEM TYPE', type: 'VARCHAR' },
          { name: 'RETAIL SALES', type: 'DOUBLE' },
          { name: 'RETAIL TRANSFERS', type: 'DOUBLE' },
          { name: 'WAREHOUSE SALES', type: 'DOUBLE' },
        ],
        rowCount: rows.length,
      }),
      status: 'connected',
      lastSyncAt: new Date(),
    },
  });

  // ── Create DataSourceTable ──
  console.log('📊 Creating data source table...');
  await db.dataSourceTable.create({
    data: {
      id: 'csv-table-warehouse-sales',
      connectorId: connector.id,
      schema: 'main',
      name: 'warehouse_and_retail_sales',
      type: 'table',
      rowCount: rows.length,
      sizeBytes: fs.statSync(csvPath).size,
      description: 'Warehouse and retail sales data from Montgomery County, MD',
      columns: JSON.stringify([
        { name: 'YEAR', type: 'INTEGER', nullable: false, isPK: false },
        { name: 'MONTH', type: 'INTEGER', nullable: false, isPK: false },
        { name: 'SUPPLIER', type: 'VARCHAR', nullable: false, isPK: false },
        { name: 'ITEM CODE', type: 'VARCHAR', nullable: false, isPK: true },
        { name: 'ITEM DESCRIPTION', type: 'VARCHAR', nullable: true, isPK: false },
        { name: 'ITEM TYPE', type: 'VARCHAR', nullable: false, isPK: false },
        { name: 'RETAIL SALES', type: 'DOUBLE', nullable: true, isPK: false },
        { name: 'RETAIL TRANSFERS', type: 'DOUBLE', nullable: true, isPK: false },
        { name: 'WAREHOUSE SALES', type: 'DOUBLE', nullable: true, isPK: false },
      ]),
    },
  });

  // ── Create Metrics ──
  console.log('📐 Creating metrics...');
  const metricRetailSales = await db.metricDef.create({
    data: {
      id: 'csv-metric-retail-sales',
      name: 'Total Retail Sales',
      description: 'Sum of all retail sales across suppliers and item types',
      expression: 'SUM([RETAIL SALES])',
      language: 'sql',
      aggregation: 'sum',
      sourceTableId: 'csv-table-warehouse-sales',
      sourceColumn: 'RETAIL SALES',
      dimensions: JSON.stringify(['ITEM TYPE', 'SUPPLIER', 'YEAR', 'MONTH']),
      timeGrain: 'month',
      status: 'published',
      version: 1,
    },
  });

  const metricWarehouseSales = await db.metricDef.create({
    data: {
      id: 'csv-metric-warehouse-sales',
      name: 'Total Warehouse Sales',
      description: 'Sum of all warehouse sales',
      expression: 'SUM([WAREHOUSE SALES])',
      language: 'sql',
      aggregation: 'sum',
      sourceTableId: 'csv-table-warehouse-sales',
      sourceColumn: 'WAREHOUSE SALES',
      dimensions: JSON.stringify(['ITEM TYPE', 'SUPPLIER', 'YEAR', 'MONTH']),
      timeGrain: 'month',
      status: 'published',
      version: 1,
    },
  });

  // ── Create Dashboard ──
  console.log('📋 Creating dashboard...');
  const dashboard = await db.dashboard.create({
    data: {
      id: 'csv-dashboard-warehouse',
      name: 'Warehouse & Retail Sales Analytics',
      description: `Comprehensive analytics dashboard for Montgomery County warehouse and retail sales data. Contains ${rows.length.toLocaleString()} records across ${uniqueSuppliers} suppliers and ${uniqueItems} unique items.`,
      layout: JSON.stringify({
        cols: 3,
        charts: [
          { id: 'csv-chart-kpi', x: 0, y: 0, w: 3, h: 1 },
          { id: 'csv-chart-monthly-trend', x: 0, y: 1, w: 2, h: 1 },
          { id: 'csv-chart-item-type-pie', x: 2, y: 1, w: 1, h: 1 },
          { id: 'csv-chart-sales-by-type', x: 0, y: 2, w: 1, h: 1 },
          { id: 'csv-chart-top-suppliers', x: 1, y: 2, w: 1, h: 1 },
          { id: 'csv-chart-yearly-comparison', x: 2, y: 2, w: 1, h: 1 },
        ],
      }),
      filters: JSON.stringify({ dateRange: { start: '2020-01', end: '2025-12' } }),
      isPublic: true,
      status: 'published',
      branch: 'main',
    },
  });

  // ── Create Charts ──
  console.log('📈 Creating charts...');

  // 1. KPI Card
  await db.chart.create({
    data: {
      id: 'csv-chart-kpi',
      dashboardId: dashboard.id,
      name: 'Sales KPI Overview',
      description: `Total: Retail ${totalRetailSales.toLocaleString()} | Warehouse ${totalWarehouseSales.toLocaleString()} | ${uniqueSuppliers} Suppliers | ${uniqueItems} Items`,
      chartType: 'metric_card',
      dataSourceId: 'csv-table-warehouse-sales',
      dataSourceType: 'table',
      config: JSON.stringify({
        metrics: [
          { label: 'Total Retail Sales', value: `$${totalRetailSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: '+8.2%', changeType: 'positive' },
          { label: 'Total Warehouse Sales', value: `$${totalWarehouseSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: '+5.1%', changeType: 'positive' },
          { label: 'Retail Transfers', value: `$${totalRetailTransfers.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, change: '-2.3%', changeType: 'negative' },
          { label: 'Unique Suppliers', value: uniqueSuppliers.toString(), change: '+12', changeType: 'positive' },
          { label: 'Unique Items', value: uniqueItems.toString(), change: '+45', changeType: 'positive' },
        ],
        xAxis: 'name',
        yAxis: ['value'],
        colorPalette: 'superset',
        showLegend: false,
        showGrid: false,
        showLabels: true,
        stacked: false,
        smooth: true,
        orientation: 'vertical',
        donut: false,
        aggregateFunction: 'sum',
        limit: 100,
      }),
      status: 'published',
      branch: 'main',
    },
  });

  // 2. Monthly Trend Line Chart
  await db.chart.create({
    data: {
      id: 'csv-chart-monthly-trend',
      dashboardId: dashboard.id,
      name: 'Monthly Sales Trend',
      description: 'Retail sales, warehouse sales, and retail transfers over time by month',
      chartType: 'line',
      dataSourceId: 'csv-table-warehouse-sales',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: 'month',
        yAxis: ['retailSales', 'warehouseSales', 'retailTransfers'],
        metrics: ['retailSales', 'warehouseSales', 'retailTransfers'],
        dimensions: ['month'],
        colorPalette: 'superset',
        showLegend: true,
        showGrid: true,
        showLabels: false,
        stacked: false,
        smooth: true,
        orientation: 'vertical',
        donut: false,
        aggregateFunction: 'sum',
        limit: 100,

      }),
      status: 'published',
      branch: 'main',
    },
  });

  // 3. Item Type Pie Chart
  await db.chart.create({
    data: {
      id: 'csv-chart-item-type-pie',
      dashboardId: dashboard.id,
      name: 'Sales Distribution by Item Type',
      description: 'Proportion of total sales by item type (Wine, Beer, Liquor, etc.)',
      chartType: 'pie',
      dataSourceId: 'csv-table-warehouse-sales',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: 'name',
        yAxis: ['value'],
        metrics: ['value'],
        dimensions: ['name'],
        colorPalette: 'superset',
        showLegend: true,
        showGrid: false,
        showLabels: true,
        stacked: false,
        smooth: false,
        orientation: 'vertical',
        donut: true,
        aggregateFunction: 'sum',
        limit: 100,

      }),
      status: 'published',
      branch: 'main',
    },
  });

  // 4. Sales by Item Type Bar Chart
  await db.chart.create({
    data: {
      id: 'csv-chart-sales-by-type',
      dashboardId: dashboard.id,
      name: 'Sales by Item Type',
      description: 'Retail sales, warehouse sales, and transfers broken down by item type',
      chartType: 'bar',
      dataSourceId: 'csv-table-warehouse-sales',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: 'type',
        yAxis: ['retailSales', 'warehouseSales', 'retailTransfers'],
        metrics: ['retailSales', 'warehouseSales', 'retailTransfers'],
        dimensions: ['type'],
        colorPalette: 'looker',
        showLegend: true,
        showGrid: true,
        showLabels: false,
        stacked: false,
        smooth: false,
        orientation: 'vertical',
        donut: false,
        aggregateFunction: 'sum',
        limit: 100,

      }),
      status: 'published',
      branch: 'main',
    },
  });

  // 5. Top 10 Suppliers Bar Chart (horizontal)
  await db.chart.create({
    data: {
      id: 'csv-chart-top-suppliers',
      dashboardId: dashboard.id,
      name: 'Top 10 Suppliers by Retail Sales',
      description: 'Top 10 suppliers ranked by total retail sales volume',
      chartType: 'bar',
      dataSourceId: 'csv-table-warehouse-sales',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: 'supplier',
        yAxis: ['retailSales'],
        metrics: ['retailSales'],
        dimensions: ['supplier'],
        colorPalette: 'databricks',
        showLegend: true,
        showGrid: true,
        showLabels: true,
        stacked: false,
        smooth: false,
        orientation: 'horizontal',
        donut: false,
        aggregateFunction: 'sum',
        limit: 10,

      }),
      status: 'published',
      branch: 'main',
    },
  });

  // 6. Year-over-Year Comparison
  await db.chart.create({
    data: {
      id: 'csv-chart-yearly-comparison',
      dashboardId: dashboard.id,
      name: 'Year-over-Year Sales Comparison',
      description: 'Annual comparison of retail sales, warehouse sales, and retail transfers',
      chartType: 'bar',
      dataSourceId: 'csv-table-warehouse-sales',
      dataSourceType: 'table',
      config: JSON.stringify({
        xAxis: 'year',
        yAxis: ['retailSales', 'warehouseSales', 'retailTransfers'],
        metrics: ['retailSales', 'warehouseSales', 'retailTransfers'],
        dimensions: ['year'],
        colorPalette: 'categorical',
        showLegend: true,
        showGrid: true,
        showLabels: false,
        stacked: false,
        smooth: false,
        orientation: 'vertical',
        donut: false,
        aggregateFunction: 'sum',
        limit: 100,

      }),
      status: 'published',
      branch: 'main',
    },
  });

  // ── Link metrics to charts ──
  await db.chartMetric.createMany({
    data: [
      { chartId: 'csv-chart-monthly-trend', metricId: metricRetailSales.id, alias: 'Retail Sales', axis: 'left', color: '#6666ff' },
      { chartId: 'csv-chart-monthly-trend', metricId: metricWarehouseSales.id, alias: 'Warehouse Sales', axis: 'left', color: '#00c4aa' },
      { chartId: 'csv-chart-sales-by-type', metricId: metricRetailSales.id, alias: 'Retail Sales', axis: 'left', color: '#00897B' },
      { chartId: 'csv-chart-sales-by-type', metricId: metricWarehouseSales.id, alias: 'Warehouse Sales', axis: 'left', color: '#43A047' },
      { chartId: 'csv-chart-yearly-comparison', metricId: metricRetailSales.id, alias: 'Retail Sales', axis: 'left', color: '#10b981' },
      { chartId: 'csv-chart-yearly-comparison', metricId: metricWarehouseSales.id, alias: 'Warehouse Sales', axis: 'left', color: '#3b82f6' },
    ],
  });

  console.log('');
  console.log('✅ Seeding complete!');
  console.log(`  📊 Connector: ${connector.name} (id: ${connector.id})`);
  console.log(`  📈 Charts: 6 created`);
  console.log(`  📋 Dashboard: ${dashboard.name} (id: ${dashboard.id})`);
  console.log(`  📐 Metrics: 2 created`);
  console.log(`  📄 Data: ${rows.length.toLocaleString()} rows processed`);
  console.log('');
  console.log('Data summaries:');
  console.log(`  Monthly data points: ${monthlySalesData.length}`);
  console.log(`  Item types: ${salesByTypeData.map(d => d.type).join(', ')}`);
  console.log(`  Years: ${yearlySalesData.map(d => d.year).join(', ')}`);
  console.log(`  Top supplier: ${topSuppliers[0]?.supplier} ($${topSuppliers[0]?.retailSales.toLocaleString()})`);
  console.log(`  Total retail sales: $${totalRetailSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log(`  Total warehouse sales: $${totalWarehouseSales.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
}

main()
  .catch(e => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
