'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, TrendingDown, ArrowRight } from 'lucide-react';

interface MetricsData {
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

export function MetricsView({ data }: { data: MetricsData }) {
  return (
    <div className="space-y-6">
      {/* Canonical Metric Registry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Canonical Metric Registry</CardTitle>
          <p className="text-sm text-muted-foreground">
            Version-controlled metric definitions that serve as the source of truth for business calculations.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.canonicalMetrics.map(cm => (
            <div key={cm.id} className="p-4 rounded-lg border bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{cm.name}</code>
                  <Badge variant="outline" className="text-[10px]">v{cm.version}</Badge>
                  {cm.aliases.length > 0 && (
                    <span className="text-xs text-muted-foreground">a.k.a. {cm.aliases.join(', ')}</span>
                  )}
                </div>
                <Badge variant={cm.severityOnDrift === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                  Drift: {cm.severityOnDrift}
                </Badge>
              </div>
              {cm.description && <p className="text-sm text-muted-foreground mb-3">{cm.description}</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {cm.expression && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Expression</p>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cm.expression}</code>
                  </div>
                )}
                {cm.aggregation && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Aggregation</p>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded uppercase">{cm.aggregation}</code>
                  </div>
                )}
                {cm.owner && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Owner</p>
                    <span className="text-xs">{cm.owner}</span>
                  </div>
                )}
                {cm.currencyRequirement && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Currency Dimension</p>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cm.currencyRequirement}</code>
                  </div>
                )}
                {cm.timeGrain && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Time Grain</p>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cm.timeGrain}</code>
                  </div>
                )}
              </div>
              {cm.requiredFilters.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Required Filters</p>
                  <div className="flex flex-wrap gap-1">
                    {cm.requiredFilters.map((f, i) => (
                      <code key={i} className="text-[11px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">{f}</code>
                    ))}
                  </div>
                </div>
              )}
              {cm.dimensions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Dimensions</p>
                  <div className="flex flex-wrap gap-1">
                    {cm.dimensions.map((d, i) => (
                      <code key={i} className="text-[11px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200">{d}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Drift Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-orange-600" />
            <CardTitle className="text-base">Observed vs Canonical Comparison</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Comparing observed Superset metrics against canonical definitions to detect drift.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.comparisons.map(comp => (
            <div key={comp.canonical.id} className={`p-4 rounded-lg border ${
              comp.driftStatus === 'potential_drift' ? 'border-orange-300 bg-orange-50' :
              comp.driftStatus === 'unmapped' ? 'border-red-300 bg-red-50' :
              'border-green-300 bg-green-50'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono font-bold text-sm">{comp.canonical.name}</span>
                <Badge variant={comp.driftStatus === 'potential_drift' ? 'destructive' : comp.driftStatus === 'unmapped' ? 'destructive' : 'secondary'} className="text-xs">
                  {comp.driftStatus === 'potential_drift' ? 'Potential Drift' : comp.driftStatus === 'unmapped' ? 'No Match' : 'Matched'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Canonical */}
                <div className="p-3 bg-white rounded-lg border">
                  <p className="text-xs font-medium text-emerald-700 mb-2">Canonical Definition</p>
                  <div className="space-y-1.5 text-xs">
                    {comp.canonical.expression && (
                      <div><span className="text-muted-foreground">Expression:</span> <code className="bg-emerald-50 px-1 rounded">{comp.canonical.expression}</code></div>
                    )}
                    {comp.canonical.aggregation && (
                      <div><span className="text-muted-foreground">Aggregation:</span> <code className="uppercase">{comp.canonical.aggregation}</code></div>
                    )}
                    {comp.canonical.requiredFilters.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Filters ({comp.canonical.requiredFilters.length}):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {comp.canonical.requiredFilters.map((f, i) => (
                            <code key={i} className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-200">{f}</code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Observed */}
                <div className="p-3 bg-white rounded-lg border">
                  <p className="text-xs font-medium text-violet-700 mb-2">Observed in Superset</p>
                  {comp.observed.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No matching observed metric found.</p>
                  ) : (
                    comp.observed.map(obs => (
                      <div key={obs.id} className="space-y-1.5 text-xs mb-2 last:mb-0">
                        <div><span className="text-muted-foreground">Name:</span> <strong>{obs.name}</strong></div>
                        <div><span className="text-muted-foreground">Qualified:</span> <code>{obs.qualifiedName}</code></div>
                        {obs.metadata?.expression && (
                          <div><span className="text-muted-foreground">Expression:</span> <code className="bg-violet-50 px-1 rounded">{obs.metadata.expression as string}</code></div>
                        )}
                        {obs.metadata?.aggregation && (
                          <div><span className="text-muted-foreground">Aggregation:</span> <code className="uppercase">{obs.metadata.aggregation as string}</code></div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Drift details */}
              {comp.driftStatus === 'potential_drift' && comp.observed.length > 0 && (
                <div className="mt-3 p-2 bg-orange-100 rounded text-xs">
                  <div className="flex items-center gap-1 font-medium text-orange-800">
                    <AlertTriangle className="h-3 w-3" />
                    Filter mismatch detected — observed metric may be missing canonical filters
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* All Observed Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Observed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.observedMetrics.map(om => (
              <div key={om.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors">
                <div>
                  <p className="text-sm font-medium">{om.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{om.qualifiedName}</p>
                </div>
                <div className="flex items-center gap-2">
                  {om.owner && <Badge variant="outline" className="text-[10px]">{om.owner}</Badge>}
                  <Badge variant="outline" className="text-[10px]">superset</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
