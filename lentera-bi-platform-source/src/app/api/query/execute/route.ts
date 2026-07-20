import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { validateQuery } from '@/lib/query/sql-validator';
import { executeClickHouseQuery } from '@/lib/query/clickhouse';
import type { QueryError, QueryRequest } from '@/lib/query/contract';
import { QUERY_DEFAULTS } from '@/lib/query/contract';

const SUPPORTED_TYPES = new Set(['clickhouse', 'postgres', 'mysql']);

function errorResponse(status: number, code: QueryError['code'], detail?: string) {
  const body: QueryError = { error: code, code, detail };
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const start = performance.now();

  let body: QueryRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'INVALID_SQL', 'Request body must be valid JSON with connectorId and sql fields.');
  }

  const { connectorId, sql } = body;
  if (!connectorId || !sql) {
    return errorResponse(400, 'INVALID_SQL', 'connectorId and sql are required.');
  }

  const timeout = Math.min(body.timeout ?? QUERY_DEFAULTS.timeout, QUERY_DEFAULTS.maxTimeout);
  const maxRows = Math.min(body.maxRows ?? QUERY_DEFAULTS.maxRows, QUERY_DEFAULTS.maxRowsHard);
  const maxBytes = Math.min(body.maxBytes ?? QUERY_DEFAULTS.maxBytes, QUERY_DEFAULTS.maxBytesHard);

  // ── Resolve connector ──
  const connector = await db.connector.findUnique({
    where: { id: connectorId },
    include: { tables: true },
  });

  if (!connector) {
    return errorResponse(404, 'CONNECTOR_NOT_FOUND', `No connector with id "${connectorId}".`);
  }

  if (!SUPPORTED_TYPES.has(connector.type)) {
    return errorResponse(400, 'CONNECTOR_NOT_CONNECTED', `Connector type "${connector.type}" is not supported by the query plane. Supported: ${[...SUPPORTED_TYPES].join(', ')}.`);
  }

  if (connector.status !== 'connected') {
    return errorResponse(400, 'CONNECTOR_NOT_CONNECTED', `Connector "${connector.name}" is not connected. Run a connection test first.`);
  }

  // ── Build table allowlist from DataSourceTable rows ──
  const allowedTables = connector.tables.map((t) => t.name);

  // ── Validate SQL ──
  const validation = validateQuery(sql, allowedTables);
  if (!validation.valid) {
    return errorResponse(400, validation.errorCode!, validation.errorDetail);
  }

  // ── Execute ──
  try {
    const connectorCredentials = {
      host: connector.host!,
      port: connector.port!,
      database: connector.database!,
      username: connector.username!,
      password: connector.password!, // ponytail: plaintext until encryption is implemented (Phase 5 hardening)
    };

    const result = await executeClickHouseQuery({
      sql,
      connector: connectorCredentials,
      timeout,
      maxRows,
      maxBytes,
    });

    return NextResponse.json({
      ...result,
      elapsedMs: Math.round(performance.now() - start),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('BYTE_LIMIT_EXCEEDED')) {
      return errorResponse(413, 'BYTE_LIMIT_EXCEEDED', 'Query result exceeds the configured byte limit.');
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return errorResponse(408, 'TIMEOUT', `Query exceeded the ${timeout}ms timeout.`);
    }
    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
      return errorResponse(502, 'ADAPTER_ERROR', `Cannot reach ${connector.host}:${connector.port}.`);
    }

    return errorResponse(500, 'ADAPTER_ERROR', message.slice(0, 1000));
  }
}