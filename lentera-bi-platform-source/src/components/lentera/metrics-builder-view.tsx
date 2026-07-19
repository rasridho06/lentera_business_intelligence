'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Plus, Trash2, Database, Code2, GitBranch, BarChart3,
  ArrowRight, Link2, Clock, Layers, FileCode, Terminal,
} from 'lucide-react';
import type { MetricSourceData, MetricData } from '@/types';

const roleColors: Record<string, string> = {
  measure: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dimension: 'bg-sky-50 text-sky-700 border-sky-200',
  filter: 'bg-orange-50 text-orange-700 border-orange-200',
  join_key: 'bg-violet-50 text-violet-700 border-violet-200',
  time_dimension: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const languageIcons: Record<string, React.ReactNode> = {
  sql: <Code2 className="h-4 w-4" />,
  python: <Terminal className="h-4 w-4" />,
};

const languageColors: Record<string, string> = {
  sql: 'bg-sky-50 text-sky-700',
  python: 'bg-amber-50 text-amber-700',
};

export function MetricsBuilderView() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newMetric, setNewMetric] = useState({
    name: '', description: '', expression: '', language: 'sql', aggregation: 'sum', timeGrain: 'day',
  });
  const [newSources, setNewSources] = useState<Array<{ tableName: string; columnName: string; role: string; schemaName: string }>>([
    { tableName: '', columnName: '', role: 'measure', schemaName: '' },
  ]);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/metric-defs');
    const data = await res.json();
    setMetrics(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadMetrics, 0);
    return () => clearTimeout(timer);
  }, [loadMetrics]);

  const handleCreate = async () => {
    await fetch('/api/metric-defs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newMetric,
        sources: newSources.filter(s => s.tableName),
      }),
    });
    setShowCreateDialog(false);
    loadMetrics();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/metric-defs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadMetrics();
  };

  const parseJson = (jsonStr: string | null) => {
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch { return null; }
  };

  const addSource = () => {
    setNewSources(prev => [...prev, { tableName: '', columnName: '', role: 'measure', schemaName: '' }]);
  };

  const removeSource = (index: number) => {
    setNewSources(prev => prev.filter((_, i) => i !== index));
  };

  const updateSource = (index: number, field: string, value: string) => {
    setNewSources(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const sqlMetrics = metrics.filter(m => m.language === 'sql');
  const pythonMetrics = metrics.filter(m => m.language === 'python');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Metrics</h2>
          <p className="text-sm text-muted-foreground">Define metrics from multiple tables and columns, using SQL or Python/ML</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> New Metric
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Metric</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Metric name" value={newMetric.name} onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))} />
                <Select value={newMetric.language} onValueChange={(v) => setNewMetric(prev => ({ ...prev, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sql"><Code2 className="h-3 w-3 mr-1 inline" /> SQL</SelectItem>
                    <SelectItem value="python"><Terminal className="h-3 w-3 mr-1 inline" /> Python / ML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Description" value={newMetric.description} onChange={(e) => setNewMetric(prev => ({ ...prev, description: e.target.value }))} />

              {newMetric.language === 'sql' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={newMetric.aggregation} onValueChange={(v) => setNewMetric(prev => ({ ...prev, aggregation: v }))}>
                      <SelectTrigger><SelectValue placeholder="Aggregation" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">SUM</SelectItem>
                        <SelectItem value="count">COUNT</SelectItem>
                        <SelectItem value="avg">AVG</SelectItem>
                        <SelectItem value="min">MIN</SelectItem>
                        <SelectItem value="max">MAX</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={newMetric.timeGrain} onValueChange={(v) => setNewMetric(prev => ({ ...prev, timeGrain: v }))}>
                      <SelectTrigger><SelectValue placeholder="Time grain" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hour">Hourly</SelectItem>
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="quarter">Quarterly</SelectItem>
                        <SelectItem value="year">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    placeholder="SQL Expression (e.g., SUM(price_cents) / 100)"
                    value={newMetric.expression}
                    onChange={(e) => setNewMetric(prev => ({ ...prev, expression: e.target.value }))}
                    className="font-mono text-sm"
                    rows={3}
                  />
                </>
              ) : (
                <Textarea
                  placeholder={`# Python / ML Script\nimport pandas as pd\nfrom sklearn.ensemble import RandomForestClassifier\n\n# Write your ML code here\n# Output: DataFrame with new columns`}
                  value={newMetric.expression}
                  onChange={(e) => setNewMetric(prev => ({ ...prev, expression: e.target.value }))}
                  className="font-mono text-sm"
                  rows={8}
                />
              )}

              {/* Cross-table sources */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Source Tables & Columns</label>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addSource}>
                    <Plus className="h-3 w-3 mr-1" /> Add Source
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">A single metric can pull columns from different tables — each with its own role</p>
                {newSources.map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Select value={source.role} onValueChange={(v) => updateSource(idx, 'role', v)}>
                      <SelectTrigger className="w-[120px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="measure">Measure</SelectItem>
                        <SelectItem value="dimension">Dimension</SelectItem>
                        <SelectItem value="filter">Filter</SelectItem>
                        <SelectItem value="join_key">Join Key</SelectItem>
                        <SelectItem value="time_dimension">Time Dim</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="schema.table" className="h-7 text-xs flex-1" value={source.schemaName} onChange={(e) => updateSource(idx, 'schemaName', e.target.value)} />
                    <Input placeholder="column" className="h-7 text-xs w-28" value={source.columnName} onChange={(e) => updateSource(idx, 'columnName', e.target.value)} />
                    <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => removeSource(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newMetric.name} className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <Tabs defaultValue="sql">
          <TabsList>
            <TabsTrigger value="sql">
              <Code2 className="h-3 w-3 mr-1" /> SQL Metrics ({sqlMetrics.length})
            </TabsTrigger>
            <TabsTrigger value="python">
              <Terminal className="h-3 w-3 mr-1" /> Python / ML ({pythonMetrics.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sql" className="mt-4 space-y-4">
            {sqlMetrics.map(metric => (
              <MetricCard key={metric.id} metric={metric} onDelete={handleDelete} />
            ))}
          </TabsContent>

          <TabsContent value="python" className="mt-4 space-y-4">
            {pythonMetrics.map(metric => (
              <MetricCard key={metric.id} metric={metric} onDelete={handleDelete} />
            ))}
            {pythonMetrics.length === 0 && (
              <div className="text-center py-12">
                <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No Python/ML metrics yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create a Python metric to use ML models for generating predictions and new columns</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function MetricCard({ metric, onDelete }: { metric: MetricData; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const langConfig = languageColors[metric.language];
  const chevronIcon = expanded ? <ChevronDown /> : <ChevronRight />;

  return (
    <Card className="overflow-hidden">
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${langConfig}`}>
                {languageIcons[metric.language]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{metric.name}</span>
                  <Badge variant="outline" className="text-[9px]">v{metric.version}</Badge>
                  <Badge variant={metric.status === 'published' ? 'secondary' : 'outline'} className="text-[9px]">{metric.status}</Badge>
                  {metric.aggregation && <Badge variant="outline" className="text-[9px] uppercase">{metric.aggregation}</Badge>}
                </div>
                {metric.description && <p className="text-xs text-muted-foreground mt-0.5">{metric.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {metric.metricSources.length > 0 && (
                <Badge variant="outline" className="text-[9px]">
                  <Layers className="h-2.5 w-2.5 mr-0.5" /> {metric.metricSources.length} sources
                </Badge>
              )}
              {metric.chartMetrics.length > 0 && (
                <Badge variant="outline" className="text-[9px]">
                  <BarChart3 className="h-2.5 w-2.5 mr-0.5" /> {metric.chartMetrics.length} charts
                </Badge>
              )}
                            {chevronIcon}
            </div>
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 p-4 space-y-4">
          {/* Expression / Code */}
          {metric.expression && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {metric.language === 'sql' ? 'SQL Expression' : 'Python / ML Script'}
              </p>
              <pre className="text-xs font-mono bg-black/5 rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                {metric.expression}
              </pre>
            </div>
          )}

          {/* Cross-table sources lineage */}
          {metric.metricSources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Source Lineage (cross-table)</p>
              <div className="space-y-1.5">
                {metric.metricSources.map(source => (
                  <div key={source.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-white border">
                    <Badge className={`text-[9px] ${roleColors[source.role] || ''}`}>
                      {source.role.replace('_', ' ')}
                    </Badge>
                    <span className="font-mono">{source.schemaName ? `${source.schemaName}.` : ''}{source.tableName}</span>
                    {source.columnName && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <code className="bg-muted px-1 rounded">{source.columnName}</code>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Used by charts */}
          {metric.chartMetrics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Used by Charts</p>
              <div className="flex flex-wrap gap-1">
                {metric.chartMetrics.map(cm => (
                  <Badge key={cm.id} variant="outline" className="text-[9px]">
                    <BarChart3 className="h-2.5 w-2.5 mr-0.5" /> {cm.chart.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" /> {metric.branch}
              {metric.timeGrain && <><Clock className="h-3 w-3" /> {metric.timeGrain}</>}
            </div>
            <Button variant="outline" size="sm" className="h-6 text-xs text-destructive" onClick={() => onDelete(metric.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// Inline icons to avoid import issues
const ChevronDown = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const ChevronRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
