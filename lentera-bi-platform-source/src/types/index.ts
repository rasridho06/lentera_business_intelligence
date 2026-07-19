export interface AuditData {
  findings: Array<{
    id: string;
    ruleId: string;
    ruleVersion: string;
    severity: string;
    title: string;
    description: string;
    evidence: Record<string, unknown> | null;
    recommendation: string | null;
    status: string;
    suppressionReason: string | null;
    node: {
      id: string;
      name: string;
      type: string;
      platform: string;
      qualifiedName: string;
    } | null;
    createdAt: string;
  }>;
  rules: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  severityCounts: Record<string, number>;
  total: number;
}

export interface DataSourceTable {
  id: string;
  connectorId: string;
  schema: string | null;
  name: string;
  type: string;
  rowCount: number | null;
  sizeBytes: number | null;
  columns: string | null;
}

export interface Connector {
  id: string;
  name: string;
  type: string;
  category: string;
  host: string | null;
  port: number | null;
  database: string | null;
  username: string | null;
  password: string | null;
  schema: string | null;
  filePath: string | null;
  fileConfig: string | null;
  status: string;
  lastSyncAt: string | null;
  tables: DataSourceTable[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  tables?: Array<{ schema: string; name: string; type: string; rowCount: number }>;
  version?: string;
  error?: string;
}

export interface FileUploadResult {
  success: boolean;
  file?: {
    name: string;
    storedName: string;
    type: string;
    size: number;
    sizeMB: string;
    path?: string;
  };
  schema?: {
    columns: Array<{ name: string; type: string; nullable: boolean; sample?: unknown }>;
    rowCount: number;
    detectedType: string;
  };
  preview?: Record<string, unknown>[];
  error?: string;
  parseError?: string;
}

export interface ChartConfig {
  xAxis: string;
  yAxis: string[];
  metrics: string[];
  dimensions: string[];
  colorPalette: string;
  showLegend: boolean;
  showGrid: boolean;
  showLabels: boolean;
  stacked: boolean;
  smooth: boolean;
  orientation: 'vertical' | 'horizontal';
  donut: boolean;
  aggregateFunction: 'sum' | 'avg' | 'count' | 'min' | 'max';
  limit: number;
}

export interface ChartDetailData {
  id: string;
  name: string;
  chartType: string;
  description: string | null;
  status: string;
  branch: string;
  dashboardId: string | null;
  datasetId: string | null;
  dataSourceType: string | null;
  config: string | null;
  customSQL: string | null;
  chartMetrics: Array<{ id: string; metricId: string; metric: { id: string; name: string; expression: string | null } }>;
  dashboard: { id: string; name: string } | null;
}

export interface DashboardOption {
  id: string;
  name: string;
}

export interface DatasetOption {
  id: string;
  name: string;
  type: string;
}

export interface ConnectorOption {
  id: string;
  name: string;
  type: string;
  tables: Array<{ id: string; name: string; schema: string | null; columns: string | null }>;
}

export interface DashboardChartData {
  id: string;
  name: string;
  chartType: string;
  status: string;
  config: string | null;
  chartMetrics: Array<{ id: string; metricId: string; metric: { id: string; name: string; expression: string | null } }>;
}

export interface DashboardData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isPublic: boolean;
  branch: string;
  layout: string | null;
  charts: DashboardChartData[];
}

export interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  dashboardId: string;
  x: number;
  y: number;
  activeChartId: string | null;
}

export interface DatasetData {
  id: string;
  name: string;
  description: string | null;
  type: string;
  language: string;
  code: string | null;
  sourceTables: string | null;
  outputColumns: string | null;
  connectorId: string | null;
  schedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  status: string;
  branch: string;
  ownerUserId: string | null;
  dashboardId: string | null;
}

export interface ImpactData {
  sourceNode: {
    id: string;
    name: string;
    type: string;
    qualifiedName: string;
  };
  direction: string;
  affectedNodes: Array<{
    id: string;
    name: string;
    type: string;
    platform: string;
    qualifiedName: string;
    owner: string | null;
    status: string | null;
  }>;
  affectedPaths: Array<{
    from: string;
    to: string;
    edgeType: string;
    confidence: string;
  }>;
  byType: Record<string, string[]>;
  confidenceSummary: Record<string, number>;
  totalAffected: number;
}

export interface SearchResult {
  id: string;
  externalId: string;
  name: string;
  type: string;
  platform: string;
  qualifiedName: string;
  description: string | null;
  owner: string | null;
  status: string | null;
}

export interface LineageNode {
  id: string;
  externalId: string;
  name: string;
  type: string;
  platform: string;
  qualifiedName: string;
  description: string | null;
  owner: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  findings: number;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: string;
  extractionMethod: string | null;
  expression: string | null;
  sourcePlatform: string | null;
}

