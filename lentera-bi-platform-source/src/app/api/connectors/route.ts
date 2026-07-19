import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createConnectorSchema, validateBody } from '@/lib/validations';

// Connector type categories
const OLAP_TYPES = ['clickhouse', 'bigquery', 'snowflake', 'redshift'];
const OLTP_TYPES = ['postgres', 'mysql', 'sqlite'];
const FILE_TYPES = ['csv', 'json', 'excel', 'parquet'];

function getCategory(type: string): string {
  if (OLAP_TYPES.includes(type)) return 'olap';
  if (OLTP_TYPES.includes(type)) return 'oltp';
  if (FILE_TYPES.includes(type)) return 'file';
  return 'oltp';
}

export async function GET() {
  try {
    const connectors = await db.connector.findMany({
      include: { tables: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(connectors);
  } catch (error) {
    console.error('Connectors GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch connectors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod
    const validation = validateBody(createConnectorSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

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

    // Auto-generate demo tables for database connectors
    if (data.type === 'clickhouse') {
      const demoTables = [
        { schema: 'booking_production', name: 'reservations', type: 'table', rowCount: 2500000, columns: JSON.stringify([
          { name: 'id', type: 'UInt64', nullable: false, isPK: true },
          { name: 'user_id', type: 'UInt64', nullable: false },
          { name: 'restaurant_id', type: 'UInt64', nullable: false },
          { name: 'reservation_date', type: 'Date', nullable: false },
          { name: 'price_cents', type: 'Int32', nullable: true },
          { name: 'active', type: 'UInt8', nullable: false },
          { name: 'no_show', type: 'UInt8', nullable: false },
          { name: 'channel_id', type: 'UInt32', nullable: true },
          { name: 'created_at', type: 'DateTime', nullable: false },
        ]) },
        { schema: 'booking_production', name: 'restaurants', type: 'table', rowCount: 15000, columns: JSON.stringify([
          { name: 'id', type: 'UInt64', nullable: false, isPK: true },
          { name: 'name', type: 'String', nullable: false },
          { name: 'category', type: 'String', nullable: true },
          { name: 'city_id', type: 'UInt32', nullable: true },
          { name: 'rating', type: 'Float32', nullable: true },
        ]) },
        { schema: 'analytics', name: 'mart_booking_gmv', type: 'materialized_view', rowCount: 1200000, columns: JSON.stringify([
          { name: 'date', type: 'Date', nullable: false },
          { name: 'restaurant_id', type: 'UInt64', nullable: false },
          { name: 'gmv', type: 'Float64', nullable: true },
          { name: 'total_reservations', type: 'UInt64', nullable: true },
          { name: 'channel_name', type: 'String', nullable: true },
        ]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({
          data: { connectorId: connector.id, schema: t.schema, name: t.name, type: t.type, rowCount: t.rowCount, columns: t.columns },
        });
      }
    } else if (data.type === 'postgres') {
      const demoTables = [
        { schema: 'public', name: 'users', type: 'table', rowCount: 50000, columns: JSON.stringify([
          { name: 'id', type: 'SERIAL', nullable: false, isPK: true },
          { name: 'email', type: 'VARCHAR', nullable: false },
          { name: 'name', type: 'VARCHAR', nullable: true },
          { name: 'role', type: 'VARCHAR', nullable: true },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
        ]) },
        { schema: 'public', name: 'orders', type: 'table', rowCount: 200000, columns: JSON.stringify([
          { name: 'id', type: 'SERIAL', nullable: false, isPK: true },
          { name: 'user_id', type: 'INT', nullable: false },
          { name: 'total_amount', type: 'DECIMAL', nullable: true },
          { name: 'status', type: 'VARCHAR', nullable: false },
          { name: 'order_date', type: 'DATE', nullable: false },
        ]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({
          data: { connectorId: connector.id, schema: t.schema, name: t.name, type: t.type, rowCount: t.rowCount, columns: t.columns },
        });
      }
    } else if (data.type === 'mysql') {
      const demoTables = [
        { schema: 'shop_db', name: 'products', type: 'table', rowCount: 8000, columns: JSON.stringify([
          { name: 'id', type: 'INT', nullable: false, isPK: true },
          { name: 'name', type: 'VARCHAR(255)', nullable: false },
          { name: 'price', type: 'DECIMAL(10,2)', nullable: true },
          { name: 'stock', type: 'INT', nullable: false },
          { name: 'category_id', type: 'INT', nullable: true },
        ]) },
        { schema: 'shop_db', name: 'transactions', type: 'table', rowCount: 1200000, columns: JSON.stringify([
          { name: 'id', type: 'BIGINT', nullable: false, isPK: true },
          { name: 'product_id', type: 'INT', nullable: false },
          { name: 'quantity', type: 'INT', nullable: false },
          { name: 'total_price', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'created_at', type: 'DATETIME', nullable: false },
        ]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({
          data: { connectorId: connector.id, schema: t.schema, name: t.name, type: t.type, rowCount: t.rowCount, columns: t.columns },
        });
      }
    } else if (data.type === 'bigquery') {
      const demoTables = [
        { schema: 'analytics', name: 'events', type: 'table', rowCount: 50000000, columns: JSON.stringify([
          { name: 'event_id', type: 'STRING', nullable: false },
          { name: 'event_type', type: 'STRING', nullable: false },
          { name: 'user_id', type: 'INT64', nullable: true },
          { name: 'event_timestamp', type: 'TIMESTAMP', nullable: false },
        ]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({
          data: { connectorId: connector.id, schema: t.schema, name: t.name, type: t.type, rowCount: t.rowCount, columns: t.columns },
        });
      }
    } else if (data.type === 'snowflake') {
      const demoTables = [
        { schema: 'WAREHOUSE', name: 'DAILY_METRICS', type: 'table', rowCount: 36500, columns: JSON.stringify([
          { name: 'DATE', type: 'DATE', nullable: false },
          { name: 'METRIC_NAME', type: 'VARCHAR', nullable: false },
          { name: 'METRIC_VALUE', type: 'NUMBER(18,2)', nullable: true },
        ]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({
          data: { connectorId: connector.id, schema: t.schema, name: t.name, type: t.type, rowCount: t.rowCount, columns: t.columns },
        });
      }
    } else if (data.type === 'redshift') {
      const demoTables = [
        { schema: 'public', name: 'fact_sales', type: 'table', rowCount: 15000000, columns: JSON.stringify([
          { name: 'sale_id', type: 'BIGINT', nullable: false, isPK: true },
          { name: 'product_id', type: 'INT', nullable: false },
          { name: 'revenue', type: 'DECIMAL(12,2)', nullable: true },
          { name: 'sale_date', type: 'DATE', nullable: false },
        ]) },
      ];
      for (const t of demoTables) {
        await db.dataSourceTable.create({
          data: { connectorId: connector.id, schema: t.schema, name: t.name, type: t.type, rowCount: t.rowCount, columns: t.columns },
        });
      }
    }
    // For file-based connectors
    else if (FILE_TYPES.includes(data.type)) {
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
    return NextResponse.json(result);
  } catch (error) {
    console.error('Connector POST error:', error);
    return NextResponse.json({ error: 'Failed to create connector' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await db.dataSourceTable.deleteMany({ where: { connectorId: id } });
    await db.connector.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Connector DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete connector' }, { status: 500 });
  }
}
