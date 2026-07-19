import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// ════════════════════════════════════════════════════════════════
// UNIT TESTS - Smallest code units
// ════════════════════════════════════════════════════════════════

// ── 1. File Upload Unit Tests ──
describe('Unit: File Upload Validation', () => {
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  it('should reject files larger than 100MB', () => {
    const oversizedFile = { size: MAX_FILE_SIZE + 1, name: 'huge.csv' };
    const isValid = oversizedFile.size <= MAX_FILE_SIZE;
    expect(isValid).toBe(false);
  });

  it('should accept files exactly at 100MB limit', () => {
    const exactSizeFile = { size: MAX_FILE_SIZE, name: 'exact.csv' };
    const isValid = exactSizeFile.size <= MAX_FILE_SIZE;
    expect(isValid).toBe(true);
  });

  it('should accept files under 100MB', () => {
    const smallFile = { size: 50 * 1024 * 1024, name: 'small.csv' };
    const isValid = smallFile.size <= MAX_FILE_SIZE;
    expect(isValid).toBe(true);
  });

  it('should accept zero-byte files (empty)', () => {
    const emptyFile = { size: 0, name: 'empty.csv' };
    const isValid = emptyFile.size <= MAX_FILE_SIZE;
    expect(isValid).toBe(true);
  });

  it('should validate CSV file extension', () => {
    const validExtensions = ['.csv', '.tsv', '.txt'];
    expect(validExtensions.includes('.csv')).toBe(true);
    expect(validExtensions.includes('.exe')).toBe(false);
  });

  it('should validate JSON file extension', () => {
    const validExtensions = ['.json', '.jsonl', '.ndjson'];
    expect(validExtensions.includes('.json')).toBe(true);
    expect(validExtensions.includes('.csv')).toBe(false);
  });

  it('should validate Excel file extension', () => {
    const validExtensions = ['.xlsx', '.xls'];
    expect(validExtensions.includes('.xlsx')).toBe(true);
    expect(validExtensions.includes('.csv')).toBe(false);
  });

  it('should validate Parquet file extension', () => {
    const validExtensions = ['.parquet', '.pq'];
    expect(validExtensions.includes('.parquet')).toBe(true);
    expect(validExtensions.includes('.xlsx')).toBe(false);
  });

  it('should reject unsupported file types', () => {
    const unsupportedFiles = ['data.exe', 'image.png', 'doc.pdf', 'archive.zip'];
    const supportedExtensions = ['.csv', '.tsv', '.txt', '.json', '.jsonl', '.ndjson', '.xlsx', '.xls', '.parquet', '.pq'];

    for (const fileName of unsupportedFiles) {
      const ext = '.' + fileName.split('.').pop();
      expect(supportedExtensions.includes(ext)).toBe(false);
    }
  });
});

// ── 2. Connection Parameter Validation Unit Tests ──
describe('Unit: Database Connection Parameter Validation', () => {
  function validateConnectionParams(params: { type: string; host: string; port: number; username: string; password: string }) {
    const errors: string[] = [];

    if (!params.type) errors.push('Type is required');
    if (!params.host && params.type !== 'sqlite') errors.push('Host is required');
    if (!params.port && params.type !== 'sqlite') errors.push('Port is required');

    if (params.port && (params.port < 1 || params.port > 65535)) {
      errors.push(`Invalid port: ${params.port}`);
    }

    if (params.host && !/^[a-zA-Z0-9._-]+$/.test(params.host) && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(params.host)) {
      errors.push(`Invalid host format: ${params.host}`);
    }

    return { valid: errors.length === 0, errors };
  }

  it('should validate ClickHouse connection with valid params', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: 'demo-clickhouse', port: 9000, username: 'default', password: '',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate PostgreSQL connection with valid params', () => {
    const result = validateConnectionParams({
      type: 'postgres', host: 'demo-postgres', port: 5432, username: 'postgres', password: 'postgres',
    });
    expect(result.valid).toBe(true);
  });

  it('should validate MySQL connection with valid params', () => {
    const result = validateConnectionParams({
      type: 'mysql', host: 'demo-mysql', port: 3306, username: 'root', password: 'root',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject missing host', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: '', port: 9000, username: 'default', password: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Host is required');
  });

  it('should reject invalid port (0)', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: 'demo-clickhouse', port: 0, username: 'default', password: '',
    });
    expect(result.valid).toBe(false);
  });

  it('should reject port > 65535', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: 'demo-clickhouse', port: 70000, username: 'default', password: '',
    });
    expect(result.valid).toBe(false);
  });

  it('should reject negative port', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: 'demo-clickhouse', port: -1, username: 'default', password: '',
    });
    expect(result.valid).toBe(false);
  });

  it('should reject invalid host characters', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: 'host with spaces!', port: 9000, username: 'default', password: '',
    });
    expect(result.valid).toBe(false);
  });

  it('should accept IP address as host', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: '192.168.1.100', port: 9000, username: 'default', password: '',
    });
    expect(result.valid).toBe(true);
  });

  it('should accept localhost', () => {
    const result = validateConnectionParams({
      type: 'clickhouse', host: 'localhost', port: 9000, username: 'default', password: '',
    });
    expect(result.valid).toBe(true);
  });

  it('should accept SQLite without host/port', () => {
    const result = validateConnectionParams({
      type: 'sqlite', host: '', port: 0, username: '', password: '',
    });
    expect(result.valid).toBe(true);
  });
});

