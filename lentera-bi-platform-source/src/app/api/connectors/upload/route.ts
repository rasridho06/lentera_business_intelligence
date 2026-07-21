import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { ingestFile, type SupportedFormat } from '@/lib/ingest/duckdb';
import { appendAssetRevision } from '@/lib/revisions';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './upload';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT: Record<string, SupportedFormat> = {
  '.csv': 'csv', '.tsv': 'tsv', '.txt': 'csv',
  '.json': 'json',
};
const ALLOWED_MIME: Record<string, SupportedFormat> = {
  'text/csv': 'csv', 'text/tab-separated-values': 'tsv',
  'application/json': 'json',
};

function detectFormat(filename: string, mimeType: string): SupportedFormat | null {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
  if (ALLOWED_EXT[ext]) return ALLOWED_EXT[ext];
  if (ALLOWED_MIME[mimeType]) return ALLOWED_MIME[mimeType];
  return null;
}

export async function POST(request: NextRequest) {
  let filePath = '';
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const connectorId = form.get('connectorId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit.` }, { status: 413 });
    if (!file.name) return NextResponse.json({ error: 'File has no name.' }, { status: 400 });

    const format = detectFormat(file.name, file.type);
    if (!format) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || file.name}. Supported: CSV, TSV, JSON.` }, { status: 415 });
    }

    // Save to a generated path under upload/
    await mkdir(UPLOAD_DIR, { recursive: true });
    const uploadId = randomUUID();
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
    filePath = join(UPLOAD_DIR, `${uploadId}${ext}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buf);

    // Ingest via DuckDB
    const tableName = `import_${uploadId.replace(/-/g, '_')}`;
    const result = await ingestFile({ filePath, format, tableName, maxRows: 50_000 });

    // Create connector record (file-type)
    const connector = await db.connector.create({
      data: {
        name: file.name,
        type: format,
        category: 'file',
        filePath,
        fileConfig: JSON.stringify({ uploadId, format, originalName: file.name, size: file.size }),
        status: 'connected',
        tables: { create: [{
          schema: result.schema,
          name: result.tableName,
          type: 'table',
          rowCount: result.rowCount,
          columns: JSON.stringify(result.columns),
        }] },
      },
    });

    await appendAssetRevision({
      assetType: 'connector',
      assetId: connector.id,
      action: 'create',
      after: { name: file.name, type: format, rowCount: result.rowCount, columns: result.columns.length },
    });

    return NextResponse.json({
      success: true,
      connector: { id: connector.id, name: connector.name, type: connector.type },
      table: { name: result.tableName, rowCount: result.rowCount, columns: result.columns },
      sample: result.sample,
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up uploaded file on failure.
    if (filePath) await unlink(filePath).catch(() => {});
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 });
  }
}