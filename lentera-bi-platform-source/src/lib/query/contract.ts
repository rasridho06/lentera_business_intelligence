export type ConnectorType = 'clickhouse' | 'postgres' | 'mysql';

export type QueryLanguage = 'sql';

export interface QueryRequest {
  /** Allowlisted connectorId from the Connector model */
  connectorId: string;
  /** Read-only SQL. INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE are rejected. */
  sql: string;
  /** Optional query timeout in milliseconds (default: 30 000, max: 60 000) */
  timeout?: number;
  /** Maximum rows to return (default: 1 000, max: 10 000) */
  maxRows?: number;
  /** Maximum response bytes (default: 1 MB, max: 10 MB) */
  maxBytes?: number;
}

export interface QueryColumn {
  name: string;
  type: string;
}

export interface QueryResponse {
  rows: Record<string, unknown>[];
  columns: QueryColumn[];
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
}

export type QueryErrorCode =
  | 'UNAUTHORIZED'
  | 'CONNECTOR_NOT_FOUND'
  | 'CONNECTOR_NOT_CONNECTED'
  | 'SQL_NOT_READ_ONLY'
  | 'SQL_PARSE_ERROR'
  | 'TABLE_NOT_ALLOWED'
  | 'TIMEOUT'
  | 'ROW_LIMIT_EXCEEDED'
  | 'BYTE_LIMIT_EXCEEDED'
  | 'ADAPTER_ERROR'
  | 'UNKNOWN_TABLE'
  | 'UNKNOWN_COLUMN'
  | 'INVALID_SQL';

export interface QueryError {
  error: string;
  code: QueryErrorCode;
  detail?: string;
}

export const QUERY_DEFAULTS = {
  timeout: 30_000,
  maxTimeout: 60_000,
  maxRows: 1_000,
  maxRowsHard: 10_000,
  maxBytes: 1_048_576, // 1 MB
  maxBytesHard: 10_485_760, // 10 MB
} as const;