export interface LineageData {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export interface MetricSourceData {
  id: string;
  metricId: string;
  tableId: string | null;
  connectorId: string | null;
  schemaName: string | null;
  tableName: string;
  columnName: string | null;
  role: string;
  expression: string | null;
}

export interface MetricData {
  id: string;
  name: string;
  description: string | null;
  expression: string | null;
  language: string;
  aggregation: string | null;
  sourceTableId: string | null;
  sourceColumn: string | null;
  filters: string | null;
  dimensions: string | null;
  timeGrain: string | null;
  status: string;
  branch: string;
  version: number;
  ownerUserId: string | null;
  metricSources: MetricSourceData[];
  chartMetrics: Array<{ id: string; chart: { id: string; name: string; dashboardId: string } }>;
}

export interface MetricsData {
  canonicalMetrics: Array<{
    id: string;
    name: string;
    aliases: string[];
    description: string | null;
    expression: string | null;
    aggregation: string | null;
    requiredFilters: string[];
    dimensions: string[];
    currencyRequirement: string | null;
    timeGrain: string | null;
    owner: string | null;
    version: string;
    severityOnDrift: string;
  }>;
  observedMetrics: Array<{
    id: string;
    name: string;
    qualifiedName: string;
    description: string | null;
    owner: string | null;
    metadata: Record<string, unknown>;
  }>;
  comparisons: Array<{
    canonical: {
      id: string;
      name: string;
      aliases: string[];
      description: string | null;
      expression: string | null;
      aggregation: string | null;
      requiredFilters: string[];
      dimensions: string[];
      currencyRequirement: string | null;
      timeGrain: string | null;
      owner: string | null;
      version: string;
      severityOnDrift: string;
    };
    observed: Array<{
      id: string;
      name: string;
      qualifiedName: string;
      description: string | null;
      metadata: Record<string, unknown>;
    }>;
    driftStatus: string;
  }>;
}

export interface NodeDetailData {
  node: {
    id: string;
    externalId: string;
    name: string;
    type: string;
    platform: string;
    qualifiedName: string;
    description: string | null;
    owner: string | null;
    status: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
  };
  upstream: Array<{
    edgeId: string;
    edgeType: string;
    confidence: string;
    expression: string | null;
    node: {
      id: string;
      name: string;
      type: string;
      platform: string;
      qualifiedName: string;
    };
  }>;
  downstream: Array<{
    edgeId: string;
    edgeType: string;
    confidence: string;
    expression: string | null;
    node: {
      id: string;
      name: string;
      type: string;
      platform: string;
      qualifiedName: string;
    };
  }>;
  findings: Array<{
    id: string;
    ruleId: string;
    severity: string;
    title: string;
    description: string;
    evidence: Record<string, unknown> | null;
    recommendation: string | null;
    status: string;
  }>;
  canonicalComparison: {
    canonical: {
      id: string;
      name: string;
      expression: string | null;
      aggregation: string | null;
      requiredFilters: string[];
      dimensions: string[];
    };
    observed: {
      name: string;
      metadata: Record<string, unknown>;
    };
  } | null;
}

export interface OverviewData {
  buildRun: {
    status: string;
    totalModels: number;
    totalDatasets: number;
    totalCharts: number;
    totalDashboards: number;
    unresolvedCount: number;
    lineageCoverage: number;
    errorFindings: number;
    warningFindings: number;
    criticalFindings: number;
    infoFindings: number;
    duration: number;
    createdAt: string;
  } | null;
  nodeCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  totalNodes: number;
  totalEdges: number;
  totalCanonicalMetrics: number;
  lineageCoverage: number;
  driftFindings: Array<{
    id: string;
    title: string;
    severity: string;
    node: string;
    evidence: Record<string, unknown> | null;
  }>;
  platformCounts: Record<string, number>;
}

export interface TransformData {
  id: string;
  name: string;
  description: string | null;
  type: string;
  code: string;
  config: string | null;
  inputTables: string | null;
  outputSpec: string | null;
  schedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  environment: string | null;
  status: string;
  branch: string;
  ownerUserId: string | null;
}

export interface MergeRequestData {
  id: string;
  dashboardId: string;
  sourceBranchId: string;
  targetBranch: string;
  title: string;
  description: string | null;
  status: string;
  conflictDetails: string | null;
  ownerUserId: string | null;
  reviewerUserId: string | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceBranch: {
    id: string;
    name: string;
    dashboard: { name: string };
  } | null;
}

export interface CollaborationUserData {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  color: string | null;
  activities: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    details: string | null;
    createdAt: string;
  }>;
}
