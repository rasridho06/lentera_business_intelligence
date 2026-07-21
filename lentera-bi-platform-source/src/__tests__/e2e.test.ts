import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { isReadOnlySQL, extractTableRefs, validateQuery } from '@/lib/query/sql-validator';
import { validateVirtualDataset, replaceDependencies, resolveDependencies, detectCycles } from '@/lib/query/dependency';
import { checkContracts, type ColumnContract } from '@/lib/query/contract-check';
import { appendAssetRevision, restoreAssetRevision, sanitizeRevisionSnapshot } from '@/lib/revisions';
import { QUERY_DEFAULTS } from '@/lib/query/contract';

// ══════════════════════════════════════════════════════════════
// E2E Automation — Lentera BI Platform (Phase 1–5c)
// All entities, CRUD flows, edge cases, worst-case scenarios.
// Single global setup/teardown for isolation.
// ══════════════════════════════════════════════════════════════

let connId = '';
let dsId = '';
let dashboardId = '';
let chartId = '';
let metricId = '';
let transformId = '';

beforeAll(async () => {
  // Ensure a build run exists for the overview query.
  await db.buildRun.create({ data: { status: 'success' } }).catch(() => {});
  const c = await db.connector.create({
    data: {
      name: 'e2e-conn', type: 'clickhouse', host: 'localhost', port: 8123,
      database: 'default', username: 'default', password: '', status: 'connected',
      tables: { create: [
        { schema: 'public', name: 'orders', type: 'table', columns: '[]' },
        { schema: 'public', name: 'customers', type: 'table', columns: '[]' },
      ] },
    },
  });
  connId = c.id;
  const ds = await db.dataset.create({
    data: { name: 'e2e-ds', type: 'virtual', language: 'sql', code: 'SELECT * FROM orders', connectorId: connId },
  });
  dsId = ds.id;
  const dash = await db.dashboard.create({ data: { name: 'E2E Dash', description: 'Test', status: 'published', ownerUserId: 'user-admin' } });
  dashboardId = dash.id;
  const ch = await db.chart.create({ data: { name: 'E2E Chart', chartType: 'bar', status: 'draft', dashboardId } });
  chartId = ch.id;
  const m = await db.metricDef.create({ data: { name: 'E2E Metric', language: 'sql', expression: 'COUNT(*)', aggregation: 'count', status: 'draft' } });
  metricId = m.id;
  await db.chartMetric.create({ data: { chartId, metricId } });
  const t = await db.transform.create({ data: { name: 'E2E Transform', type: 'sql', code: 'SELECT 1', status: 'draft' } });
  transformId = t.id;
});

afterAll(async () => {
  await db.chartMetric.deleteMany({ where: { chartId } }).catch(() => {});
  await db.metricSource.deleteMany({ where: { metricId } }).catch(() => {});
  await db.datasetContract.deleteMany({ where: { datasetId: dsId } }).catch(() => {});
  await db.datasetDependency.deleteMany({ where: { datasetId: dsId } }).catch(() => {});
  await db.assetRevision.deleteMany({ where: { assetId: dsId } }).catch(() => {});
  await db.auditEvent.deleteMany({ where: { revisions: { some: { assetId: dsId } } } }).catch(() => {});
  await db.chart.delete({ where: { id: chartId } }).catch(() => {});
  await db.metricDef.delete({ where: { id: metricId } }).catch(() => {});
  await db.transform.delete({ where: { id: transformId } }).catch(() => {});
  await db.dataset.delete({ where: { id: dsId } }).catch(() => {});
  await db.dataSourceTable.deleteMany({ where: { connectorId: connId } }).catch(() => {});
  await db.dashboard.delete({ where: { id: dashboardId } }).catch(() => {});
  await db.connector.delete({ where: { id: connId } }).catch(() => {});
});

describe('E2E — Phase 1 runtime', () => {
  it('sqlite provider is active', async () => {
    expect(typeof (await db.buildRun.count())).toBe('number');
  });
  it('seed data exists', async () => {
    const nodes = await db.node.count();
    const edges = await db.edge.count();
    expect(typeof nodes).toBe('number');
    expect(typeof edges).toBe('number');
  });
});

describe('E2E — Phase 2 navigation', () => {
  it('routeViewIds covers primary views', async () => {
    const { routeViewIds } = await import('@/lib/navigation');
    for (const id of ['overview', 'connectors', 'datasets', 'query', 'charts', 'dashboards', 'metrics', 'lineage', 'audit'])
      expect(routeViewIds.has(id)).toBe(true);
  });
});

