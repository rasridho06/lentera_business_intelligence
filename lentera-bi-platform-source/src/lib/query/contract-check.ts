import type { QueryResponse } from './contract';
import { db } from '@/lib/db';
import { appendAssetRevision } from '@/lib/revisions';

export interface ColumnContract {
  name: string;
  type: string;
  nullable?: boolean;
  unique?: boolean;  // ponytail: best-effort on the preview sample (≤50 rows), not the full dataset
  // ponytail: acceptedValues[] per-column is the canonical source;
  // the DatasetContract.acceptedValues top-level JSON field is read in checkContracts.
  acceptedValues?: string[];
  description?: string;
}

export interface ContractViolation {
  column: string;
  rule: string; // 'missing_column' | 'incompatible_type' | 'nullability' | 'uniqueness' | 'accepted_values' | 'stale_source'
  expected: string;
  actual: string;
}

export interface ContractCheckResult {
  passed: boolean;
  violations: ContractViolation[];
  checkedAt: string;
}

function normalizeType(t: string): string {
  return t.toLowerCase().replace(/^nullable\((.+)\)$/i, '$1');
}

export async function checkContracts(
  datasetId: string,
  response: QueryResponse,
): Promise<ContractCheckResult> {
  const contract = await db.datasetContract.findUnique({ where: { datasetId } });
  if (!contract) {
    return { passed: true, violations: [], checkedAt: new Date().toISOString() };
  }

  const columns: ColumnContract[] = JSON.parse(contract.columns as string);
  const acceptedValues: Record<string, string[]> = contract.acceptedValues ? JSON.parse(contract.acceptedValues as string) : {};
  const violations: ContractViolation[] = [];

  // ponytail: freshnessSeconds (Phase 6) — reserved schema field, not enforced yet.
  // Phase 6 scheduled refresh will compare connector.lastSyncAt vs Date.now().
  const responseColMap = new Map(response.columns.map((c) => [c.name.toLowerCase(), c]));

  for (const col of columns) {
    const actual = responseColMap.get(col.name.toLowerCase());

    if (!actual) {
      violations.push({
        column: col.name,
        rule: 'missing_column',
        expected: col.type,
        actual: 'not present',
      });
      continue;
    }

    const actualType = normalizeType(actual.type);
    const expectedType = normalizeType(col.type);
    if (actualType !== expectedType) {
      violations.push({
        column: col.name,
        rule: 'incompatible_type',
        expected: expectedType,
        actual: actualType,
      });
    }

    if (col.nullable === false && response.rows.some((r) => r[col.name] === null)) {
      violations.push({
        column: col.name,
        rule: 'nullability',
        expected: 'NOT NULL',
        actual: 'contains null',
      });
    }

    if (col.unique && response.rows.length > 0) {
      const values = response.rows.map((r) => String(r[col.name] ?? ''));
      const unique = new Set(values);
      if (unique.size !== values.length) {
        violations.push({
          column: col.name,
          rule: 'uniqueness',
          expected: 'sample values unique',
          actual: `${values.length - unique.size} duplicate(s)`,
        });
      }
    }
  }

  for (const [colName, allowed] of Object.entries(acceptedValues)) {
    const values = response.rows.map((r) => String(r[colName] ?? ''));
    for (const v of values) {
      if (v && !allowed.map((a) => a.toLowerCase()).includes(v.toLowerCase())) {
        violations.push({
          column: colName,
          rule: 'accepted_values',
          expected: allowed.join(', '),
          actual: v,
        });
        break;
      }
    }
  }

  const passed = violations.length === 0;

  await appendAssetRevision({
    assetType: 'dataset',
    assetId: datasetId,
    action: passed ? 'contract_passed' : 'contract_violated',
    after: { passed, violations },
  });

  return { passed, violations, checkedAt: new Date().toISOString() };
}

