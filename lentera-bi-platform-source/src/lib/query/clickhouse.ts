// ponytail: ClickHouse native HTTP interface (port 8123) — no client library dep.
// Upgrade path: @clickhouse/client if connection pooling or native protocol is needed.

import type { QueryColumn, QueryResponse } from './contract';

interface ClickHouseConnector {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface ExecuteOptions {
  sql: string;
  connector: ClickHouseConnector;
  timeout: number;
  maxRows: number;
  maxBytes: number;
}

function buildUrl(connector: ClickHouseConnector): string {
  const { host, port, database } = connector;
  return `http://${host}:${port || 8123}/?database=${encodeURIComponent(database)}`;
}

function buildAuthHeader(connector: ClickHouseConnector): string {
  return `Basic ${Buffer.from(`${connector.username}:${connector.password}`).toString('base64')}`;
}

function parseTSV(tsv: string): { columns: QueryColumn[]; rows: unknown[][] } {
  const lines = tsv.trim().split('\n');
  if (lines.length === 0) return { columns: [], rows: [] };
  // ClickHouse TSV with names: first line = column names, second line = types, rest = data.
  // Without names: just data rows.
  // We request FORMAT TabSeparatedWithNamesAndTypes for full schema.
  // But TabSeparatedWithNamesAndTypes emits: header1\t...\n type1\t...\n data...
  const headers = lines[0].split('\t');
  const types = lines.length > 1 ? lines[1].split('\t') : [];
  const dataRows = lines.slice(2).map((line) => line.split('\t'));

  const columns: QueryColumn[] = headers.map((name, i) => ({
    name,
    type: types[i] ?? 'String',
  }));

  return { columns, rows: dataRows };
}

export async function executeClickHouseQuery(opts: ExecuteOptions): Promise<QueryResponse> {
  const { sql, connector, timeout, maxRows, maxBytes } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const url = buildUrl(connector);
    const querySql = `${sql} FORMAT TabSeparatedWithNamesAndTypes LIMIT ${maxRows}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': buildAuthHeader(connector),
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: querySql,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`ClickHouse HTTP ${res.status}: ${errBody.slice(0, 500)}`);
    }

    const text = await res.text();
    if (Buffer.byteLength(text) > maxBytes) {
      throw Object.assign(new Error('Response exceeds byte limit'), { code: 'BYTE_LIMIT_EXCEEDED' });
    }

    const { columns, rows: rawRows } = parseTSV(text);
    const rows = rawRows.map((row) =>
      Object.fromEntries(columns.map((col, i) => [col.name, row[i] ?? null]))
    );

    return {
      rows,
      columns,
      rowCount: rows.length,
      truncated: rows.length >= maxRows,
      elapsedMs: 0, // filled by caller
    };
  } finally {
    clearTimeout(timer);
  }
}