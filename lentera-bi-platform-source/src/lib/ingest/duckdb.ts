// ponytail: file ingestion via PapaParse for CSV/TSV and manual JSON parse.
// Stores schema, row count, and sample in the DataSourceTable model.
// Upgrade path: DuckDB native for Parquet, larger files, streaming.

import { readFile } from 'node:fs/promises';
import type { QueryColumn } from '@/lib/query/contract';

export type SupportedFormat = 'csv' | 'tsv' | 'json';

export interface IngestResult {
  columns: QueryColumn[];
  rowCount: number;
  schema: string;
  tableName: string;
  sample: Record<string, unknown>[];
}

export interface IngestOptions {
  filePath: string;
  format: SupportedFormat;
  tableName?: string;
  maxRows?: number;
}

function inferType(values: unknown[]): string {
  const sample = values.filter((v) => v !== null && v !== undefined && v !== '').slice(0, 100);
  if (sample.length === 0) return 'String';
  const allNum = sample.every((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== ''));
  if (allNum) {
    const allInt = sample.every((v) => Number(v) === Math.floor(Number(v)));
    return allInt ? 'Int64' : 'Float64';
  }
  return 'String';
}

export async function ingestFile(opts: IngestOptions): Promise<IngestResult> {
  const { filePath, format, tableName = 'imported_data', maxRows = 50_000 } = opts;
  const raw = await readFile(filePath, 'utf-8');
  let rows: Record<string, unknown>[] = [];
  let headers: string[] = [];

  if (format === 'csv' || format === 'tsv') {
    const Papa = await import('papaparse');
    const result = Papa.parse(raw, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      delimiter: format === 'tsv' ? '\t' : undefined,
    });
    if (result.errors.length > 0) throw new Error(`Parse error: ${result.errors[0].message}`);
    headers = result.meta.fields || [];
    rows = (result.data as Record<string, unknown>[]).slice(0, maxRows);
  } else if (format === 'json') {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    if (arr.length === 0) throw new Error('Empty JSON array');
    headers = Object.keys(arr[0]);
    rows = arr.slice(0, maxRows) as Record<string, unknown>[];
  }

  if (headers.length === 0) throw new Error('No columns detected');

  const columns: QueryColumn[] = headers.map((h) => {
    const vals = rows.map((r) => r[h]);
    return { name: h, type: inferType(vals) };
  });

  return {
    columns,
    rowCount: rows.length,
    schema: 'uploaded',
    tableName,
    sample: rows.slice(0, 5),
  };
}