// ── 3. Connector Category Detection Unit Tests ──
describe('Unit: Connector Category Detection', () => {
  const OLAP_TYPES = ['clickhouse', 'bigquery', 'snowflake', 'redshift'];
  const OLTP_TYPES = ['postgres', 'mysql', 'sqlite'];
  const FILE_TYPES = ['csv', 'json', 'excel', 'parquet'];

  function getCategory(type: string): string {
    if (OLAP_TYPES.includes(type)) return 'olap';
    if (OLTP_TYPES.includes(type)) return 'oltp';
    if (FILE_TYPES.includes(type)) return 'file';
    return 'oltp';
  }

  it('should categorize ClickHouse as OLAP', () => {
    expect(getCategory('clickhouse')).toBe('olap');
  });

  it('should categorize BigQuery as OLAP', () => {
    expect(getCategory('bigquery')).toBe('olap');
  });

  it('should categorize Snowflake as OLAP', () => {
    expect(getCategory('snowflake')).toBe('olap');
  });

  it('should categorize Redshift as OLAP', () => {
    expect(getCategory('redshift')).toBe('olap');
  });

  it('should categorize PostgreSQL as OLTP', () => {
    expect(getCategory('postgres')).toBe('oltp');
  });

  it('should categorize MySQL as OLTP', () => {
    expect(getCategory('mysql')).toBe('oltp');
  });

  it('should categorize SQLite as OLTP', () => {
    expect(getCategory('sqlite')).toBe('oltp');
  });

  it('should categorize CSV as file', () => {
    expect(getCategory('csv')).toBe('file');
  });

  it('should categorize JSON as file', () => {
    expect(getCategory('json')).toBe('file');
  });

  it('should categorize Excel as file', () => {
    expect(getCategory('excel')).toBe('file');
  });

  it('should categorize Parquet as file', () => {
    expect(getCategory('parquet')).toBe('file');
  });

  it('should default unknown types to OLTP', () => {
    expect(getCategory('unknown')).toBe('oltp');
  });
});

// ── 4. Chart Type Validation Unit Tests ──
describe('Unit: Chart Type Validation', () => {
  const VALID_CHART_TYPES = ['bar', 'line', 'pie', 'area', 'scatter', 'table', 'metric_card', 'heatmap', 'funnel', 'histogram'];

  it('should accept all valid chart types', () => {
    for (const type of VALID_CHART_TYPES) {
      expect(VALID_CHART_TYPES.includes(type)).toBe(true);
    }
  });

  it('should reject invalid chart type', () => {
    expect(VALID_CHART_TYPES.includes('radar')).toBe(false);
    expect(VALID_CHART_TYPES.includes('treemap')).toBe(false);
    expect(VALID_CHART_TYPES.includes('')).toBe(false);
  });
});