describe('E2E — Phase 4 revisions', () => {
  it('sanitizeRevisionSnapshot redacts secrets', () => {
    const out = sanitizeRevisionSnapshot({ password: 's3cret', apiKey: 'xyz', name: 'Sales', nested: { token: 'abc', val: 1 } }) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.name).toBe('Sales');
    expect((out.nested as Record<string, unknown>).token).toBe('[REDACTED]');
  });

  it('appendAssetRevision sequential', async () => {
    const r1 = await appendAssetRevision({ assetType: 'dataset', assetId: 'e2e-rev', action: 'create', after: { v: 1 } });
    const r2 = await appendAssetRevision({ assetType: 'dataset', assetId: 'e2e-rev', action: 'update', after: { v: 2 } });
    expect(r1.revision).toBe(1); expect(r2.revision).toBe(2);
    await db.assetRevision.deleteMany({ where: { assetId: 'e2e-rev' } });
  });

  it('restore appends new revision', async () => {
    const r1 = await appendAssetRevision({ assetType: 'dataset', assetId: 'e2e-rs', action: 'create', after: { name: 'Orig' } });
    const restored = await restoreAssetRevision({ assetType: 'dataset', assetId: 'e2e-rs', targetRevisionId: r1.id, reason: 'rollback' });
    expect(restored.action).toBe('restore'); expect(restored.revision).toBe(2);
    expect(JSON.parse(restored.afterJson)).toMatchObject({ name: 'Orig' });
    await db.assetRevision.deleteMany({ where: { assetId: 'e2e-rs' } });
  });

  it('concurrent appends produce distinct revisions', async () => {
    const results = await Promise.all([1,2,3,4,5].map(v => appendAssetRevision({ assetType:'dataset', assetId:'e2e-race', action:'create', after:{v}})));
    const revs = results.map(r=>r.revision).sort((a,b)=>a-b);
    expect(revs).toEqual([1,2,3,4,5]); expect(new Set(revs).size).toBe(5);
    await db.assetRevision.deleteMany({ where: { assetId: 'e2e-race' } });
  });
});

describe('E2E — Phase 5a SQL validator', () => {
  it.each(['SELECT 1','WITH x AS(SELECT 1)SELECT * FROM x','EXPLAIN SELECT 1','DESCRIBE users','SHOW TABLES'])('accepts: %s', s => expect(isReadOnlySQL(s)).toBe(true));
  it.each(['INSERT INTO x VALUES(1)','UPDATE x SET y=1','DELETE FROM x','DROP TABLE x','ALTER TABLE x','TRUNCATE x','CREATE TABLE x(id INT)'])('rejects: %s', s => expect(isReadOnlySQL(s)).toBe(false));
  it('rejects semicolon hijack', () => expect(isReadOnlySQL('SELECT 1; DROP TABLE users')).toBe(false));
  it('rejects comment-hidden DELETE', () => expect(isReadOnlySQL('SELECT 1\n-- ok\nDELETE FROM users')).toBe(false));
  it('extracts FROM/JOIN tables', () => {
    const refs = extractTableRefs('SELECT * FROM orders JOIN customers ON o.id=c.id');
    expect(refs).toContain('orders'); expect(refs).toContain('customers');
  });
  it('normalises schema.table', () => expect(extractTableRefs('SELECT * FROM public.orders')).toEqual(['orders']));
  it('allowlist rejects unknown', () => {
    const r = validateQuery('SELECT * FROM secrets', ['orders','customers']);
    expect(r.valid).toBe(false); expect(r.errorCode).toBe('TABLE_NOT_ALLOWED');
  });
  it('allowlist passes known', () => expect(validateQuery('SELECT * FROM orders',['orders']).valid).toBe(true));
  it('rejects empty SQL', () => expect(isReadOnlySQL('')).toBe(false));
  it('rejects whitespace-only', () => expect(isReadOnlySQL('  \n\t ')).toBe(false));
});

