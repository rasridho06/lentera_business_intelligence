import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createConnectorSchema, validateBody } from '@/lib/validations';
import { encrypt } from '@/lib/crypto';



function getCategory(type: string): string {
  if (['clickhouse', 'bigquery', 'snowflake', 'redshift'].includes(type)) return 'olap';
  if (['postgres', 'mysql', 'sqlite'].includes(type)) return 'oltp';
  if (['csv', 'json', 'excel', 'parquet'].includes(type)) return 'file';
  return 'oltp';
}

export async function GET() {
  try {
    const connectors = await db.connector.findMany({
      include: { tables: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(connectors.map(({ password: _, ...connector }) => connector));
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
        password: data.password ? encrypt(data.password) : null,
        schema: data.schema || null,
        filePath: data.filePath || null,
        fileConfig: data.fileConfig ? JSON.stringify(data.fileConfig) : null,
        config: data.config ? JSON.stringify(data.config) : null,
        status: 'connected',
      },
    });

    const result = await db.connector.findUnique({
      where: { id: connector.id },
      include: { tables: true },
    });
    if (!result) return NextResponse.json(null);
    const { password: _, ...responseConnector } = result;
    return NextResponse.json(responseConnector);
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
