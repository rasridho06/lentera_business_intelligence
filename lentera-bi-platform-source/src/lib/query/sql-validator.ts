// ponytail: simple keyword-based read-only check + table extraction via regex.
// Upgrade path: sqlglot or a proper SQL parser if column-precise lineage is needed.

const READONLY_LEAD = /^\s*(SELECT|WITH|EXPLAIN|DESCRIBE|SHOW)\b/i;
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;
// Extract quoted identifiers after FROM and JOIN clauses.
const TABLE_RE = /(?:FROM|JOIN)\s+["'`]?(\w+\.?\w*)["'`]?/gi;

export function isReadOnlySQL(sql: string): boolean {
  return READONLY_LEAD.test(sql) && !FORBIDDEN.test(sql);
}

export function extractTableRefs(sql: string): string[] {
  const refs = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = TABLE_RE.exec(sql)) !== null) {
    const raw = match[1].toLowerCase();
    // Normalise "schema.table" → strip schema for allowlist matching.
    const parts = raw.split('.');
    refs.add(parts.length > 1 ? parts[1] : parts[0]);
  }
  return [...refs];
}

export interface ValidationResult {
  valid: boolean;
  errorCode?: 'SQL_NOT_READ_ONLY' | 'TABLE_NOT_ALLOWED';
  errorDetail?: string;
  tableRefs: string[];
}

export function validateQuery(sql: string, allowedTables: string[]): ValidationResult {
  if (!isReadOnlySQL(sql)) {
    return {
      valid: false,
      errorCode: 'SQL_NOT_READ_ONLY',
      errorDetail: 'Only SELECT, WITH, EXPLAIN, DESCRIBE, and SHOW statements are allowed.',
      tableRefs: [],
    };
  }

  const tables = extractTableRefs(sql);
  const lowerAllowed = allowedTables.map((t) => t.toLowerCase());

  for (const tbl of tables) {
    if (!lowerAllowed.includes(tbl)) {
      return {
        valid: false,
        errorCode: 'TABLE_NOT_ALLOWED',
        errorDetail: `Table "${tbl}" is not in the connector allowlist. Allowed: ${allowedTables.join(', ')}`,
        tableRefs: tables,
      };
    }
  }

  return { valid: true, tableRefs: tables };
}