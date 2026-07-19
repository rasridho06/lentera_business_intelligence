'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Database, GitBranch, BarChart3, LayoutDashboard, LineChart, AlertCircle, CheckCircle, ArrowUp, ArrowDown, Filter, Clock } from 'lucide-react';

interface NodeDetailData {
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

const typeIcons: Record<string, React.ReactNode> = {
  source: <Database className="h-5 w-5" />,
  model: <GitBranch className="h-5 w-5" />,
  dataset: <Database className="h-5 w-5" />,
  chart: <BarChart3 className="h-5 w-5" />,
  dashboard: <LayoutDashboard className="h-5 w-5" />,
  metric: <LineChart className="h-5 w-5" />,
  column: <Database className="h-5 w-5" />,
  filter: <Filter className="h-5 w-5" />,
  dimension: <BarChart3 className="h-5 w-5" />,
  time_dimension: <Clock className="h-5 w-5" />,
};

const typeColors: Record<string, string> = {
  source: 'bg-amber-100 text-amber-800 border-amber-300',
  model: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  dataset: 'bg-sky-100 text-sky-800 border-sky-300',
  chart: 'bg-violet-100 text-violet-800 border-violet-300',
  dashboard: 'bg-rose-100 text-rose-800 border-rose-300',
  metric: 'bg-teal-100 text-teal-800 border-teal-300',
  column: 'bg-slate-100 text-slate-800 border-slate-300',
  filter: 'bg-pink-100 text-pink-800 border-pink-300',
};

const edgeTypeLabels: Record<string, string> = {
  DERIVED_FROM: 'Derived From',
  CONTAINS: 'Contains',
  USES_COLUMN: 'Uses Column',
  AGGREGATES: 'Aggregates',
  GROUPED_BY: 'Grouped By',
  TIME_DIMENSION: 'Time Dimension',
  FILTERED_BY: 'Filtered By',
  JOINS_WITH: 'Joins With',
  DISPLAYED_IN: 'Displayed In',
  BELONGS_TO: 'Belongs To',
  PRODUCES: 'Produced By',
  IMPLEMENTS_METRIC: 'Implements Metric',
};

const confidenceColors: Record<string, string> = {
  verified: 'bg-green-100 text-green-800',
  declared: 'bg-blue-100 text-blue-800',
  inferred: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-orange-100 text-orange-800',
  unknown: 'bg-gray-100 text-gray-800',
};

export function NodeDetailView({ data }: { data: NodeDetailData }) {
  const { node, upstream, downstream, findings, canonicalComparison } = data;

  return (
    <div className="space-y-6">
      {/* Node Header */}
      <Card className={`border-l-4 ${typeColors[node.type]?.includes('amber') ? 'border-l-amber-500' : typeColors[node.type]?.includes('emerald') ? 'border-l-emerald-500' : typeColors[node.type]?.includes('sky') ? 'border-l-sky-500' : typeColors[node.type]?.includes('violet') ? 'border-l-violet-500' : typeColors[node.type]?.includes('rose') ? 'border-l-rose-500' : typeColors[node.type]?.includes('teal') ? 'border-l-teal-500' : 'border-l-gray-500'}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <span className={`flex items-center justify-center h-12 w-12 rounded-lg border ${typeColors[node.type] || 'bg-gray-100'}`}>
              {typeIcons[node.type] || <Database className="h-5 w-5" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{node.name}</h2>
                <Badge variant="outline" className="text-xs capitalize">{node.type.replace('_', ' ')}</Badge>
                <Badge variant="outline" className="text-xs">{node.platform}</Badge>
                {node.status && <Badge variant={node.status === 'excluded' ? 'destructive' : node.status === 'active' ? 'secondary' : 'outline'} className="text-xs capitalize">{node.status}</Badge>}
              </div>
              <p className="text-sm font-mono text-muted-foreground mt-0.5">{node.qualifiedName}</p>
              {node.description && <p className="text-sm text-muted-foreground mt-2">{node.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {node.owner && <span>Owner: <strong>{node.owner}</strong></span>}
                {node.metadata?.materialization && <span>Type: <code>{node.metadata.materialization as string}</code></span>}
                {node.metadata?.schema && <span>Schema: <code>{node.metadata.schema as string}</code></span>}
                {node.metadata?.vizType && <span>Viz: <code>{node.metadata.vizType as string}</code></span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Findings */}
      {findings.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <CardTitle className="text-base">Audit Findings ({findings.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {findings.map(f => (
              <div key={f.id} className={`p-3 rounded-lg border ${f.severity === 'critical' || f.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{f.ruleId}</Badge>
                    <span className="font-medium text-sm">{f.title}</span>
                  </div>
                  <Badge variant={f.severity === 'critical' || f.severity === 'error' ? 'destructive' : 'secondary'} className="text-xs capitalize">{f.severity}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{f.description}</p>
                {f.recommendation && (
                  <div className="flex items-start gap-1.5 mt-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                    <span>{f.recommendation}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Canonical Comparison (for metrics) */}
      {canonicalComparison && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Canonical Metric Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs font-medium text-emerald-800 mb-2">Canonical: {canonicalComparison.canonical.name}</p>
                <div className="space-y-1 text-xs">
                  {canonicalComparison.canonical.expression && <div><span className="text-muted-foreground">Expression:</span> <code>{canonicalComparison.canonical.expression}</code></div>}
                  {canonicalComparison.canonical.aggregation && <div><span className="text-muted-foreground">Aggregation:</span> <code className="uppercase">{canonicalComparison.canonical.aggregation}</code></div>}
                  {canonicalComparison.canonical.requiredFilters.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Filters:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {canonicalComparison.canonical.requiredFilters.map((f, i) => <code key={i} className="bg-emerald-100 px-1 rounded">{f}</code>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                <p className="text-xs font-medium text-violet-800 mb-2">Observed: {canonicalComparison.observed.name}</p>
                <div className="space-y-1 text-xs">
                  {canonicalComparison.observed.metadata?.expression && <div><span className="text-muted-foreground">Expression:</span> <code>{canonicalComparison.observed.metadata.expression as string}</code></div>}
                  {canonicalComparison.observed.metadata?.aggregation && <div><span className="text-muted-foreground">Aggregation:</span> <code className="uppercase">{canonicalComparison.observed.metadata.aggregation as string}</code></div>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lineage: Upstream & Downstream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upstream */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4" />
              <CardTitle className="text-base">Upstream ({upstream.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {upstream.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upstream dependencies found.</p>
            ) : (
              <div className="space-y-2">
                {upstream.map(u => (
                  <div key={u.edgeId} className="p-3 rounded-lg border hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{u.node.name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{u.node.type.replace('_', ' ')}</Badge>
                      </div>
                      <Badge className={`text-[9px] ${confidenceColors[u.confidence] || ''}`}>{u.confidence}</Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{u.node.qualifiedName}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>{edgeTypeLabels[u.edgeType] || u.edgeType}</span>
                      {u.expression && <code className="bg-muted px-1 rounded">{u.expression}</code>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Downstream */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4" />
              <CardTitle className="text-base">Downstream ({downstream.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {downstream.length === 0 ? (
              <p className="text-sm text-muted-foreground">No downstream dependents found.</p>
            ) : (
              <div className="space-y-2">
                {downstream.map(d => (
                  <div key={d.edgeId} className="p-3 rounded-lg border hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{d.node.name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{d.node.type.replace('_', ' ')}</Badge>
                      </div>
                      <Badge className={`text-[9px] ${confidenceColors[d.confidence] || ''}`}>{d.confidence}</Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{d.node.qualifiedName}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>{edgeTypeLabels[d.edgeType] || d.edgeType}</span>
                      {d.expression && <code className="bg-muted px-1 rounded">{d.expression}</code>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata */}
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(node.metadata).map(([key, value]) => (
                <div key={key} className="p-2 bg-muted rounded">
                  <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="text-sm font-medium truncate">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