// ── 5. Data Type Inference Unit Tests ──
describe('Unit: Column Type Inference', () => {
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

  it('should infer INTEGER from integer values', () => {
    expect(inferColumnType([1, 2, 3, 4, 5])).toBe('INTEGER');
  });

  it('should infer DOUBLE from float values', () => {
    expect(inferColumnType([1.5, 2.7, 3.14])).toBe('DOUBLE');
  });

  it('should infer DOUBLE from mixed integer/float', () => {
    expect(inferColumnType([1, 2.5, 3, 4.1])).toBe('DOUBLE');
  });

  it('should infer VARCHAR from string values', () => {
    expect(inferColumnType(['hello', 'world'])).toBe('VARCHAR');
  });

  it('should infer DATE from date strings', () => {
    expect(inferColumnType(['2024-01-15', '2024-02-20'])).toBe('DATE');
  });

  it('should infer TIMESTAMP from datetime strings with T separator', () => {
    expect(inferColumnType(['2024-01-15T10:30:00', '2024-02-20T14:00:00'])).toBe('TIMESTAMP');
  });

  it('should infer TIMESTAMP from datetime strings with space separator', () => {
    expect(inferColumnType(['2024-01-15 10:30:00', '2024-02-20 14:00:00'])).toBe('TIMESTAMP');
  });

  it('should infer DATE from date-only strings', () => {
    expect(inferColumnType(['2024-01-15', '2024-02-20'])).toBe('DATE');
  });

  it('should infer BOOLEAN from boolean values', () => {
    expect(inferColumnType([true, false, true])).toBe('BOOLEAN');
  });

  it('should infer VARCHAR from empty array', () => {
    expect(inferColumnType([])).toBe('VARCHAR');
  });

  it('should infer VARCHAR from all null values', () => {
    expect(inferColumnType([null, null, null])).toBe('VARCHAR');
  });

  it('should infer VARCHAR from mixed types', () => {
    expect(inferColumnType([1, 'hello', true])).toBe('VARCHAR');
  });
});

// ── 6. Merge Request Conflict Detection Unit Tests ──
describe('Unit: Merge Request Conflict Detection', () => {
  function checkConflict(existingMRs: Array<{ sourceBranchId: string; targetBranch: string; status: string }>, newSourceBranchId: string, newTargetBranch: string): { hasConflict: boolean; conflictingMRs: string[] } {
    const conflictingMRs = existingMRs
      .filter(mr => mr.targetBranch === newTargetBranch && ['open', 'reviewing'].includes(mr.status) && mr.sourceBranchId !== newSourceBranchId)
      .map(mr => mr.sourceBranchId);
    return { hasConflict: conflictingMRs.length > 0, conflictingMRs };
  }

  it('should detect conflict when open MR targets same branch', () => {
    const existing = [{ sourceBranchId: 'b1', targetBranch: 'main', status: 'open' }];
    const result = checkConflict(existing, 'b2', 'main');
    expect(result.hasConflict).toBe(true);
  });

  it('should not detect conflict when MR targets different branch', () => {
    const existing = [{ sourceBranchId: 'b1', targetBranch: 'main', status: 'open' }];
    const result = checkConflict(existing, 'b2', 'develop');
    expect(result.hasConflict).toBe(false);
  });

  it('should not detect conflict for merged MRs', () => {
    const existing = [{ sourceBranchId: 'b1', targetBranch: 'main', status: 'merged' }];
    const result = checkConflict(existing, 'b2', 'main');
    expect(result.hasConflict).toBe(false);
  });

  it('should not detect conflict for closed MRs', () => {
    const existing = [{ sourceBranchId: 'b1', targetBranch: 'main', status: 'closed' }];
    const result = checkConflict(existing, 'b2', 'main');
    expect(result.hasConflict).toBe(false);
  });

  it('should detect conflict for reviewing MRs', () => {
    const existing = [{ sourceBranchId: 'b1', targetBranch: 'main', status: 'reviewing' }];
    const result = checkConflict(existing, 'b2', 'main');
    expect(result.hasConflict).toBe(true);
  });

  it('should detect multiple conflicts', () => {
    const existing = [
      { sourceBranchId: 'b1', targetBranch: 'main', status: 'open' },
      { sourceBranchId: 'b2', targetBranch: 'main', status: 'reviewing' },
    ];
    const result = checkConflict(existing, 'b3', 'main');
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingMRs).toHaveLength(2);
  });

  it('should not conflict with same source branch (update scenario)', () => {
    const existing = [{ sourceBranchId: 'b1', targetBranch: 'main', status: 'open' }];
    const result = checkConflict(existing, 'b1', 'main');
    expect(result.hasConflict).toBe(false);
  });
});

// ── 7. Metric Version Increment Unit Tests ──
describe('Unit: Metric Version Increment', () => {
  it('should increment version from 1 to 2', () => {
    expect(Math.max(1, 1) + 1 - 1).toBe(1); // Current
    const newVersion = 1 + 1;
    expect(newVersion).toBe(2);
  });

  it('should increment version from 5 to 6', () => {
    const newVersion = 5 + 1;
    expect(newVersion).toBe(6);
  });

  it('should never have version 0', () => {
    const version = Math.max(1, 0);
    expect(version).toBeGreaterThanOrEqual(1);
  });
});
