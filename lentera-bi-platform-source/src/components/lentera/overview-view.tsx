'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, AlertCircle, Info, Database, BarChart3, LineChart, LayoutDashboard, GitBranch, TrendingDown } from 'lucide-react';
import type { OverviewData } from '@/types';

export function OverviewView({ data }: { data: OverviewData }) {
  const run = data.buildRun;
  const severityIcons: Record<string, React.ReactNode> = {
    critical: <AlertCircle className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
  };
  const severityColors: Record<string, string> = {
    critical: 'text-red-600 bg-red-50 border-red-200',
    error: 'text-orange-600 bg-orange-50 border-orange-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    info: 'text-blue-600 bg-blue-50 border-blue-200',
  };

  const nodeTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    source: { label: 'Sources', icon: <Database className="h-4 w-4" />, color: 'text-amber-600' },
    model: { label: 'dbt Models', icon: <GitBranch className="h-4 w-4" />, color: 'text-emerald-600' },
    dataset: { label: 'Datasets', icon: <Database className="h-4 w-4" />, color: 'text-sky-600' },
    chart: { label: 'Charts', icon: <BarChart3 className="h-4 w-4" />, color: 'text-violet-600' },
    dashboard: { label: 'Dashboards', icon: <LayoutDashboard className="h-4 w-4" />, color: 'text-rose-600' },
    metric: { label: 'Metrics', icon: <LineChart className="h-4 w-4" />, color: 'text-teal-600' },
    column: { label: 'Columns', icon: <Database className="h-4 w-4" />, color: 'text-slate-600' },
    filter: { label: 'Filters', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-pink-600' },
    dimension: { label: 'Dimensions', icon: <BarChart3 className="h-4 w-4" />, color: 'text-indigo-600' },
    time_dimension: { label: 'Time Dims', icon: <LineChart className="h-4 w-4" />, color: 'text-cyan-600' },
  };

  return (
    <div className="space-y-6">
      {/* Build Status Banner */}
      {run && (
        <Card className={`border-l-4 ${run.status === 'failed' ? 'border-l-red-500' : run.status === 'warning' ? 'border-l-yellow-500' : 'border-l-green-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {run.status === 'success' ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                 run.status === 'warning' ? <AlertTriangle className="h-5 w-5 text-yellow-600" /> :
                 <AlertCircle className="h-5 w-5 text-red-600" />}
                <div>
                  <p className="font-semibold">Build: {run.status.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">
                    Project: hungryhub-analytics • Duration: {run.duration}s • {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {data.totalNodes} nodes • {data.totalEdges} edges
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset Counts Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.entries(nodeTypeLabels).map(([type, config]) => {
          const count = data.nodeCounts[type] || 0;
          if (count === 0) return null;
          return (
            <Card key={type} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={config.color}>{config.icon}</span>
                  <span className="text-sm text-muted-foreground">{config.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two Column: Severity + Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audit Findings by Severity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Audit Findings by Severity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['critical', 'error', 'warning', 'info'].map((sev) => (
              <div key={sev} className={`flex items-center justify-between p-3 rounded-lg border ${severityColors[sev]}`}>
                <div className="flex items-center gap-2">
                  {severityIcons[sev]}
                  <span className="font-medium capitalize">{sev}</span>
                </div>
                <span className="text-xl font-bold">{data.severityCounts[sev] || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Lineage Coverage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lineage Coverage & Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Dataset Resolution</span>
                <span className="font-medium">{(data.lineageCoverage * 100).toFixed(0)}%</span>
              </div>
              <Progress value={data.lineageCoverage * 100} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">
                {(data.lineageCoverage * 100).toFixed(0)}% of Superset datasets matched to dbt models or warehouse objects
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Canonical Metrics</p>
                <p className="text-xl font-bold">{data.totalCanonicalMetrics}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Edges</p>
                <p className="text-xl font-bold">{data.totalEdges}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Platforms</p>
                <p className="text-xl font-bold">{Object.keys(data.platformCounts).length}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Unresolved</p>
                <p className="text-xl font-bold text-orange-600">{run?.unresolvedCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metric Drift Summary */}
      {data.driftFindings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <CardTitle className="text-base">Metric Drift Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.driftFindings.map((drift) => (
                <div key={drift.id} className="p-3 rounded-lg border border-orange-200 bg-orange-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{drift.node}</span>
                    <Badge variant="destructive" className="text-xs">{drift.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{drift.title}</p>
                  {drift.evidence && typeof drift.evidence === 'object' && drift.evidence !== null && 'missingFilters' in (drift.evidence as Record<string, unknown>) && (
                    <div className="mt-2 text-xs">
                      <span className="font-medium">Missing filters: </span>
                      {((drift.evidence as Record<string, unknown>).missingFilters as string[])?.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Platform Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(data.platformCounts).map(([platform, count]) => (
              <div key={platform} className="p-4 bg-muted rounded-lg text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{platform}</p>
                <p className="text-2xl font-bold">{count as number}</p>
                <p className="text-xs text-muted-foreground">objects</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
