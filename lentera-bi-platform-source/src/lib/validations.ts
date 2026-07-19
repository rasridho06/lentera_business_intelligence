import { z } from 'zod';

// ════════════════════════════════════════════════════════════════
// Zod Validation Schemas for API Routes
// ════════════════════════════════════════════════════════════════

// ── Connector Schemas ──
export const createConnectorSchema = z.object({
  name: z.string().min(1, 'Connector name is required').max(100),
  type: z.enum([
    'clickhouse', 'postgres', 'mysql', 'bigquery', 'snowflake', 'redshift', 'sqlite',
    'csv', 'json', 'excel', 'parquet',
  ], { message: 'Invalid connector type' }),
  category: z.enum(['olap', 'oltp', 'file']).optional(),
  host: z.string().max(255).optional().nullable(),
  port: z.number().int().min(0).max(65535).optional().nullable(),
  database: z.string().max(255).optional().nullable(),
  username: z.string().max(255).optional().nullable(),
  password: z.string().max(255).optional().nullable(),
  schema: z.string().max(255).optional().nullable(),
  filePath: z.string().max(1000).optional().nullable(),
  fileConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
});

// ── Chart Schemas ──
export const createChartSchema = z.object({
  name: z.string().min(1, 'Chart name is required').max(200),
  description: z.string().max(1000).optional().nullable(),
  chartType: z.enum([
    'bar', 'line', 'pie', 'area', 'scatter', 'table',
    'metric_card', 'heatmap', 'funnel', 'histogram',
  ], { message: 'Invalid chart type' }).optional().default('bar'),
  dataSourceType: z.enum(['connector', 'table', 'dataset', 'custom_sql', 'transform']).optional().default('table'),
  dataSourceId: z.string().optional().nullable(),
  datasetId: z.string().optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
  customSQL: z.string().max(10000).optional().nullable(),
  layout: z.record(z.string(), z.unknown()).optional().nullable(),
  dashboardId: z.string().optional().nullable(),
  metricIds: z.array(z.string()).optional(),
  ownerUserId: z.string().optional().nullable(),
});