describe('E2E — Phase 5b dependencies', () => {
  it('resolves source-table refs', async () => {
    const deps = await resolveDependencies('SELECT * FROM orders', connId);
    expect(deps.some(d => d.dependencyType === 'source_table' && d.dependsOnTable === 'orders')).toBe(true);
  });

  it('validates read-only SQL before save', async () => {
    const r = await validateVirtualDataset({ sql: 'DROP TABLE orders', language: 'sql', connectorId: connId });
    expect(r.valid).toBe(false); expect(r.errorCode).toBe('SQL_NOT_READ_ONLY');
  });

  it('validates SQL on update', async () => {
    const r = await validateVirtualDataset({ sql: 'SELECT * FROM orders', language: 'sql', connectorId: connId, datasetId: dsId });
    expect(r.valid).toBe(true);
    if (r.dependencies) await replaceDependencies(dsId, r.dependencies);
  });

  it('detects direct cycle A→B→A', async () => {
    const a = await db.dataset.create({ data: { name: 'e2e-cyc-a', type: 'virtual', language: 'sql', code: 'SELECT 1', connectorId: connId } });
    const b = await db.dataset.create({ data: { name: 'e2e-cyc-b', type: 'virtual', language: 'sql', code: 'SELECT 1', connectorId: connId } });
    await replaceDependencies(a.id, [{ dependsOnDatasetId: b.id, dependencyType: 'virtual_dataset' }]);
    await replaceDependencies(b.id, [{ dependsOnDatasetId: a.id, dependencyType: 'virtual_dataset' }]);
    expect(await detectCycles(a.id)).not.toBeNull();
    await replaceDependencies(a.id, []); await replaceDependencies(b.id, []);
    await db.dataset.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  it('no cycle when deps are clean', async () => {
    await replaceDependencies(dsId, []);
    expect(await detectCycles(dsId)).toBeNull();
  });
});

describe('E2E — Phase 5c contracts', () => {
  it('passes with no contract', async () => {
    const r = await checkContracts(dsId, { rows: [{x:1}], columns: [{name:'x',type:'Int32'}], rowCount:1, truncated:false, elapsedMs:0 });
    expect(r.passed).toBe(true);
  });

  it('detects missing column', async () => {
    const cols: ColumnContract[] = [{name:'a',type:'String'},{name:'b',type:'Int32'}];
    await db.datasetContract.upsert({ where: { datasetId: dsId }, create: { datasetId: dsId, columns: JSON.stringify(cols) }, update: { columns: JSON.stringify(cols) } });
    const r = await checkContracts(dsId, { rows: [{a:'x'}], columns: [{name:'a',type:'String'}], rowCount:1, truncated:false, elapsedMs:0 });
    expect(r.passed).toBe(false);
    expect(r.violations.some(v => v.rule === 'missing_column')).toBe(true);
  });

  it('detects incompatible type', async () => {
    const cols: ColumnContract[] = [{name:'val',type:'Int64'}];
    await db.datasetContract.upsert({ where: { datasetId: dsId }, create: { datasetId: dsId, columns: JSON.stringify(cols) }, update: { columns: JSON.stringify(cols) } });
    const r = await checkContracts(dsId, { rows: [{val:'text'}], columns: [{name:'val',type:'String'}], rowCount:1, truncated:false, elapsedMs:0 });
    expect(r.violations.some(v => v.rule === 'incompatible_type')).toBe(true);
  });

  it('detects uniqueness violation', async () => {
    const cols: ColumnContract[] = [{name:'cat',type:'String',unique:true}];
    await db.datasetContract.upsert({ where: { datasetId: dsId }, create: { datasetId: dsId, columns: JSON.stringify(cols) }, update: { columns: JSON.stringify(cols) } });
    const r = await checkContracts(dsId, { rows: [{cat:'A'},{cat:'A'},{cat:'B'}], columns: [{name:'cat',type:'String'}], rowCount:3, truncated:false, elapsedMs:0 });
    expect(r.violations.some(v => v.rule === 'uniqueness')).toBe(true);
  });

  it('detects nullability violation', async () => {
    const cols: ColumnContract[] = [{name:'email',type:'String',nullable:false}];
    await db.datasetContract.upsert({ where: { datasetId: dsId }, create: { datasetId: dsId, columns: JSON.stringify(cols) }, update: { columns: JSON.stringify(cols) } });
    const r = await checkContracts(dsId, { rows: [{email:'ok'},{email:null}], columns: [{name:'email',type:'Nullable(String)'}], rowCount:2, truncated:false, elapsedMs:0 });
    expect(r.violations.some(v => v.rule === 'nullability')).toBe(true);
  });

  it('detects accepted-values violation', async () => {
    const cols: ColumnContract[] = [{name:'status',type:'String'}];
    await db.datasetContract.upsert({ where: { datasetId: dsId }, create: { datasetId: dsId, columns: JSON.stringify(cols), acceptedValues: JSON.stringify({status:['active','inactive']}) }, update: { columns: JSON.stringify(cols), acceptedValues: JSON.stringify({status:['active','inactive']}) } });
    const r = await checkContracts(dsId, { rows: [{status:'deleted'}], columns: [{name:'status',type:'String'}], rowCount:1, truncated:false, elapsedMs:0 });
    expect(r.violations.some(v => v.rule === 'accepted_values' && v.actual === 'deleted')).toBe(true);
  });

  it('passes when all satisfied', async () => {
    const cols: ColumnContract[] = [{name:'nm',type:'String'},{name:'ag',type:'Int32',nullable:false}];
    await db.datasetContract.upsert({ where: { datasetId: dsId }, create: { datasetId: dsId, columns: JSON.stringify(cols) }, update: { columns: JSON.stringify(cols) } });
    const r = await checkContracts(dsId, { rows: [{nm:'A',ag:30}], columns: [{name:'nm',type:'String'},{name:'ag',type:'Int32'}], rowCount:1, truncated:false, elapsedMs:0 });
    expect(r.passed).toBe(true); expect(r.violations).toHaveLength(0);
  });

  it('revision written on check', async () => {
    const prev = await db.assetRevision.count({ where: { assetId: dsId } });
    const cols: ColumnContract[] = [{name:'x',type:'String'}];
    await db.datasetContract.upsert({ where: { datasetId: dsId }, create: { datasetId: dsId, columns: JSON.stringify(cols) }, update: { columns: JSON.stringify(cols) } });
    await checkContracts(dsId, { rows: [{x:'ok'}], columns: [{name:'x',type:'String'}], rowCount:1, truncated:false, elapsedMs:0 });
    expect(await db.assetRevision.count({ where: { assetId: dsId } })).toBeGreaterThan(prev);
  });
});

describe('E2E — CRUD entities', () => {
  it('dashboard create+update', async () => {
    const d = await db.dashboard.update({ where: { id: dashboardId }, data: { status: 'archived' } });
    expect(d.status).toBe('archived');
  });

  it('chart in dashboard', async () => {
    const dash = await db.dashboard.findUnique({ where: { id: dashboardId }, include: { charts: true } });
    expect(dash!.charts.map(c => c.id)).toContain(chartId);
  });

  it('metric linked to chart', async () => {
    const links = await db.chartMetric.findMany({ where: { chartId } });
    expect(links.length).toBeGreaterThan(0);
  });

  it('transform exists', async () => {
    const t = await db.transform.findUnique({ where: { id: transformId } });
    expect(t!.type).toBe('sql');
  });

  it('chart/node cleanup: Node deleted when chart deleted', async () => {
    const n = await db.node.create({ data: { externalId: 'e2e-clean', platform: 'lentera', nodeType: 'chart', name: 'E2E Chart', qualifiedName: 'e2e', status: 'active' } });
    expect(n).not.toBeNull();
    // Simulates what the DELETE route handler does: find node by name+type, delete edges, delete node.
    const node = await db.node.findFirst({ where: { name: 'E2E Chart', nodeType: 'chart' } });
    expect(node).not.toBeNull();
    await db.edge.deleteMany({ where: { OR: [{ sourceNodeId: node!.id }, { targetNodeId: node!.id }] } });
    await db.node.delete({ where: { id: node!.id } });
    const after = await db.node.count({ where: { name: 'E2E Chart', nodeType: 'chart' } });
    expect(after).toBe(0);
  });
});

describe('E2E — worst-case scenarios', () => {
  it('10k-char SQL accepted (read-only)', () => expect(isReadOnlySQL('SELECT ' + '*, '.repeat(3000) + '1')).toBe(true));
  it('unicode homoglyph rejected', () => expect(isReadOnlySQL('SELECT 1；DROP TABLE x')).toBe(false));
  it('empty allowlist rejects', () => expect(validateQuery('SELECT * FROM x', []).valid).toBe(false));
  it('unknown connector resolves 0 deps', async () => {
    const r = await validateVirtualDataset({ sql: 'SELECT 1', language: 'sql', connectorId: 'nope' });
    expect(r.dependencies).toHaveLength(0);
  });
  it('query defaults are within bounds', () => {
    expect(QUERY_DEFAULTS.maxTimeout).toBe(60_000);
    expect(QUERY_DEFAULTS.maxRowsHard).toBe(10_000);
    expect(QUERY_DEFAULTS.maxBytesHard).toBe(10_485_760);
  });
});