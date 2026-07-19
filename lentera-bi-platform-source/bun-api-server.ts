/**
 * Lightweight Bun API Server
 * Replaces Next.js server for API routes to reduce memory usage.
 *
 * Port: 3001
 * Database: SQLite via Prisma Client
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

// ─────────────────────────────────────────────
// Prisma Singleton
// ─────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || 'file:./db/custom.db';
process.env.DATABASE_URL = DATABASE_URL;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './upload';

const globalForPrisma = globalThis as unknown as { __bunPrisma: PrismaClient | undefined };
const db = globalForPrisma.__bunPrisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.__bunPrisma = db;

import { createConnectorSchema, validateBody } from './src/lib/validations';

// ─────────────────────────────────────────────
// Connector helpers (from connectors-test route)
// ─────────────────────────────────────────────
const OLAP_TYPES = ['clickhouse', 'bigquery', 'snowflake', 'redshift'];
const OLTP_TYPES = ['postgres', 'mysql', 'sqlite'];
const FILE_TYPES = ['csv', 'json', 'excel', 'parquet'];

function getCategory(type: string): string {
  if (OLAP_TYPES.includes(type)) return 'olap';
  if (OLTP_TYPES.includes(type)) return 'oltp';
  if (FILE_TYPES.includes(type)) return 'file';
  return 'oltp';
}

// ─────────────────────────────────────────────
// Upload helpers
// ─────────────────────────────────────────────
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  csv: ['.csv', '.tsv', '.txt'],
  json: ['.json', '.jsonl', '.ndjson'],
  excel: ['.xlsx', '.xls'],
  parquet: ['.parquet', '.pq'],
};

function getFileType(fileName: string): string | null {
  const ext = extname(fileName).toLowerCase();
  for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(ext)) return type;
  }
  return null;
}

function validateFileType(fileName: string, declaredType?: string): { valid: boolean; error?: string; detectedType?: string } {
  const detectedType = getFileType(fileName);
  if (!detectedType) {
    return { valid: false, error: `Unsupported file extension for: ${fileName}. Allowed: .csv, .json, .jsonl, .xlsx, .xls, .parquet` };
  }
  if (declaredType && detectedType !== declaredType) {
    if (!(declaredType === 'csv' && detectedType === 'csv')) {
      return { valid: false, error: `File extension does not match declared type. File appears to be ${detectedType}, but ${declaredType} was specified.` };
    }
  }
  return { valid: true, detectedType };
}

function inferColumnType(values: unknown[]): string {
  if (values.length === 0) return 'VARCHAR';
  const types = values.map(v => {
    if (v == null) return 'null';
    if (typeof v === 'number') return Number.isInteger(v) ? 'INTEGER' : 'DOUBLE';
    if (typeof v === 'boolean') return 'BOOLEAN';
    if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) return 'TIMESTAMP';
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'DATE';
      return 'VARCHAR';
    }
    if (v instanceof Date) return 'TIMESTAMP';
    return 'VARCHAR';
  });
  const nonNullTypes = types.filter(t => t !== 'null');
  if (nonNullTypes.length === 0) return 'VARCHAR';
  const uniqueTypes = new Set(nonNullTypes);
  if (uniqueTypes.size === 1) return nonNullTypes[0];
  if (nonNullTypes.every(t => ['INTEGER', 'DOUBLE'].includes(t))) return 'DOUBLE';
  return 'VARCHAR';
}

// ─────────────────────────────────────────────
// Connectors-test helpers
// ─────────────────────────────────────────────
interface ConnectionTestParams {
  type: string;
  host: string;
  port: number | string;
  username: string;
  password: string;
  database: string;
  schema?: string;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  tables?: Array<{
    schema: string;
    name: string;
    type: string;
    rowCount: number;
    columns: Array<{ name: string; type: string; nullable: boolean; isPK?: boolean }>;
  }>;
  version?: string;
  error?: string;
}

function validateConnectionParams(params: ConnectionTestParams): { valid: boolean; error?: string } {
  if (!params.type) return { valid: false, error: 'Connector type is required' };
  if (!params.host && params.type !== 'sqlite') return { valid: false, error: 'Host is required for database connections' };
  if (!params.port && params.type !== 'sqlite') return { valid: false, error: 'Port is required for database connections' };
  const portNum = typeof params.port === 'string' ? parseInt(params.port) : params.port;
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: `Invalid port number: ${params.port}. Must be between 1 and 65535.` };
  }
  if (params.host && !/^[a-zA-Z0-9._-]+$/.test(params.host) && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(params.host)) {
    return { valid: false, error: `Invalid host format: ${params.host}` };
  }
  return { valid: true };
}

function simulateConnection(params: ConnectionTestParams): ConnectionTestResult {
  const startTime = Date.now();
  const defaultPorts: Record<string, number> = {
    clickhouse: 9000, postgres: 5432, mysql: 3306,
    bigquery: 443, snowflake: 443, redshift: 5439, sqlite: 0,
  };
  const portNum = typeof params.port === 'string' ? parseInt(params.port) : params.port;
  const isDemoHost = params.host?.startsWith('demo-') || params.host === 'localhost' || params.host === '127.0.0.1';

  if (!isDemoHost) {
    return {
      success: false,
      message: `Connection refused: ${params.host}:${portNum}. Host unreachable. Use demo- prefixed hosts for testing (e.g., demo-clickhouse, demo-postgres).`,
      latency: Date.now() - startTime,
      error: 'ECONNREFUSED',
    };
  }

  const validCredentials: Record<string, { username: string; password: string }> = {
    clickhouse: { username: 'default', password: '' },
    postgres: { username: 'postgres', password: 'postgres' },
    mysql: { username: 'root', password: 'root' },
    bigquery: { username: 'service-account', password: 'key.json' },
    snowflake: { username: 'admin', password: 'Snowflake123!' },
    redshift: { username: 'awsuser', password: 'Redshift123!' },
    sqlite: { username: '', password: '' },
  };

  const expectedCreds = validCredentials[params.type];
  if (expectedCreds && params.username && params.username !== expectedCreds.username) {
    return { success: false, message: `Authentication failed for user "${params.username}". Access denied.`, latency: Date.now() - startTime + Math.floor(Math.random() * 50), error: 'EAUTH' };
  }
  if (expectedCreds && params.password && params.password !== expectedCreds.password && expectedCreds.password !== '') {
    return { success: false, message: `Authentication failed: invalid password for user "${params.username}".`, latency: Date.now() - startTime + Math.floor(Math.random() * 50), error: 'EAUTH' };
  }

  const demoTables = getDemoTables(params.type);
  const versionInfo = getVersionInfo(params.type);
  const latency = 50 + Math.floor(Math.random() * 150);
  return { success: true, message: `Successfully connected to ${params.type} at ${params.host}:${portNum}`, latency, tables: demoTables, version: versionInfo };
}

function getDemoTables(type: string): ConnectionTestResult['tables'] {
  switch (type) {
    case 'clickhouse':
      return [
        { schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000, columns: [{ name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'user_id', type: 'UInt64', nullable: false }, { name: 'restaurant_id', type: 'UInt64', nullable: false }, { name: 'reservation_date', type: 'Date', nullable: false }, { name: 'price_cents', type: 'Int32', nullable: true }, { name: 'active', type: 'UInt8', nullable: false }, { name: 'no_show', type: 'UInt8', nullable: false }, { name: 'channel_id', type: 'UInt32', nullable: true }, { name: 'created_at', type: 'DateTime', nullable: false }] },
        { schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000, columns: [{ name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'name', type: 'String', nullable: false }, { name: 'category', type: 'String', nullable: true }, { name: 'city_id', type: 'UInt32', nullable: true }, { name: 'rating', type: 'Float32', nullable: true }] },
        { schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000, columns: [{ name: 'date', type: 'Date', nullable: false }, { name: 'restaurant_id', type: 'UInt64', nullable: false }, { name: 'gmv', type: 'Float64', nullable: true }, { name: 'total_reservations', type: 'UInt64', nullable: true }, { name: 'channel_name', type: 'String', nullable: true }] },
      ];
    case 'postgres':
      return [
        { schema: 'public', name: 'users', type: 'table', rowCount: 50000, columns: [{ name: 'id', type: 'SERIAL', nullable: false, isPK: true }, { name: 'email', type: 'VARCHAR', nullable: false }, { name: 'name', type: 'VARCHAR', nullable: true }, { name: 'role', type: 'VARCHAR', nullable: true }, { name: 'created_at', type: 'TIMESTAMP', nullable: false }] },
        { schema: 'public', name: 'orders', type: 'table', rowCount: 200000, columns: [{ name: 'id', type: 'SERIAL', nullable: false, isPK: true }, { name: 'user_id', type: 'INT', nullable: false }, { name: 'total_amount', type: 'DECIMAL', nullable: true }, { name: 'status', type: 'VARCHAR', nullable: false }, { name: 'order_date', type: 'DATE', nullable: false }] },
      ];
    case 'mysql':
      return [
        { schema: 'shop_db', name: 'products', type: 'table', rowCount: 8000, columns: [{ name: 'id', type: 'INT', nullable: false, isPK: true }, { name: 'name', type: 'VARCHAR(255)', nullable: false }, { name: 'price', type: 'DECIMAL(10,2)', nullable: true }, { name: 'stock', type: 'INT', nullable: false }, { name: 'category_id', type: 'INT', nullable: true }] },
        { schema: 'shop_db', name: 'transactions', type: 'table', rowCount: 1200000, columns: [{ name: 'id', type: 'BIGINT', nullable: false, isPK: true }, { name: 'product_id', type: 'INT', nullable: false }, { name: 'quantity', type: 'INT', nullable: false }, { name: 'total_price', type: 'DECIMAL(10,2)', nullable: false }, { name: 'created_at', type: 'DATETIME', nullable: false }] },
      ];
    case 'bigquery':
      return [
        { schema: 'analytics', name: 'events', type: 'table', rowCount: 50000000, columns: [{ name: 'event_id', type: 'STRING', nullable: false }, { name: 'event_type', type: 'STRING', nullable: false }, { name: 'user_id', type: 'INT64', nullable: true }, { name: 'event_timestamp', type: 'TIMESTAMP', nullable: false }, { name: 'payload', type: 'JSON', nullable: true }] },
      ];
    case 'snowflake':
      return [
        { schema: 'WAREHOUSE', name: 'DAILY_METRICS', type: 'table', rowCount: 36500, columns: [{ name: 'DATE', type: 'DATE', nullable: false }, { name: 'METRIC_NAME', type: 'VARCHAR', nullable: false }, { name: 'METRIC_VALUE', type: 'NUMBER(18,2)', nullable: true }, { name: 'DIMENSION_KEY', type: 'VARCHAR', nullable: true }] },
      ];
    case 'redshift':
      return [
        { schema: 'public', name: 'fact_sales', type: 'table', rowCount: 15000000, columns: [{ name: 'sale_id', type: 'BIGINT', nullable: false, isPK: true }, { name: 'product_id', type: 'INT', nullable: false }, { name: 'revenue', type: 'DECIMAL(12,2)', nullable: true }, { name: 'sale_date', type: 'DATE', nullable: false }] },
      ];
    default:
      return [];
  }
}

function getVersionInfo(type: string): string {
  const versions: Record<string, string> = {
    clickhouse: 'ClickHouse 24.8.4.13', postgres: 'PostgreSQL 16.2',
    mysql: 'MySQL 8.4.2', bigquery: 'BigQuery API v2',
    snowflake: 'Snowflake 8.19.1', redshift: 'Redshift 1.0.54862', sqlite: 'SQLite 3.45.1',
  };
  return versions[type] || 'Unknown';
}

// ─────────────────────────────────────────────
// JSON response helper
// ─────────────────────────────────────────────
function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function corsOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function jsonCors(data: unknown, status = 200): Response {
  return json(data, status, corsHeaders());
}

// ─────────────────────────────────────────────
// URL parsing helper
// ─────────────────────────────────────────────
function parseUrl(request: Request): { pathname: string; searchParams: URLSearchParams } {
  const url = new URL(request.url);
  return { pathname: url.pathname, searchParams: url.searchParams };
}

async function getBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────

// GET /api - health check
async function handleApiHealth(): Promise<Response> {
  return jsonCors({ message: 'Hello, world!' });
}

// ── Charts CRUD ──
async function handleChartsGet(): Promise<Response> {
  try {
    // Lightweight query - avoid deep includes that cause OOM in memory-constrained containers
    const charts = await db.chart.findMany({
      select: {
        id: true, name: true, chartType: true, description: true, status: true, branch: true,
        dashboardId: true, datasetId: true, dataSourceType: true, config: true, customSQL: true,
        layout: true, dataSourceId: true, ownerUserId: true, createdAt: true, updatedAt: true,
        chartMetrics: { select: { id: true, metricId: true, metric: { select: { id: true, name: true, expression: true } } } },
        dashboard: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return jsonCors(charts);
  } catch (error) {
    console.error('Charts GET error:', error);
    return jsonCors({ error: 'Failed to fetch charts' }, 500);
  }
}

async function handleChartsPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const chart = await db.chart.create({
      data: {
        dashboardId: (body.dashboardId as string) || null,
        name: body.name as string,
        description: (body.description as string) || null,
        chartType: (body.chartType as string) || 'bar',
        dataSourceId: (body.dataSourceId as string) || null,
        dataSourceType: (body.dataSourceType as string) || 'table',
        datasetId: (body.datasetId as string) || null,
        config: body.config ? JSON.stringify(body.config) : null,
        customSQL: (body.customSQL as string) || null,
        layout: body.layout ? JSON.stringify(body.layout) : null,
        status: 'draft',
        branch: 'main',
        ownerUserId: (body.ownerUserId as string) || null,
      },
      include: { chartMetrics: true, dashboard: { select: { name: true } } },
    });
    if (body.metricIds && Array.isArray(body.metricIds)) {
      for (const mId of body.metricIds as string[]) {
        await db.chartMetric.create({ data: { chartId: chart.id, metricId: mId } });
      }
    }
    return jsonCors(chart);
  } catch (error) {
    console.error('Chart POST error:', error);
    return jsonCors({ error: 'Failed to create chart' }, 500);
  }
}

async function handleChartsPut(body: Record<string, unknown>): Promise<Response> {
  try {
    const chart = await db.chart.update({
      where: { id: body.id as string },
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        chartType: body.chartType as string,
        dataSourceId: (body.dataSourceId as string) || null,
        dataSourceType: body.dataSourceType as string,
        datasetId: body.datasetId as string | null,
        config: body.config ? JSON.stringify(body.config) : undefined,
        customSQL: body.customSQL as string,
        layout: body.layout ? JSON.stringify(body.layout) : undefined,
        status: body.status as string,
        dashboardId: body.dashboardId !== undefined ? (body.dashboardId as string || null) : undefined,
      },
      include: { chartMetrics: { include: { metric: true } } },
    });
    return jsonCors(chart);
  } catch (error) {
    console.error('Chart PUT error:', error);
    return jsonCors({ error: 'Failed to update chart' }, 500);
  }
}

async function handleChartsDelete(searchParams: URLSearchParams): Promise<Response> {
  const id = searchParams.get('id');
  if (!id) return jsonCors({ error: 'ID required' }, 400);
  try {
    await db.chartMetric.deleteMany({ where: { chartId: id } });
    await db.chart.delete({ where: { id } });
    return jsonCors({ success: true });
  } catch (error) {
    console.error('Chart DELETE error:', error);
    return jsonCors({ error: 'Failed to delete chart' }, 500);
  }
}

// ── Dashboards CRUD ──
async function handleDashboardsGet(): Promise<Response> {
  try {
    const dashboards = await db.dashboard.findMany({
      include: {
        charts: { select: { id: true, name: true, chartType: true, status: true } },
        datasets: { select: { id: true, name: true, type: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return jsonCors(dashboards);
  } catch (error) {
    console.error('Dashboards GET error:', error);
    return jsonCors({ error: 'Failed to fetch dashboards' }, 500);
  }
}

async function handleDashboardsPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const dashboard = await db.dashboard.create({
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        layout: body.layout ? JSON.stringify(body.layout) : null,
        filters: body.filters ? JSON.stringify(body.filters) : null,
        isPublic: (body.isPublic as boolean) || false,
        status: 'draft',
        branch: 'main',
        ownerUserId: (body.ownerUserId as string) || null,
      },
      include: { charts: true },
    });
    return jsonCors(dashboard);
  } catch (error) {
    console.error('Dashboard POST error:', error);
    return jsonCors({ error: 'Failed to create dashboard' }, 500);
  }
}

async function handleDashboardsPut(body: Record<string, unknown>): Promise<Response> {
  try {
    const dashboard = await db.dashboard.update({
      where: { id: body.id as string },
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        layout: body.layout ? JSON.stringify(body.layout) : undefined,
        filters: body.filters ? JSON.stringify(body.filters) : undefined,
        isPublic: body.isPublic as boolean,
        status: body.status as string,
      },
      include: { charts: { include: { chartMetrics: true } } },
    });
    return jsonCors(dashboard);
  } catch (error) {
    console.error('Dashboard PUT error:', error);
    return jsonCors({ error: 'Failed to update dashboard' }, 500);
  }
}

async function handleDashboardsDelete(searchParams: URLSearchParams): Promise<Response> {
  const id = searchParams.get('id');
  if (!id) return jsonCors({ error: 'ID required' }, 400);
  try {
    await db.chartMetric.deleteMany({ where: { chart: { dashboardId: id } } });
    await db.chart.deleteMany({ where: { dashboardId: id } });
    await db.dashboard.delete({ where: { id } });
    return jsonCors({ success: true });
  } catch (error) {
    console.error('Dashboard DELETE error:', error);
    return jsonCors({ error: 'Failed to delete dashboard' }, 500);
  }
}

// ── Connectors CRUD ──
async function handleConnectorsGet(): Promise<Response> {
  try {
    const connectors = await db.connector.findMany({
      include: { tables: true },
      orderBy: { createdAt: 'desc' },
    });
    return jsonCors(connectors);
  } catch (error) {
    console.error('Connectors GET error:', error);
    return jsonCors({ error: 'Failed to fetch connectors' }, 500);
  }
}

async function handleConnectorsPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const validation = validateBody(createConnectorSchema, body);
    if (!validation.success) return jsonCors({ error: validation.error }, 400);

    const data = validation.data;
    const category = data.category || getCategory(data.type);

    const connector = await db.connector.create({
      data: {
        name: data.name,
        type: data.type,
        category,
        host: data.host || null,
        port: data.port || null,
        database: data.database || null,
        username: data.username || null,
        password: data.password || null,
        schema: data.schema || null,
        filePath: data.filePath || null,
        fileConfig: data.fileConfig ? JSON.stringify(data.fileConfig) : null,
        config: data.config ? JSON.stringify(data.config) : null,
        status: 'connected',
      },
    });

    // Auto-generate demo tables
    if (data.type === 'clickhouse') {
      const demoTables = [
        { schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000, columns: JSON.stringify([{ name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'user_id', type: 'UInt64', nullable: false }, { name: 'restaurant_id', type: 'UInt64', nullable: false }, { name: 'reservation_date', type: 'Date', nullable: false }, { name: 'price_cents', type: 'Int32', nullable: true }, { name: 'active', type: 'UInt8', nullable: false }, { name: 'no_show', type: 'UInt8', nullable: false }, { name: 'channel_id', type: 'UInt32', nullable: true }, { name: 'created_at', type: 'DateTime', nullable: false }]) },
        { schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000, columns: JSON.stringify([{ name: 'id', type: 'UInt64', nullable: false, isPK: true }, { name: 'name', type: 'String', nullable: false }, { name: 'category', type: 'String', nullable: true }, { name: 'city_id', type: 'UInt32', nullable: true }, { name: 'rating', type: 'Float32', nullable: true }]) },
        { schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000, columns: JSON.stringify([{ name: 'date', type: 'Date', nullable: false }, { name: 'restaurant_id', type: 'UInt64', nullable: false }, { name: 'gmv', type: 'Float64', nullable: true }, { name: 'total_reservations', type: 'UInt64', nullable: true }, { name: 'channel_name', type: 'String', nullable: true }]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({ data: { connectorId: connector.id, ...t } });
      }
    } else if (data.type === 'postgres') {
      const demoTables = [
        { schema: 'public', name: 'users', type: 'table', rowCount: 50000, columns: JSON.stringify([{ name: 'id', type: 'SERIAL', nullable: false, isPK: true }, { name: 'email', type: 'VARCHAR', nullable: false }, { name: 'name', type: 'VARCHAR', nullable: true }, { name: 'role', type: 'VARCHAR', nullable: true }, { name: 'created_at', type: 'TIMESTAMP', nullable: false }]) },
        { schema: 'public', name: 'orders', type: 'table', rowCount: 200000, columns: JSON.stringify([{ name: 'id', type: 'SERIAL', nullable: false, isPK: true }, { name: 'user_id', type: 'INT', nullable: false }, { name: 'total_amount', type: 'DECIMAL', nullable: true }, { name: 'status', type: 'VARCHAR', nullable: false }, { name: 'order_date', type: 'DATE', nullable: false }]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({ data: { connectorId: connector.id, ...t } });
      }
    } else if (data.type === 'mysql') {
      const demoTables = [
        { schema: 'shop_db', name: 'products', type: 'table', rowCount: 8000, columns: JSON.stringify([{ name: 'id', type: 'INT', nullable: false, isPK: true }, { name: 'name', type: 'VARCHAR(255)', nullable: false }, { name: 'price', type: 'DECIMAL(10,2)', nullable: true }, { name: 'stock', type: 'INT', nullable: false }, { name: 'category_id', type: 'INT', nullable: true }]) },
        { schema: 'shop_db', name: 'transactions', type: 'table', rowCount: 1200000, columns: JSON.stringify([{ name: 'id', type: 'BIGINT', nullable: false, isPK: true }, { name: 'product_id', type: 'INT', nullable: false }, { name: 'quantity', type: 'INT', nullable: false }, { name: 'total_price', type: 'DECIMAL(10,2)', nullable: false }, { name: 'created_at', type: 'DATETIME', nullable: false }]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({ data: { connectorId: connector.id, ...t } });
      }
    } else if (data.type === 'bigquery') {
      const demoTables = [
        { schema: 'analytics', name: 'events', type: 'table', rowCount: 50000000, columns: JSON.stringify([{ name: 'event_id', type: 'STRING', nullable: false }, { name: 'event_type', type: 'STRING', nullable: false }, { name: 'user_id', type: 'INT64', nullable: true }, { name: 'event_timestamp', type: 'TIMESTAMP', nullable: false }]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({ data: { connectorId: connector.id, ...t } });
      }
    } else if (data.type === 'snowflake') {
      const demoTables = [
        { schema: 'WAREHOUSE', name: 'DAILY_METRICS', type: 'table', rowCount: 36500, columns: JSON.stringify([{ name: 'DATE', type: 'DATE', nullable: false }, { name: 'METRIC_NAME', type: 'VARCHAR', nullable: false }, { name: 'METRIC_VALUE', type: 'NUMBER(18,2)', nullable: true }]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({ data: { connectorId: connector.id, ...t } });
      }
    } else if (data.type === 'redshift') {
      const demoTables = [
        { schema: 'public', name: 'fact_sales', type: 'table', rowCount: 15000000, columns: JSON.stringify([{ name: 'sale_id', type: 'BIGINT', nullable: false, isPK: true }, { name: 'product_id', type: 'INT', nullable: false }, { name: 'revenue', type: 'DECIMAL(12,2)', nullable: true }, { name: 'sale_date', type: 'DATE', nullable: false }]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({ data: { connectorId: connector.id, ...t } });
      }
    } else if (FILE_TYPES.includes(data.type)) {
      const fileName = data.filePath ? data.filePath.split('/').pop() : data.name;
      const fileConfig = data.fileConfig as Record<string, unknown> | null;
      const demoColumns = (fileConfig?.columns as Array<{ name: string; type: string; nullable?: boolean }>) || [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'name', type: 'VARCHAR', nullable: true },
        { name: 'value', type: 'DOUBLE', nullable: true },
        { name: 'date', type: 'DATE', nullable: true },
        { name: 'category', type: 'VARCHAR', nullable: true },
      ];
      await db.dataSourceTable.create({
        data: {
          connectorId: connector.id,
          schema: 'file',
          name: fileName || data.name,
          type: 'table',
          rowCount: (fileConfig?.rowCount as number) || 1000,
          sizeBytes: (fileConfig?.sizeBytes as number) || null,
          columns: JSON.stringify(demoColumns),
        },
      });
    }

    const result = await db.connector.findUnique({
      where: { id: connector.id },
      include: { tables: true },
    });
    return jsonCors(result);
  } catch (error) {
    console.error('Connector POST error:', error);
    return jsonCors({ error: 'Failed to create connector' }, 500);
  }
}

async function handleConnectorsDelete(searchParams: URLSearchParams): Promise<Response> {
  try {
    const id = searchParams.get('id');
    if (!id) return jsonCors({ error: 'ID required' }, 400);
    await db.dataSourceTable.deleteMany({ where: { connectorId: id } });
    await db.connector.delete({ where: { id } });
    return jsonCors({ success: true });
  } catch (error) {
    console.error('Connector DELETE error:', error);
    return jsonCors({ error: 'Failed to delete connector' }, 500);
  }
}

// ── Connectors-test POST ──
async function handleConnectorsTestPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const validation = validateConnectionParams(body as ConnectionTestParams);
    if (!validation.valid) return jsonCors({ success: false, error: validation.error }, 400);

    const result = simulateConnection(body as ConnectionTestParams);

    if (result.success) {
      if (body.connectorId) {
        const connectorId = body.connectorId as string;
        await db.connector.update({ where: { id: connectorId }, data: { status: 'connected', lastSyncAt: new Date() } });

        if (result.tables && result.tables.length > 0) {
          await db.dataSourceTable.deleteMany({ where: { connectorId } });
          for (const table of result.tables) {
            await db.dataSourceTable.create({
              data: { connectorId, schema: table.schema, name: table.name, type: table.type, rowCount: table.rowCount, columns: JSON.stringify(table.columns) },
            });
          }
        }

        const updatedConnector = await db.connector.findUnique({ where: { id: connectorId }, include: { tables: true } });
        return jsonCors({ ...result, synced: true, tableCount: result.tables?.length || 0, connector: updatedConnector });
      }
    }

    return jsonCors(result);
  } catch (error) {
    console.error('Connection test error:', error);
    return jsonCors({ success: false, message: 'Connection test failed', error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}

// ── Datasets CRUD ──
async function handleDatasetsGet(): Promise<Response> {
  try {
    const datasets = await db.dataset.findMany({ orderBy: { updatedAt: 'desc' } });
    return jsonCors(datasets);
  } catch (error) {
    console.error('Datasets GET error:', error);
    return jsonCors({ error: 'Failed to fetch datasets' }, 500);
  }
}

async function handleDatasetsPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const dataset = await db.dataset.create({
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        type: (body.type as string) || 'virtual',
        language: (body.language as string) || 'sql',
        code: (body.code as string) || null,
        sourceTables: body.sourceTables ? JSON.stringify(body.sourceTables) : null,
        outputColumns: body.outputColumns ? JSON.stringify(body.outputColumns) : null,
        connectorId: (body.connectorId as string) || null,
        schedule: (body.schedule as string) || 'manual',
        status: 'draft',
        branch: 'main',
        ownerUserId: (body.ownerUserId as string) || null,
        dashboardId: (body.dashboardId as string) || null,
      },
    });
    return jsonCors(dataset);
  } catch (error) {
    console.error('Dataset POST error:', error);
    return jsonCors({ error: 'Failed to create dataset' }, 500);
  }
}

async function handleDatasetsPut(body: Record<string, unknown>): Promise<Response> {
  try {
    const dataset = await db.dataset.update({
      where: { id: body.id as string },
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        type: body.type as string,
        language: body.language as string,
        code: body.code as string,
        sourceTables: body.sourceTables ? JSON.stringify(body.sourceTables) : undefined,
        outputColumns: body.outputColumns ? JSON.stringify(body.outputColumns) : undefined,
        connectorId: body.connectorId as string | null,
        schedule: body.schedule as string,
        status: body.status as string,
        lastRunStatus: body.lastRunStatus as string,
        lastRunAt: body.lastRunAt ? new Date(body.lastRunAt as string) : undefined,
      },
    });
    return jsonCors(dataset);
  } catch (error) {
    console.error('Dataset PUT error:', error);
    return jsonCors({ error: 'Failed to update dataset' }, 500);
  }
}

async function handleDatasetsDelete(searchParams: URLSearchParams): Promise<Response> {
  const id = searchParams.get('id');
  if (!id) return jsonCors({ error: 'ID required' }, 400);
  try {
    await db.dataset.delete({ where: { id } });
    return jsonCors({ success: true });
  } catch (error) {
    console.error('Dataset DELETE error:', error);
    return jsonCors({ error: 'Failed to delete dataset' }, 500);
  }
}

// ── Metric-defs CRUD ──
async function handleMetricDefsGet(): Promise<Response> {
  try {
    const metrics = await db.metricDef.findMany({
      include: { metricSources: true, chartMetrics: { include: { chart: { select: { id: true, name: true, dashboardId: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });
    return jsonCors(metrics);
  } catch (error) {
    console.error('Metrics GET error:', error);
    return jsonCors({ error: 'Failed to fetch metrics' }, 500);
  }
}

async function handleMetricDefsPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const metric = await db.metricDef.create({
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        expression: (body.expression as string) || null,
        language: (body.language as string) || 'sql',
        aggregation: (body.aggregation as string) || null,
        sourceTableId: (body.sourceTableId as string) || null,
        sourceColumn: (body.sourceColumn as string) || null,
        filters: body.filters ? JSON.stringify(body.filters) : null,
        dimensions: body.dimensions ? JSON.stringify(body.dimensions) : null,
        timeGrain: (body.timeGrain as string) || null,
        status: 'draft',
        branch: 'main',
        ownerUserId: (body.ownerUserId as string) || null,
      },
    });

    if (body.sources && Array.isArray(body.sources)) {
      for (const src of body.sources as Array<Record<string, unknown>>) {
        await db.metricSource.create({
          data: {
            metricId: metric.id,
            tableId: (src.tableId as string) || null,
            connectorId: (src.connectorId as string) || null,
            schemaName: (src.schemaName as string) || null,
            tableName: src.tableName as string,
            columnName: (src.columnName as string) || null,
            role: (src.role as string) || 'measure',
            expression: (src.expression as string) || null,
          },
        });
      }
    }

    const result = await db.metricDef.findUnique({ where: { id: metric.id }, include: { metricSources: true } });
    return jsonCors(result);
  } catch (error) {
    console.error('Metric POST error:', error);
    return jsonCors({ error: 'Failed to create metric' }, 500);
  }
}

async function handleMetricDefsPut(body: Record<string, unknown>): Promise<Response> {
  try {
    const metric = await db.metricDef.update({
      where: { id: body.id as string },
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        expression: body.expression as string,
        language: body.language as string,
        aggregation: body.aggregation as string,
        sourceTableId: (body.sourceTableId as string) || null,
        sourceColumn: body.sourceColumn as string,
        filters: body.filters ? JSON.stringify(body.filters) : undefined,
        dimensions: body.dimensions ? JSON.stringify(body.dimensions) : undefined,
        timeGrain: body.timeGrain as string,
        status: body.status as string,
        version: { increment: 1 },
      },
      include: { metricSources: true },
    });
    return jsonCors(metric);
  } catch (error) {
    console.error('Metric PUT error:', error);
    return jsonCors({ error: 'Failed to update metric' }, 500);
  }
}

async function handleMetricDefsDelete(searchParams: URLSearchParams): Promise<Response> {
  const id = searchParams.get('id');
  if (!id) return jsonCors({ error: 'ID required' }, 400);
  try {
    await db.chartMetric.deleteMany({ where: { metricId: id } });
    await db.metricSource.deleteMany({ where: { metricId: id } });
    await db.metricDef.delete({ where: { id } });
    return jsonCors({ success: true });
  } catch (error) {
    console.error('Metric DELETE error:', error);
    return jsonCors({ error: 'Failed to delete metric' }, 500);
  }
}

// ── Transforms CRUD ──
async function handleTransformsGet(): Promise<Response> {
  try {
    const transforms = await db.transform.findMany({ orderBy: { updatedAt: 'desc' } });
    return jsonCors(transforms);
  } catch (error) {
    console.error('Transforms GET error:', error);
    return jsonCors({ error: 'Failed to fetch transforms' }, 500);
  }
}

async function handleTransformsPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const transform = await db.transform.create({
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        type: (body.type as string) || 'sql',
        code: (body.code as string) || '',
        config: body.config ? JSON.stringify(body.config) : null,
        inputTables: body.inputTables ? JSON.stringify(body.inputTables) : null,
        outputSpec: body.outputSpec ? JSON.stringify(body.outputSpec) : null,
        schedule: (body.schedule as string) || 'manual',
        environment: body.environment ? JSON.stringify(body.environment) : null,
        status: 'draft',
        branch: 'main',
        ownerUserId: (body.ownerUserId as string) || null,
      },
    });
    return jsonCors(transform);
  } catch (error) {
    console.error('Transform POST error:', error);
    return jsonCors({ error: 'Failed to create transform' }, 500);
  }
}

async function handleTransformsPut(body: Record<string, unknown>): Promise<Response> {
  try {
    const transform = await db.transform.update({
      where: { id: body.id as string },
      data: {
        name: body.name as string,
        description: (body.description as string) || null,
        type: body.type as string,
        code: body.code as string,
        config: body.config ? JSON.stringify(body.config) : undefined,
        inputTables: body.inputTables ? JSON.stringify(body.inputTables) : undefined,
        outputSpec: body.outputSpec ? JSON.stringify(body.outputSpec) : undefined,
        schedule: body.schedule as string,
        environment: body.environment ? JSON.stringify(body.environment) : undefined,
        status: body.status as string,
        lastRunStatus: body.lastRunStatus as string,
        lastRunAt: body.lastRunAt ? new Date(body.lastRunAt as string) : undefined,
      },
    });
    return jsonCors(transform);
  } catch (error) {
    console.error('Transform PUT error:', error);
    return jsonCors({ error: 'Failed to update transform' }, 500);
  }
}

async function handleTransformsDelete(searchParams: URLSearchParams): Promise<Response> {
  const id = searchParams.get('id');
  if (!id) return jsonCors({ error: 'ID required' }, 400);
  try {
    await db.transform.delete({ where: { id } });
    return jsonCors({ success: true });
  } catch (error) {
    console.error('Transform DELETE error:', error);
    return jsonCors({ error: 'Failed to delete transform' }, 500);
  }
}

// ── Branches ──
async function handleBranchesGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const dashboardId = searchParams.get('dashboardId');
    if (dashboardId) {
      const branches = await db.dashboardBranch.findMany({
        where: { dashboardId },
        include: { mergeRequests: true },
        orderBy: { createdAt: 'desc' },
      });
      return jsonCors(branches);
    }
    const allBranches = await db.dashboardBranch.findMany({
      include: { mergeRequests: true, dashboard: { select: { name: true } } },
    });
    return jsonCors(allBranches);
  } catch (error) {
    console.error('Branches GET error:', error);
    return jsonCors({ error: 'Failed to fetch branches' }, 500);
  }
}

async function handleBranchesPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const branch = await db.dashboardBranch.create({
      data: {
        dashboardId: body.dashboardId as string,
        name: body.name as string,
        description: (body.description as string) || null,
        baseBranch: (body.baseBranch as string) || 'main',
        baseCommitAt: new Date(),
        status: 'active',
        ownerUserId: (body.ownerUserId as string) || null,
      },
    });
    return jsonCors(branch);
  } catch (error) {
    console.error('Branch POST error:', error);
    return jsonCors({ error: 'Failed to create branch' }, 500);
  }
}

// ── Merge Requests ──
async function handleMergeRequestsGet(): Promise<Response> {
  try {
    const mergeRequests = await db.mergeRequest.findMany({
      include: { sourceBranch: { include: { dashboard: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return jsonCors(mergeRequests);
  } catch (error) {
    console.error('MergeRequests GET error:', error);
    return jsonCors({ error: 'Failed to fetch merge requests' }, 500);
  }
}

async function handleMergeRequestsPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const sourceBranch = await db.dashboardBranch.findUnique({ where: { id: body.sourceBranchId as string } });
    if (!sourceBranch) return jsonCors({ error: 'Source branch not found' }, 404);

    const conflictingMRs = await db.mergeRequest.findMany({
      where: {
        sourceBranch: { dashboardId: sourceBranch.dashboardId },
        targetBranch: (body.targetBranch as string) || 'main',
        status: { in: ['open', 'reviewing'] },
      },
    });

    let conflictDetails = null;
    let status = 'open';
    if (conflictingMRs.length > 0) {
      status = 'conflict';
      conflictDetails = JSON.stringify({
        reason: 'Another merge request is already pending for the same target branch',
        conflictingMRs: conflictingMRs.map(mr => mr.id),
        suggestion: 'Resolve the existing merge request first, or rebase your branch',
      });
    }

    const mr = await db.mergeRequest.create({
      data: {
        dashboardId: sourceBranch.dashboardId,
        sourceBranchId: body.sourceBranchId as string,
        targetBranch: (body.targetBranch as string) || 'main',
        title: body.title as string,
        description: (body.description as string) || null,
        status,
        conflictDetails,
        ownerUserId: (body.ownerUserId as string) || null,
        reviewerUserId: (body.reviewerUserId as string) || null,
      },
      include: { sourceBranch: true },
    });
    return jsonCors(mr);
  } catch (error) {
    console.error('MergeRequest POST error:', error);
    return jsonCors({ error: 'Failed to create merge request' }, 500);
  }
}

async function handleMergeRequestsPut(body: Record<string, unknown>): Promise<Response> {
  try {
    if (body.action === 'merge') {
      const mr = await db.mergeRequest.update({
        where: { id: body.id as string },
        data: { status: 'merged', mergedAt: new Date() },
        include: { sourceBranch: true },
      });
      if (mr.sourceBranch) {
        await db.dashboardBranch.update({ where: { id: mr.sourceBranchId }, data: { status: 'merged' } });
      }
      return jsonCors(mr);
    }

    if (body.action === 'resolve_conflict') {
      const mr = await db.mergeRequest.update({
        where: { id: body.id as string },
        data: { status: 'open', conflictDetails: null },
      });
      return jsonCors(mr);
    }

    const mr = await db.mergeRequest.update({
      where: { id: body.id as string },
      data: { status: body.status as string },
    });
    return jsonCors(mr);
  } catch (error) {
    console.error('MergeRequest PUT error:', error);
    return jsonCors({ error: 'Failed to update merge request' }, 500);
  }
}

// ── Collaboration ──
async function handleCollaborationGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const dashboardId = searchParams.get('dashboardId');
    if (dashboardId) {
      const sessions = await db.collaborationSession.findMany({ where: { dashboardId, status: 'active' } });
      const enriched = await Promise.all(sessions.map(async (s) => {
        const user = await db.user.findUnique({ where: { id: s.userId } });
        return { ...s, user };
      }));
      return jsonCors(enriched);
    }
    const allSessions = await db.collaborationSession.findMany({ where: { status: 'active' } });
    return jsonCors(allSessions);
  } catch (error) {
    console.error('Collaboration GET error:', error);
    return jsonCors({ error: 'Failed to fetch sessions' }, 500);
  }
}

async function handleCollaborationPost(body: Record<string, unknown>): Promise<Response> {
  try {
    const session = await db.collaborationSession.upsert({
      where: { dashboardId_userId: { dashboardId: body.dashboardId as string, userId: body.userId as string } },
      create: {
        dashboardId: body.dashboardId as string,
        userId: body.userId as string,
        cursorX: (body.cursorX as number) || 0,
        cursorY: (body.cursorY as number) || 0,
        activeChartId: (body.activeChartId as string) || null,
        status: 'active',
        lastSeenAt: new Date(),
      },
      update: {
        cursorX: body.cursorX != null ? body.cursorX as number : undefined,
        cursorY: body.cursorY != null ? body.cursorY as number : undefined,
        activeChartId: body.activeChartId != null ? body.activeChartId as string : undefined,
        status: 'active',
        lastSeenAt: new Date(),
      },
    });
    return jsonCors(session);
  } catch (error) {
    console.error('Collaboration POST error:', error);
    return jsonCors({ error: 'Failed to update session' }, 500);
  }
}

// ── Upload ──
async function handleUploadPost(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const connectorName = formData.get('name') as string | null;
    const declaredType = formData.get('type') as string | null;
    const delimiter = (formData.get('delimiter') as string | null) || ',';
    const encoding = (formData.get('encoding') as string | null) || 'utf-8';
    const sheetName = formData.get('sheet') as string | null;
    const hasHeader = formData.get('header') as string | null !== 'false';

    if (!file) {
      return jsonCors({ error: 'No file provided. Please select a file to upload.' }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return jsonCors({ error: `File too large: ${sizeMB} MB. Maximum allowed size is 100 MB.`, maxSize: '100 MB', actualSize: `${sizeMB} MB` }, 413);
    }

    const typeValidation = validateFileType(file.name, declaredType || undefined);
    if (!typeValidation.valid) {
      return jsonCors({ error: typeValidation.error }, 400);
    }

    const fileType = typeValidation.detectedType!;

    // Save file to upload directory
    const uploadDir = UPLOAD_DIR;
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = join(uploadDir, uniqueName);

    const bytes = await file.arrayBuffer();
    writeFileSync(filePath, Buffer.from(bytes));

    // Parse file and extract schema
    let columns: Array<{ name: string; type: string; nullable: boolean; sample?: unknown }> = [];
    let rowCount = 0;
    let preview: Record<string, unknown>[] = [];
    let parseError: string | null = null;

    try {
      const buffer = Buffer.from(bytes);

      switch (fileType) {
        case 'csv': {
          const Papa = await import('papaparse');
          const result = Papa.parse(buffer.toString(encoding as BufferEncoding || 'utf-8'), {
            header: hasHeader,
            delimiter: delimiter === 'tab' ? '\t' : delimiter,
            preview: 101,
            skipEmptyLines: true,
            dynamicTyping: true,
          });

          if (result.errors.length > 0 && result.data.length === 0) {
            parseError = `CSV parse error: ${result.errors[0].message}`;
          } else {
            const fields = result.meta.fields || [];
            rowCount = result.data.length;
            preview = result.data.slice(0, 5);

            columns = fields.map((field: string) => {
              const values = result.data.slice(0, 20).map((row: Record<string, unknown>) => row[field]).filter((v: unknown) => v != null);
              const inferredType = inferColumnType(values);
              return { name: field, type: inferredType, nullable: values.length < 20, sample: values[0] };
            });
          }
          break;
        }

        case 'json': {
          const text = buffer.toString(encoding as BufferEncoding || 'utf-8');
          let jsonData: unknown[];

          try {
            const parsed = JSON.parse(text);
            jsonData = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            jsonData = text.trim().split('\n').filter(Boolean).map(line => {
              try { return JSON.parse(line); } catch { return null; }
            }).filter(Boolean);
          }

          if (jsonData.length === 0) {
            parseError = 'JSON file contains no parseable data';
          } else {
            rowCount = jsonData.length;
            preview = jsonData.slice(0, 5);

            const sampleRecord = jsonData[0] as Record<string, unknown>;
            if (typeof sampleRecord === 'object' && sampleRecord !== null) {
              const allKeys = new Set<string>();
              (jsonData.slice(0, 50) as Record<string, unknown>[]).forEach((record) => {
                if (typeof record === 'object' && record !== null) {
                  Object.keys(record).forEach(k => allKeys.add(k));
                }
              });

              columns = Array.from(allKeys).map(key => {
                const values = (jsonData.slice(0, 20) as Record<string, unknown>[]).map(r => r[key]).filter(v => v != null);
                const inferredType = inferColumnType(values);
                return { name: key, type: inferredType, nullable: values.length < 20, sample: values[0] };
              });
            }
          }
          break;
        }

        case 'excel': {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const targetSheet = sheetName || workbook.SheetNames[0];

          if (!workbook.Sheets[targetSheet]) {
            parseError = `Sheet "${targetSheet}" not found. Available: ${workbook.SheetNames.join(', ')}`;
          } else {
            const sheet = workbook.Sheets[targetSheet];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });

            if (jsonData.length === 0) {
              parseError = 'Excel sheet contains no data';
            } else {
              rowCount = jsonData.length;
              preview = jsonData.slice(0, 5);

              const allKeys = new Set<string>();
              (jsonData.slice(0, 50) as Record<string, unknown>[]).forEach((record) => {
                Object.keys(record).forEach(k => allKeys.add(k));
              });

              columns = Array.from(allKeys).map(key => {
                const values = (jsonData.slice(0, 20) as Record<string, unknown>[]).map((r: Record<string, unknown>) => r[key]).filter(v => v != null);
                const inferredType = inferColumnType(values);
                return { name: key, type: inferredType, nullable: values.length < 20, sample: values[0] };
              });
            }
          }
          break;
        }

        case 'parquet': {
          rowCount = -1;
          columns = [{ name: 'data', type: 'BINARY', nullable: true, sample: null }];
          parseError = null;
          break;
        }
      }
    } catch (err) {
      parseError = `Parse warning: ${err instanceof Error ? err.message : 'Unknown error'}. File saved successfully.`;
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    return jsonCors({
      success: true,
      file: {
        name: file.name,
        storedName: uniqueName,
        path: filePath,
        type: fileType,
        size: file.size,
        sizeMB: `${fileSizeMB} MB`,
        lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      },
      schema: {
        columns,
        rowCount,
        detectedType: fileType,
        delimiter: fileType === 'csv' ? delimiter : null,
        hasHeader,
        sheetName: fileType === 'excel' ? sheetName : null,
      },
      preview: preview.slice(0, 5),
      parseError,
    }, 201);

  } catch (error) {
    console.error('Upload error:', error);
    return jsonCors({ error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}

// ── Users ──
async function handleUsersGet(): Promise<Response> {
  try {
    const users = await db.user.findMany({ include: { activities: { take: 5, orderBy: { createdAt: 'desc' } } } });
    return jsonCors(users);
  } catch (error) {
    console.error('Users GET error:', error);
    return jsonCors({ error: 'Failed to fetch users' }, 500);
  }
}

// ── Overview ──
async function handleOverviewGet(): Promise<Response> {
  try {
    const [latestRun, nodeCounts, findingCounts, totalEdges, totalCanonicalMetrics] = await Promise.all([
      db.buildRun.findFirst({ orderBy: { createdAt: 'desc' } }),
      db.node.groupBy({ by: ['nodeType'], _count: { id: true } }),
      db.finding.groupBy({ by: ['severity'], _count: { id: true } }),
      db.edge.count(),
      db.canonicalMetric.count(),
    ]);

    const nodeTypeMap: Record<string, number> = {};
    nodeCounts.forEach((item) => { nodeTypeMap[item.nodeType] = item._count.id; });

    const severityMap: Record<string, number> = { critical: 0, error: 0, warning: 0, info: 0 };
    findingCounts.forEach((item) => { severityMap[item.severity] = item._count.id; });

    const totalDatasets = nodeTypeMap['dataset'] || 0;
    const unmatchedDatasets = await db.node.count({
      where: { nodeType: 'dataset', qualifiedName: { startsWith: 'external_api' } },
    });
    const resolvedDatasets = totalDatasets > 0 ? (totalDatasets - unmatchedDatasets) / totalDatasets : 0;

    const driftFindings = await db.finding.findMany({
      where: { ruleId: 'R3' },
      include: { node: { select: { name: true, qualifiedName: true } } },
    });

    return jsonCors({
      buildRun: latestRun,
      nodeCounts: nodeTypeMap,
      severityCounts: severityMap,
      totalNodes: Object.values(nodeTypeMap).reduce((a, b) => a + b, 0),
      totalEdges,
      totalCanonicalMetrics,
      lineageCoverage: resolvedDatasets,
      driftFindings: driftFindings.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        node: f.node?.name,
        evidence: f.evidence ? JSON.parse(f.evidence) : null,
      })),
      platformCounts: (await db.node.groupBy({ by: ['platform'], _count: { id: true } })).reduce((acc: Record<string, number>, item) => {
        acc[item.platform] = item._count.id;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Overview API error:', error);
    return jsonCors({ error: 'Failed to fetch overview' }, 500);
  }
}

// ── Lineage ──
async function handleLineageGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const nodeType = searchParams.get('type');
    const platform = searchParams.get('platform');
    const focusId = searchParams.get('focus');
    const direction = searchParams.get('direction') || 'both';
    const depth = parseInt(searchParams.get('depth') || '3');

    const nodeWhere: Record<string, unknown> = {};
    if (nodeType) nodeWhere.nodeType = nodeType;
    if (platform) nodeWhere.platform = platform;

    let focusNodeIds: string[] = [];

    if (focusId) {
      const focusNode = await db.node.findFirst({
        where: {
          OR: [
            { id: focusId },
            { externalId: focusId },
            { name: { contains: focusId, mode: 'insensitive' } },
          ],
        },
      });

      if (focusNode) {
        focusNodeIds = [focusNode.id];

        if (direction === 'upstream' || direction === 'both') {
          let currentIds = [focusNode.id];
          for (let i = 0; i < depth; i++) {
            const upstreamEdges = await db.edge.findMany({ where: { targetNodeId: { in: currentIds } }, select: { sourceNodeId: true } });
            const newIds = upstreamEdges.map((e) => e.sourceNodeId).filter((id) => !focusNodeIds.includes(id));
            if (newIds.length === 0) break;
            focusNodeIds.push(...newIds);
            currentIds = newIds;
          }
        }

        if (direction === 'downstream' || direction === 'both') {
          let currentIds = [focusNode.id];
          for (let i = 0; i < depth; i++) {
            const downstreamEdges = await db.edge.findMany({ where: { sourceNodeId: { in: currentIds } }, select: { targetNodeId: true } });
            const newIds = downstreamEdges.map((e) => e.targetNodeId).filter((id) => !focusNodeIds.includes(id));
            if (newIds.length === 0) break;
            focusNodeIds.push(...newIds);
            currentIds = newIds;
          }
        }
      }
    }

    const nodes = focusNodeIds.length > 0
      ? await db.node.findMany({ where: { id: { in: focusNodeIds } } })
      : await db.node.findMany({ where: nodeWhere });

    const nodeIds = nodes.map((n) => n.id);

    const edges = await db.edge.findMany({ where: { sourceNodeId: { in: nodeIds }, targetNodeId: { in: nodeIds } } });
    const findings = await db.finding.findMany({ where: { nodeId: { in: nodeIds } } });

    const graphNodes = nodes.map((n) => ({
      id: n.id, externalId: n.externalId, name: n.name, type: n.nodeType,
      platform: n.platform, qualifiedName: n.qualifiedName, description: n.description,
      owner: n.owner, status: n.status, metadata: n.metadata ? JSON.parse(n.metadata) : null,
      findings: findings.filter((f) => f.nodeId === n.id).length,
    }));

    const graphEdges = edges.map((e) => ({
      id: e.id, source: e.sourceNodeId, target: e.targetNodeId, type: e.edgeType,
      confidence: e.confidence, extractionMethod: e.extractionMethod, expression: e.expression,
      sourcePlatform: e.sourcePlatform,
    }));

    return jsonCors({
      nodes: graphNodes,
      edges: graphEdges,
      findings: findings.map((f) => ({ id: f.id, ruleId: f.ruleId, severity: f.severity, title: f.title, nodeId: f.nodeId })),
    });
  } catch (error) {
    console.error('Lineage API error:', error);
    return jsonCors({ error: 'Failed to fetch lineage' }, 500);
  }
}

// ── Audit ──
async function handleAuditGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const severity = searchParams.get('severity');
    const ruleId = searchParams.get('ruleId');
    const nodeType = searchParams.get('nodeType');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;
    if (ruleId) where.ruleId = ruleId;
    if (status) where.status = status;

    const findings = await db.finding.findMany({
      where,
      include: {
        node: { select: { id: true, name: true, nodeType: true, platform: true, qualifiedName: true, owner: true, status: true } },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    const filtered = nodeType ? findings.filter((f) => f.node?.nodeType === nodeType) : findings;

    const rules = [
      { id: 'R1', name: 'Bypass Governance', description: 'Detects models/datasets bypassing required transformation layers.' },
      { id: 'R2', name: 'Orphaned Dataset', description: 'Detects datasets that cannot be matched to dbt or warehouse objects.' },
      { id: 'R3', name: 'Metric Drift', description: 'Detects observed metrics differing from canonical definitions.' },
      { id: 'R4', name: 'Excluded Model in Use', description: 'Detects excluded models still used by active BI assets.' },
      { id: 'R5', name: 'Missing Lineage', description: 'Detects charts with unresolved dataset or metric lineage.' },
      { id: 'R6', name: 'Duplicate Model', description: 'Detects models with near-identical SQL.' },
      { id: 'R7', name: 'Missing Documentation', description: 'Detects critical assets without owner or description.' },
      { id: 'R8', name: 'Direct Raw-Table Dataset', description: 'Detects datasets using configured raw schemas.' },
    ];

    const severityCounts = {
      critical: findings.filter((f) => f.severity === 'critical').length,
      error: findings.filter((f) => f.severity === 'error').length,
      warning: findings.filter((f) => f.severity === 'warning').length,
      info: findings.filter((f) => f.severity === 'info').length,
    };

    return jsonCors({
      findings: filtered.map((f) => ({
        id: f.id, ruleId: f.ruleId, ruleVersion: f.ruleVersion, severity: f.severity,
        title: f.title, description: f.description,
        evidence: f.evidence ? JSON.parse(f.evidence) : null,
        recommendation: f.recommendation, status: f.status, suppressionReason: f.suppressionReason,
        node: f.node ? { id: f.node.id, name: f.node.name, type: f.node.nodeType, platform: f.node.platform, qualifiedName: f.node.qualifiedName } : null,
        createdAt: f.createdAt,
      })),
      rules,
      severityCounts,
      total: filtered.length,
    });
  } catch (error) {
    console.error('Audit API error:', error);
    return jsonCors({ error: 'Failed to fetch audit findings' }, 500);
  }
}

// ── Metrics (canonical vs observed) ──
async function handleMetricsGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const name = searchParams.get('name');

    const canonicalMetrics = await db.canonicalMetric.findMany(
      name ? { where: { OR: [{ name: { contains: name } }, { aliases: { contains: name } }] } } : {}
    );

    const observedMetrics = await db.node.findMany({ where: { nodeType: 'metric' } });

    const comparisons = canonicalMetrics.map((cm) => {
      const matching = observedMetrics.filter((om) => {
        const aliases: string[] = cm.aliases ? JSON.parse(cm.aliases) : [];
        return om.name.toLowerCase() === cm.name.toLowerCase() ||
          aliases.some((a) => a.toLowerCase() === om.name.toLowerCase());
      });

      return {
        canonical: {
          id: cm.id, name: cm.name, aliases: cm.aliases ? JSON.parse(cm.aliases) : [],
          description: cm.description, expression: cm.expression, aggregation: cm.aggregation,
          requiredFilters: cm.requiredFilters ? JSON.parse(cm.requiredFilters) : [],
          dimensions: cm.dimensions ? JSON.parse(cm.dimensions) : [],
          currencyRequirement: cm.currencyRequirement, timeGrain: cm.timeGrain,
          owner: cm.owner, version: cm.version, severityOnDrift: cm.severityOnDrift,
        },
        observed: matching.map((om) => ({
          id: om.id, name: om.name, qualifiedName: om.qualifiedName,
          description: om.description, metadata: om.metadata ? JSON.parse(om.metadata) : {},
        })),
        driftStatus: matching.length === 0 ? 'unmapped' : 'potential_drift',
      };
    });

    return jsonCors({
      canonicalMetrics: canonicalMetrics.map((cm) => ({
        id: cm.id, name: cm.name, aliases: cm.aliases ? JSON.parse(cm.aliases) : [],
        description: cm.description, expression: cm.expression, aggregation: cm.aggregation,
        requiredFilters: cm.requiredFilters ? JSON.parse(cm.requiredFilters) : [],
        dimensions: cm.dimensions ? JSON.parse(cm.dimensions) : [],
        currencyRequirement: cm.currencyRequirement, timeGrain: cm.timeGrain,
        owner: cm.owner, version: cm.version, severityOnDrift: cm.severityOnDrift,
      })),
      observedMetrics: observedMetrics.map((om) => ({
        id: om.id, name: om.name, qualifiedName: om.qualifiedName,
        description: om.description, owner: om.owner, metadata: om.metadata ? JSON.parse(om.metadata) : {},
      })),
      comparisons,
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return jsonCors({ error: 'Failed to fetch metrics' }, 500);
  }
}

// ── Nodes ──
async function handleNodesGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const id = searchParams.get('id');

    if (!id) return jsonCors({ error: 'id required' }, 400);

    const node = await db.node.findFirst({ where: { OR: [{ id }, { externalId: id }] } });

    if (!node) return jsonCors({ error: 'Node not found' }, 404);

    const [upstreamEdges, downstreamEdges] = await Promise.all([
      db.edge.findMany({ where: { targetNodeId: node.id }, include: { sourceNode: true } }),
      db.edge.findMany({ where: { sourceNodeId: node.id }, include: { targetNode: true } }),
    ]);

    const findings = await db.finding.findMany({ where: { nodeId: node.id } });

    let canonicalComparison = null;
    if (node.nodeType === 'metric') {
      const canonicalMetrics = await db.canonicalMetric.findMany();
      for (const cm of canonicalMetrics) {
        const aliases: string[] = cm.aliases ? JSON.parse(cm.aliases) : [];
        if (node.name.toLowerCase() === cm.name.toLowerCase() || aliases.some((a) => a.toLowerCase() === node.name.toLowerCase())) {
          canonicalComparison = {
            canonical: {
              id: cm.id, name: cm.name, expression: cm.expression, aggregation: cm.aggregation,
              requiredFilters: cm.requiredFilters ? JSON.parse(cm.requiredFilters) : [],
              dimensions: cm.dimensions ? JSON.parse(cm.dimensions) : [],
            },
            observed: { name: node.name, metadata: node.metadata ? JSON.parse(node.metadata) : {} },
          };
          break;
        }
      }
    }

    return jsonCors({
      node: {
        id: node.id, externalId: node.externalId, name: node.name, type: node.nodeType,
        platform: node.platform, qualifiedName: node.qualifiedName, description: node.description,
        owner: node.owner, status: node.status, metadata: node.metadata ? JSON.parse(node.metadata) : null,
        createdAt: node.createdAt, updatedAt: node.updatedAt,
      },
      upstream: upstreamEdges.map((e) => ({
        edgeId: e.id, edgeType: e.edgeType, confidence: e.confidence, expression: e.expression,
        node: { id: e.sourceNode.id, name: e.sourceNode.name, type: e.sourceNode.nodeType, platform: e.sourceNode.platform, qualifiedName: e.sourceNode.qualifiedName },
      })),
      downstream: downstreamEdges.map((e) => ({
        edgeId: e.id, edgeType: e.edgeType, confidence: e.confidence, expression: e.expression,
        node: { id: e.targetNode.id, name: e.targetNode.name, type: e.targetNode.nodeType, platform: e.targetNode.platform, qualifiedName: e.targetNode.qualifiedName },
      })),
      findings: findings.map((f) => ({
        id: f.id, ruleId: f.ruleId, severity: f.severity, title: f.title,
        description: f.description, evidence: f.evidence ? JSON.parse(f.evidence) : null,
        recommendation: f.recommendation, status: f.status,
      })),
      canonicalComparison,
    });
  } catch (error) {
    console.error('Node detail API error:', error);
    return jsonCors({ error: 'Failed to fetch node detail' }, 500);
  }
}

// ── Impact ──
async function handleImpactGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const nodeId = searchParams.get('nodeId');
    const direction = searchParams.get('direction') || 'downstream';

    if (!nodeId) return jsonCors({ error: 'nodeId required' }, 400);

    const node = await db.node.findFirst({ where: { OR: [{ id: nodeId }, { externalId: nodeId }] } });

    if (!node) return jsonCors({ error: 'Node not found' }, 404);

    const affectedNodes: Record<string, unknown>[] = [];
    const affectedPaths: Record<string, unknown>[] = [];
    const visited = new Set<string>();
    let currentLevel = [{ id: node.id, path: [node.id] }];
    visited.add(node.id);

    const maxDepth = 10;

    for (let d = 0; d < maxDepth && currentLevel.length > 0; d++) {
      const edgeWhere = direction === 'downstream'
        ? { sourceNodeId: { in: currentLevel.map((c) => c.id) } }
        : { targetNodeId: { in: currentLevel.map((c) => c.id) } };

      const edges = await db.edge.findMany({ where: edgeWhere });
      const nextLevel: { id: string; path: string[] }[] = [];

      for (const edge of edges) {
        const connectedId = direction === 'downstream' ? edge.targetNodeId : edge.sourceNodeId;
        if (!visited.has(connectedId)) {
          visited.add(connectedId);
          const parentPath = currentLevel.find((c) => c.id === edge.sourceNodeId || c.id === edge.targetNodeId)?.path || [];
          const newPath = [...parentPath, connectedId];
          nextLevel.push({ id: connectedId, path: newPath });
          affectedPaths.push({
            from: edge.sourceNodeId,
            to: edge.targetNodeId,
            edgeType: edge.edgeType,
            confidence: edge.confidence,
          });
        }
      }

      currentLevel = nextLevel;
    }

    const affectedNodeDetails = await db.node.findMany({
      where: { id: { in: Array.from(visited).filter((id) => id !== node.id) } },
    });

    const byType: Record<string, string[]> = {};
    for (const n of affectedNodeDetails) {
      if (!byType[n.nodeType]) byType[n.nodeType] = [];
      byType[n.nodeType].push(n.id);
    }

    const confidenceSummary: Record<string, number> = {};
    for (const path of affectedPaths) {
      const conf = (path as Record<string, unknown>).confidence as string;
      confidenceSummary[conf] = (confidenceSummary[conf] || 0) + 1;
    }

    return jsonCors({
      sourceNode: { id: node.id, name: node.name, type: node.nodeType, qualifiedName: node.qualifiedName },
      direction,
      affectedNodes: affectedNodeDetails.map((n) => ({
        id: n.id, name: n.name, type: n.nodeType, platform: n.platform,
        qualifiedName: n.qualifiedName, owner: n.owner, status: n.status,
      })),
      affectedPaths,
      byType,
      confidenceSummary,
      totalAffected: affectedNodeDetails.length,
    });
  } catch (error) {
    console.error('Impact API error:', error);
    return jsonCors({ error: 'Impact analysis failed' }, 500);
  }
}

// ── Search ──
async function handleSearchGet(searchParams: URLSearchParams): Promise<Response> {
  try {
    const q = searchParams.get('q')?.toLowerCase() || '';
    const type = searchParams.get('type');

    if (!q || q.length < 2) return jsonCors({ results: [] });

    const where: Record<string, unknown> = {
      OR: [
        { name: { contains: q } },
        { qualifiedName: { contains: q } },
        { description: { contains: q } },
        { owner: { contains: q } },
        { externalId: { contains: q } },
      ],
    };

    if (type) where.nodeType = type;

    const nodes = await db.node.findMany({ where, take: 50 });

    const results = nodes.map((n) => ({
      id: n.id, externalId: n.externalId, name: n.name, type: n.nodeType,
      platform: n.platform, qualifiedName: n.qualifiedName,
      description: n.description?.substring(0, 150), owner: n.owner, status: n.status,
    }));

    return jsonCors({ results, total: results.length });
  } catch (error) {
    console.error('Search API error:', error);
    return jsonCors({ error: 'Search failed' }, 500);
  }
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────
async function handleRequest(request: Request): Promise<Response> {
  const { pathname, searchParams } = parseUrl(request);
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') return corsOptions();

  // Route matching
  try {
    // GET /api
    if (pathname === '/api' && method === 'GET') {
      return await handleApiHealth();
    }

    // /api/charts
    if (pathname === '/api/charts') {
      if (method === 'GET') return await handleChartsGet();
      if (method === 'POST') return await handleChartsPost(await getBody(request) as Record<string, unknown>);
      if (method === 'PUT') return await handleChartsPut(await getBody(request) as Record<string, unknown>);
      if (method === 'DELETE') return await handleChartsDelete(searchParams);
    }

    // /api/dashboards
    if (pathname === '/api/dashboards') {
      if (method === 'GET') return await handleDashboardsGet();
      if (method === 'POST') return await handleDashboardsPost(await getBody(request) as Record<string, unknown>);
      if (method === 'PUT') return await handleDashboardsPut(await getBody(request) as Record<string, unknown>);
      if (method === 'DELETE') return await handleDashboardsDelete(searchParams);
    }

    // /api/connectors
    if (pathname === '/api/connectors') {
      if (method === 'GET') return await handleConnectorsGet();
      if (method === 'POST') return await handleConnectorsPost(await getBody(request) as Record<string, unknown>);
      if (method === 'DELETE') return await handleConnectorsDelete(searchParams);
    }

    // /api/connectors-test
    if (pathname === '/api/connectors-test') {
      if (method === 'POST') return await handleConnectorsTestPost(await getBody(request) as Record<string, unknown>);
    }

    // /api/datasets
    if (pathname === '/api/datasets') {
      if (method === 'GET') return await handleDatasetsGet();
      if (method === 'POST') return await handleDatasetsPost(await getBody(request) as Record<string, unknown>);
      if (method === 'PUT') return await handleDatasetsPut(await getBody(request) as Record<string, unknown>);
      if (method === 'DELETE') return await handleDatasetsDelete(searchParams);
    }

    // /api/metric-defs
    if (pathname === '/api/metric-defs') {
      if (method === 'GET') return await handleMetricDefsGet();
      if (method === 'POST') return await handleMetricDefsPost(await getBody(request) as Record<string, unknown>);
      if (method === 'PUT') return await handleMetricDefsPut(await getBody(request) as Record<string, unknown>);
      if (method === 'DELETE') return await handleMetricDefsDelete(searchParams);
    }

    // /api/transforms
    if (pathname === '/api/transforms') {
      if (method === 'GET') return await handleTransformsGet();
      if (method === 'POST') return await handleTransformsPost(await getBody(request) as Record<string, unknown>);
      if (method === 'PUT') return await handleTransformsPut(await getBody(request) as Record<string, unknown>);
      if (method === 'DELETE') return await handleTransformsDelete(searchParams);
    }

    // /api/branches
    if (pathname === '/api/branches') {
      if (method === 'GET') return await handleBranchesGet(searchParams);
      if (method === 'POST') return await handleBranchesPost(await getBody(request) as Record<string, unknown>);
    }

    // /api/merge-requests
    if (pathname === '/api/merge-requests') {
      if (method === 'GET') return await handleMergeRequestsGet();
      if (method === 'POST') return await handleMergeRequestsPost(await getBody(request) as Record<string, unknown>);
      if (method === 'PUT') return await handleMergeRequestsPut(await getBody(request) as Record<string, unknown>);
    }

    // /api/collaboration
    if (pathname === '/api/collaboration') {
      if (method === 'GET') return await handleCollaborationGet(searchParams);
      if (method === 'POST') return await handleCollaborationPost(await getBody(request) as Record<string, unknown>);
    }

    // /api/upload
    if (pathname === '/api/upload') {
      if (method === 'POST') return await handleUploadPost(request);
    }

    // /api/users
    if (pathname === '/api/users') {
      if (method === 'GET') return await handleUsersGet();
    }

    // /api/overview
    if (pathname === '/api/overview') {
      if (method === 'GET') return await handleOverviewGet();
    }

    // /api/lineage
    if (pathname === '/api/lineage') {
      if (method === 'GET') return await handleLineageGet(searchParams);
    }

    // /api/audit
    if (pathname === '/api/audit') {
      if (method === 'GET') return await handleAuditGet(searchParams);
    }

    // /api/metrics
    if (pathname === '/api/metrics') {
      if (method === 'GET') return await handleMetricsGet(searchParams);
    }

    // /api/nodes
    if (pathname === '/api/nodes') {
      if (method === 'GET') return await handleNodesGet(searchParams);
    }

    // /api/impact
    if (pathname === '/api/impact') {
      if (method === 'GET') return await handleImpactGet(searchParams);
    }

    // /api/search
    if (pathname === '/api/search') {
      if (method === 'GET') return await handleSearchGet(searchParams);
    }

    // 404 - not found
    return jsonCors({ error: 'Not found', path: pathname }, 404);
  } catch (err) {
    console.error('Unhandled route error:', err);
    return jsonCors({ error: 'Internal server error' }, 500);
  }
}

// ─────────────────────────────────────────────
// Static HTML + Asset Serving (for SPA mode)
// ─────────────────────────────────────────────
import { existsSync, readFileSync } from 'fs';

const SERVE_PORT = parseInt(process.env.PORT || '3000');
const SERVE_HOST = process.env.HOST || '0.0.0.0';
const PROJECT_DIR_S = import.meta.dir;
const INDEX_HTML_PATH = join(PROJECT_DIR_S, '.next', 'server', 'app', 'index.html');

let indexHtmlContent = '';
try {
  indexHtmlContent = readFileSync(INDEX_HTML_PATH, 'utf-8');
} catch {
  console.error('⚠️  index.html not found. Run `npx next build` first.');
}

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json',
  '.ttf': 'font/ttf',
};

function serveStatic(pathname: string): Response | null {
  let filePath: string | null = null;

  if (pathname.startsWith('/_next/static/')) {
    filePath = join(PROJECT_DIR_S, '.next', pathname.replace('/_next/', ''));
  } else if (!pathname.startsWith('/_next/') && pathname !== '/') {
    filePath = join(PROJECT_DIR_S, 'public', pathname);
  }

  if (filePath && existsSync(filePath)) {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const file = Bun.file(filePath);
    return new Response(file, { headers: { 'Content-Type': contentType } });
  }

  return null;
}

// Combined handler: API + static
async function combinedHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // API routes
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return handleRequest(request);
  }

  // Static files
  const staticResponse = serveStatic(pathname);
  if (staticResponse) return staticResponse;

  // SPA fallback - return index.html
  if (indexHtmlContent) {
    return new Response(indexHtmlContent, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }

  return new Response('Not found', { status: 404 });
}

// Start combined server on port 3000
const server = Bun.serve({
  port: SERVE_PORT,
  hostname: SERVE_HOST,
  fetch: combinedHandler,
});

console.log(`🚀 Lentera BI Platform: http://${SERVE_HOST}:${SERVE_PORT}`);
console.log(`   Database: ${DATABASE_URL}`);
console.log(`   Combined mode: API + Static HTML`);
console.log(`   Routes: /api, /api/charts, /api/dashboards, /api/connectors, /api/connectors-test, /api/datasets, /api/metric-defs, /api/transforms, /api/branches, /api/merge-requests, /api/collaboration, /api/upload, /api/users, /api/overview, /api/lineage, /api/audit, /api/metrics, /api/nodes, /api/impact, /api/search`);