export const updateChartSchema = z.object({
  id: z.string().min(1, 'Chart ID is required'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  chartType: z.enum(['bar', 'line', 'pie', 'area', 'scatter', 'table', 'metric_card', 'heatmap', 'funnel', 'histogram']).optional(),
  dataSourceType: z.enum(['connector', 'table', 'dataset', 'custom_sql', 'transform']).optional(),
  dataSourceId: z.string().optional().nullable(),
  datasetId: z.string().optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
  customSQL: z.string().max(10000).optional().nullable(),
  layout: z.record(z.string(), z.unknown()).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  dashboardId: z.string().optional().nullable(),
});

// ── Dashboard Schemas ──
export const createDashboardSchema = z.object({
  name: z.string().min(1, 'Dashboard name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  layout: z.record(z.string(), z.unknown()).optional().nullable(),
  filters: z.record(z.string(), z.unknown()).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
});

export const updateDashboardSchema = z.object({
  id: z.string().min(1, 'Dashboard ID is required'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  layout: z.record(z.string(), z.unknown()).optional().nullable(),
  filters: z.record(z.string(), z.unknown()).optional().nullable(),
  isPublic: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// ── Dataset Schemas ──
export const createDatasetSchema = z.object({
  name: z.string().min(1, 'Dataset name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['virtual', 'physical', 'python_generated']).optional().default('virtual'),
  language: z.enum(['sql', 'python']).optional().default('sql'),
  code: z.string().max(50000).optional().nullable(),
  sourceTables: z.union([
    z.string(),
    z.array(z.object({
      connectorId: z.string().optional(),
      schema: z.string().optional(),
      table: z.string(),
    })),
  ]).optional().nullable(),
  outputColumns: z.union([
    z.string(),
    z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
    })),
  ]).optional().nullable(),
  connectorId: z.string().optional().nullable(),
  schedule: z.string().max(100).optional().nullable(),
  dashboardId: z.string().optional().nullable(),
});

export const updateDatasetSchema = z.object({
  id: z.string().min(1, 'Dataset ID is required'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['virtual', 'physical', 'python_generated']).optional(),
  language: z.enum(['sql', 'python']).optional(),
  code: z.string().max(50000).optional().nullable(),
  sourceTables: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  outputColumns: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  connectorId: z.string().optional().nullable(),
  schedule: z.string().max(100).optional().nullable(),
  status: z.enum(['draft', 'published', 'deprecated']).optional(),
  lastRunStatus: z.string().optional(),
  lastRunAt: z.string().optional(),
});

// ── Metric Schemas ──
export const createMetricSchema = z.object({
  name: z.string().min(1, 'Metric name is required').max(200),
  description: z.string().max(1000).optional().nullable(),
  expression: z.string().max(10000).optional().nullable(),
  language: z.enum(['sql', 'python']).optional().default('sql'),
  aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max', 'custom']).optional().nullable(),
  sourceTableId: z.string().optional().nullable(),
  sourceColumn: z.string().max(200).optional().nullable(),
  filters: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  dimensions: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  timeGrain: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional().nullable(),
});

export const updateMetricSchema = z.object({
  id: z.string().min(1, 'Metric ID is required'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  expression: z.string().max(10000).optional().nullable(),
  language: z.enum(['sql', 'python']).optional(),
  aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max', 'custom']).optional().nullable(),
  sourceTableId: z.string().optional().nullable(),
  sourceColumn: z.string().max(200).optional().nullable(),
  filters: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  dimensions: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  timeGrain: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year']).optional().nullable(),
  status: z.enum(['draft', 'published', 'deprecated']).optional(),
});

// ── Transform Schemas ──
export const createTransformSchema = z.object({
  name: z.string().min(1, 'Transform name is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['sql', 'python']),
  code: z.string().min(1, 'Code is required').max(50000),
  inputTables: z.union([
    z.string(),
    z.array(z.object({
      connectorId: z.string().optional(),
      schema: z.string().optional(),
      table: z.string(),
    })),
  ]).optional().nullable(),
  outputSpec: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().nullable(),
  schedule: z.string().max(100).optional().nullable(),
  environment: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().nullable(),
});

export const updateTransformSchema = z.object({
  id: z.string().min(1, 'Transform ID is required'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['sql', 'python']).optional(),
  code: z.string().min(1).max(50000).optional(),
  config: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().nullable(),
  inputTables: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional().nullable(),
  outputSpec: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().nullable(),
  schedule: z.string().max(100).optional().nullable(),
  environment: z.union([z.string(), z.record(z.string(), z.unknown())]).optional().nullable(),
  status: z.enum(['draft', 'published', 'deprecated']).optional(),
  lastRunStatus: z.string().optional(),
  lastRunAt: z.string().optional(),
});

// ── Branch Schemas ──
export const createBranchSchema = z.object({
  dashboardId: z.string().min(1, 'Dashboard ID is required'),
  name: z.string().min(1, 'Branch name is required').max(100).regex(
    /^[a-zA-Z0-9._/-]+$/,
    'Branch name can only contain alphanumeric characters, dots, hyphens, slashes, and underscores'
  ),
  baseBranch: z.string().max(100).optional().default('main'),
  description: z.string().max(500).optional().nullable(),
});

// ── Merge Request Schemas ──
export const createMergeRequestSchema = z.object({
  dashboardId: z.string().min(1, 'Dashboard ID is required'),
  sourceBranchId: z.string().min(1, 'Source branch ID is required'),
  targetBranch: z.string().max(100).optional().default('main'),
  title: z.string().min(1, 'MR title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
});

export const updateMergeRequestSchema = z.object({
  id: z.string().min(1, 'MR ID is required'),
  action: z.enum(['merge', 'resolve_conflict', 'close']).optional(),
  status: z.enum(['open', 'reviewing', 'conflict', 'merged', 'closed']).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
});

// ── Collaboration Schema ──
export const collaborationSchema = z.object({
  dashboardId: z.string().min(1, 'Dashboard ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  cursorX: z.number().int().optional().default(0),
  cursorY: z.number().int().optional().default(0),
  activeChartId: z.string().optional().nullable(),
  status: z.enum(['active', 'idle', 'disconnected']).optional().default('active'),
});

// ── Helper: Validate request body ──
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
  return { success: false, error: errors };
}
