import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';

// ── Connector Connection Test API ──
// Tests connection to a database connector (simulated with validation)
// Returns connection status, table list, and sync status

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

// Validate connection parameters
function validateConnectionParams(params: ConnectionTestParams): { valid: boolean; error?: string } {
  if (!params.type) return { valid: false, error: 'Connector type is required' };
  if (!params.host && params.type !== 'sqlite') return { valid: false, error: 'Host is required for database connections' };
  if (!params.port && params.type !== 'sqlite') return { valid: false, error: 'Port is required for database connections' };

  const portNum = typeof params.port === 'string' ? parseInt(params.port) : params.port;
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: `Invalid port number: ${params.port}. Must be between 1 and 65535.` };
  }

  // Validate host format
  if (params.host && !/^[a-zA-Z0-9._-]+$/.test(params.host) && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(params.host)) {
    return { valid: false, error: `Invalid host format: ${params.host}` };
  }

  return { valid: true };
}

// Simulate connection test per database type
function simulateConnection(params: ConnectionTestParams): ConnectionTestResult {
  const startTime = Date.now();

  // Default ports per type
  const defaultPorts: Record<string, number> = {
    clickhouse: 9000,
    postgres: 5432,
    mysql: 3306,
    bigquery: 443,
    snowflake: 443,
    redshift: 5439,
    sqlite: 0,
  };

  const portNum = typeof params.port === 'string' ? parseInt(params.port) : params.port;
  const defaultPort = defaultPorts[params.type] || 5432;

  // Check if connection is to our "demo" endpoints
  const isDemoHost = params.host?.startsWith('demo-') || params.host === 'localhost' || params.host === '127.0.0.1';

  if (!isDemoHost) {
    return {
      success: false,
      message: `Connection refused: ${params.host}:${portNum}. Host unreachable. Use demo- prefixed hosts for testing (e.g., demo-clickhouse, demo-postgres).`,
      latency: Date.now() - startTime,
      error: 'ECONNREFUSED',
    };
  }

  // Simulate authentication failure for wrong credentials
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
    return {
      success: false,
      message: `Authentication failed for user "${params.username}". Access denied.`,
      latency: Date.now() - startTime + Math.floor(Math.random() * 50),
      error: 'EAUTH',
    };
  }

  if (expectedCreds && params.password && params.password !== expectedCreds.password && expectedCreds.password !== '') {
    return {
      success: false,
      message: `Authentication failed: invalid password for user "${params.username}".`,
      latency: Date.now() - startTime + Math.floor(Math.random() * 50),
      error: 'EAUTH',
    };
  }

  // Simulate successful connection with demo tables
  const demoTables = getDemoTables(params.type);
  const versionInfo = getVersionInfo(params.type);
  const latency = 50 + Math.floor(Math.random() * 150);

  return {
    success: true,
    message: `Successfully connected to ${params.type} at ${params.host}:${portNum}`,
    latency,
    tables: demoTables,
    version: versionInfo,
  };
}

function getDemoTables(type: string): ConnectionTestResult['tables'] {
  switch (type) {
    case 'clickhouse':
      return [
        {
          schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000,
          columns: [
            { name: 'id', type: 'UInt64', nullable: false, isPK: true },
            { name: 'user_id', type: 'UInt64', nullable: false },
            { name: 'restaurant_id', type: 'UInt64', nullable: false },
            { name: 'reservation_date', type: 'Date', nullable: false },
            { name: 'price_cents', type: 'Int32', nullable: true },
            { name: 'active', type: 'UInt8', nullable: false },
            { name: 'no_show', type: 'UInt8', nullable: false },
            { name: 'channel_id', type: 'UInt32', nullable: true },
            { name: 'created_at', type: 'DateTime', nullable: false },
          ],
        },
        {
          schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000,
          columns: [
            { name: 'id', type: 'UInt64', nullable: false, isPK: true },
            { name: 'name', type: 'String', nullable: false },
            { name: 'category', type: 'String', nullable: true },
            { name: 'city_id', type: 'UInt32', nullable: true },
            { name: 'rating', type: 'Float32', nullable: true },
          ],
        },
        {
          schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000,
          columns: [
            { name: 'date', type: 'Date', nullable: false },
            { name: 'restaurant_id', type: 'UInt64', nullable: false },
            { name: 'gmv', type: 'Float64', nullable: true },
            { name: 'total_reservations', type: 'UInt64', nullable: true },
            { name: 'channel_name', type: 'String', nullable: true },
          ],
        },
      ];

    case 'postgres':
      return [
        {
          schema: 'public', name: 'users', type: 'table', rowCount: 50000,
          columns: [
            { name: 'id', type: 'SERIAL', nullable: false, isPK: true },
            { name: 'email', type: 'VARCHAR', nullable: false },
            { name: 'name', type: 'VARCHAR', nullable: true },
            { name: 'role', type: 'VARCHAR', nullable: true },
            { name: 'created_at', type: 'TIMESTAMP', nullable: false },
          ],
        },
        {
          schema: 'public', name: 'orders', type: 'table', rowCount: 200000,
          columns: [
            { name: 'id', type: 'SERIAL', nullable: false, isPK: true },
            { name: 'user_id', type: 'INT', nullable: false },
            { name: 'total_amount', type: 'DECIMAL', nullable: true },
            { name: 'status', type: 'VARCHAR', nullable: false },
            { name: 'order_date', type: 'DATE', nullable: false },
          ],
        },
      ];

    case 'mysql':
      return [
        {
          schema: 'shop_db', name: 'products', type: 'table', rowCount: 8000,
          columns: [
            { name: 'id', type: 'INT', nullable: false, isPK: true },
            { name: 'name', type: 'VARCHAR(255)', nullable: false },
            { name: 'price', type: 'DECIMAL(10,2)', nullable: true },
            { name: 'stock', type: 'INT', nullable: false },
            { name: 'category_id', type: 'INT', nullable: true },
          ],
        },
        {
          schema: 'shop_db', name: 'transactions', type: 'table', rowCount: 1200000,
          columns: [
            { name: 'id', type: 'BIGINT', nullable: false, isPK: true },
            { name: 'product_id', type: 'INT', nullable: false },
            { name: 'quantity', type: 'INT', nullable: false },
            { name: 'total_price', type: 'DECIMAL(10,2)', nullable: false },
            { name: 'created_at', type: 'DATETIME', nullable: false },
          ],
        },
      ];

    case 'bigquery':
      return [
        {
          schema: 'analytics', name: 'events', type: 'table', rowCount: 50000000,
          columns: [
            { name: 'event_id', type: 'STRING', nullable: false },
            { name: 'event_type', type: 'STRING', nullable: false },
            { name: 'user_id', type: 'INT64', nullable: true },
            { name: 'event_timestamp', type: 'TIMESTAMP', nullable: false },
            { name: 'payload', type: 'JSON', nullable: true },
          ],
        },
      ];

    case 'snowflake':
      return [
        {
          schema: 'WAREHOUSE', name: 'DAILY_METRICS', type: 'table', rowCount: 36500,
          columns: [
            { name: 'DATE', type: 'DATE', nullable: false },
            { name: 'METRIC_NAME', type: 'VARCHAR', nullable: false },
            { name: 'METRIC_VALUE', type: 'NUMBER(18,2)', nullable: true },
            { name: 'DIMENSION_KEY', type: 'VARCHAR', nullable: true },
          ],
        },
      ];

    case 'redshift':
      return [
        {
          schema: 'public', name: 'fact_sales', type: 'table', rowCount: 15000000,
          columns: [
            { name: 'sale_id', type: 'BIGINT', nullable: false, isPK: true },
            { name: 'product_id', type: 'INT', nullable: false },
            { name: 'revenue', type: 'DECIMAL(12,2)', nullable: true },
            { name: 'sale_date', type: 'DATE', nullable: false },
          ],
        },
      ];

    default:
      return [];
  }
}

function getVersionInfo(type: string): string {
  const versions: Record<string, string> = {
    clickhouse: 'ClickHouse 24.8.4.13',
    postgres: 'PostgreSQL 16.2',
    mysql: 'MySQL 8.4.2',
    bigquery: 'BigQuery API v2',
    snowflake: 'Snowflake 8.19.1',
    redshift: 'Redshift 1.0.54862',
    sqlite: 'SQLite 3.45.1',
  };
  return versions[type] || 'Unknown';
}

// POST: Test connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let params: ConnectionTestParams & { connectorId?: string } = body;

    if (params.connectorId) {
      const connector = await db.connector.findUnique({ where: { id: params.connectorId } });
      if (!connector) return NextResponse.json({ success: false, error: 'Connector not found' }, { status: 404 });
      params = {
        ...params,
        type: connector.type,
        host: connector.host || '',
        port: connector.port || 0,
        username: connector.username || '',
        password: connector.password ? decrypt(connector.password) : '',
        database: connector.database || '',
        schema: connector.schema || undefined,
      };
    }

    // Validate params
    const validation = validateConnectionParams(params);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    // Simulate connection test
    const result = simulateConnection(params);

    if (result.success) {
      // If connector ID provided, also sync tables to the database
      if (params.connectorId) {
        const connectorId = params.connectorId;

        // Update connector status
        await db.connector.update({
          where: { id: connectorId },
          data: { status: 'connected', lastSyncAt: new Date() },
        });

        // Sync tables
        if (result.tables && result.tables.length > 0) {
          // Remove existing tables
          await db.dataSourceTable.deleteMany({ where: { connectorId } });

          // Create new tables with columns
          for (const table of result.tables) {
            await db.dataSourceTable.create({
              data: {
                connectorId,
                schema: table.schema,
                name: table.name,
                type: table.type,
                rowCount: table.rowCount,
                columns: JSON.stringify(table.columns),
              },
            });
          }
        }

        // Return updated connector with tables
        const updatedConnector = await db.connector.findUnique({
          where: { id: connectorId },
          include: { tables: true },
        });

        const { password: _, ...safeConnector } = updatedConnector || {};
        return NextResponse.json({
          ...result,
          synced: true,
          tableCount: result.tables?.length || 0,
          connector: safeConnector,
        });
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json({
      success: false,
      message: 'Connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
