'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Database, Plus, Trash2, Code2, Terminal, Play, Clock,
  CheckCircle, XCircle, Loader2, GitBranch, Table2, Layers,
  FileCode, ArrowRight, Link2,
} from 'lucide-react';
import type { DatasetData } from '@/types';

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  virtual: { icon: <Layers className="h-4 w-4" />, color: 'text-sky-700', bg: 'bg-sky-50', label: 'Virtual' },
  physical: { icon: <Database className="h-4 w-4" />, color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Physical' },
  python_generated: { icon: <Terminal className="h-4 w-4" />, color: 'text-amber-700', bg: 'bg-amber-50', label: 'Python/ML' },
};

const languageColors: Record<string, string> = {
  sql: 'bg-sky-50 text-sky-700',
  python: 'bg-amber-50 text-amber-700',
};

export function DatasetsView() {
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newDataset, setNewDataset] = useState({
    name: '', description: '', type: 'virtual', language: 'sql', code: '', connectorId: '', schedule: 'manual',
  });
  const [newColumns, setNewColumns] = useState<Array<{ name: string; type: string; description: string }>>([
    { name: '', type: 'VARCHAR', description: '' },
  ]);
  const [newSourceTables, setNewSourceTables] = useState<Array<{ connectorId: string; schema: string; table: string }>>([
    { connectorId: '', schema: '', table: '' },
  ]);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/datasets');
    const data = await res.json();
    setDatasets(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadDatasets, 0);
    return () => clearTimeout(timer);
  }, [loadDatasets]);

  const handleCreate = async () => {
    await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newDataset,
        outputColumns: newColumns.filter(c => c.name),
        sourceTables: newSourceTables.filter(s => s.table),
      }),
    });
    setShowCreateDialog(false);
    setNewDataset({ name: '', description: '', type: 'virtual', language: 'sql', code: '', connectorId: '', schedule: 'manual' });
    setNewColumns([{ name: '', type: 'VARCHAR', description: '' }]);
    setNewSourceTables([{ connectorId: '', schema: '', table: '' }]);
    loadDatasets();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/datasets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadDatasets();
  };

  const handleRun = async (id: string) => {
    await fetch('/api/datasets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, lastRunStatus: 'running' }),
    });
    loadDatasets();
    setTimeout(async () => {
      await fetch('/api/datasets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lastRunStatus: 'success', lastRunAt: new Date().toISOString() }),
      });
      loadDatasets();
    }, 3000);
  };

  const addColumn = () => setNewColumns(prev => [...prev, { name: '', type: 'VARCHAR', description: '' }]);
  const removeColumn = (i: number) => setNewColumns(prev => prev.filter((_, idx) => idx !== i));
  const updateColumn = (i: number, field: string, value: string) =>
    setNewColumns(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  const addSourceTable = () => setNewSourceTables(prev => [...prev, { connectorId: '', schema: '', table: '' }]);
  const removeSourceTable = (i: number) => setNewSourceTables(prev => prev.filter((_, idx) => idx !== i));
  const updateSourceTable = (i: number, field: string, value: string) =>
    setNewSourceTables(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  const parseJson = (jsonStr: string | null) => {
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch { return null; }
  };

  const sqlDatasets = datasets.filter(d => d.language === 'sql');
  const pythonDatasets = datasets.filter(d => d.language === 'python');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Datasets</h2>
          <p className="text-sm text-muted-foreground">Create virtual datasets by querying across imported tables or generate tables with Python scripts</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> New Dataset
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Dataset</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Dataset name" value={newDataset.name} onChange={(e) => setNewDataset(prev => ({ ...prev, name: e.target.value }))} />
                <Select value={newDataset.type} onValueChange={(v) => {
                  setNewDataset(prev => ({ ...prev, type: v, language: v === 'python_generated' ? 'python' : 'sql' }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="virtual"><Layers className="h-3 w-3 mr-1 inline" /> Virtual Dataset (SQL)</SelectItem>
                    <SelectItem value="python_generated"><Terminal className="h-3 w-3 mr-1 inline" /> Python/ML Generated</SelectItem>
                    <SelectItem value="physical"><Database className="h-3 w-3 mr-1 inline" /> Physical Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Description" value={newDataset.description} onChange={(e) => setNewDataset(prev => ({ ...prev, description: e.target.value }))} />

              {newDataset.type !== 'python_generated' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">SQL Query</label>
                  <Textarea
                    placeholder={`-- Write SQL to query across imported tables\nSELECT \n  r.user_id,\n  r.price_cents,\n  u.name as user_name\nFROM booking_production.reservations r\nJOIN public.users u ON r.user_id = u.id\nWHERE r.active = 1`}
                    value={newDataset.code}
                    onChange={(e) => setNewDataset(prev => ({ ...prev, code: e.target.value }))}
                    className="font-mono text-sm min-h-[180px]"
                  />
                  <p className="text-xs text-muted-foreground">Query across any imported tables from different connectors — joins, unions, CTEs all supported</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Python Script</label>
                  <Textarea
                    placeholder={`# Python script to generate a new table\nimport pandas as pd\nfrom sklearn.ensemble import RandomForestClassifier\n\n# Read from imported tables\ndf_reservations = read_table("booking_production.reservations")\ndf_users = read_table("public.users")\n\n# Process & generate new columns\ndf = pd.merge(df_reservations, df_users, on="user_id")\ndf["is_churned"] = (df["days_since_last"] > 90).astype(int)\n\n# Output: this DataFrame becomes the dataset\noutput = df[["user_id", "is_churned", "churn_score"]]`}
                    value={newDataset.code}
                    onChange={(e) => setNewDataset(prev => ({ ...prev, code: e.target.value }))}
                    className="font-mono text-sm min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">Use Python with pandas, scikit-learn, or any ML library to create new tables and columns</p>
                </div>
              )}

              {/* Source Tables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Source Tables (referenced)</label>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addSourceTable}>
                    <Plus className="h-3 w-3 mr-1" /> Add Source
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">List the tables this dataset queries against — used for lineage tracking</p>
                {newSourceTables.map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Input placeholder="schema" className="h-7 text-xs w-24" value={source.schema} onChange={(e) => updateSourceTable(idx, 'schema', e.target.value)} />
                    <Input placeholder="table name" className="h-7 text-xs flex-1" value={source.table} onChange={(e) => updateSourceTable(idx, 'table', e.target.value)} />
                    <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => removeSourceTable(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Output Columns */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Output Columns</label>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={addColumn}>
                    <Plus className="h-3 w-3 mr-1" /> Add Column
                  </Button>
                </div>
                {newColumns.map((col, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Input placeholder="column name" className="h-7 text-xs flex-1" value={col.name} onChange={(e) => updateColumn(idx, 'name', e.target.value)} />
                    <Select value={col.type} onValueChange={(v) => updateColumn(idx, 'type', v)}>
                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VARCHAR">String</SelectItem>
                        <SelectItem value="INTEGER">Integer</SelectItem>
                        <SelectItem value="DOUBLE">Float</SelectItem>
                        <SelectItem value="DATE">Date</SelectItem>
                        <SelectItem value="TIMESTAMP">Timestamp</SelectItem>
                        <SelectItem value="BOOLEAN">Boolean</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="description" className="h-7 text-xs w-32" value={col.description} onChange={(e) => updateColumn(idx, 'description', e.target.value)} />
                    <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => removeColumn(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Schedule */}
              <Select value={newDataset.schedule} onValueChange={(v) => setNewDataset(prev => ({ ...prev, schedule: v }))}>
                <SelectTrigger><SelectValue placeholder="Schedule" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="0 * * * *">Hourly</SelectItem>
                  <SelectItem value="0 2 * * *">Daily at 2 AM</SelectItem>
                  <SelectItem value="0 3 * * 0">Weekly</SelectItem>
                  <SelectItem value="0 0 1 * *">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newDataset.name} className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
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
            <TabsTrigger value="sql"><Code2 className="h-3 w-3 mr-1" /> SQL Datasets ({sqlDatasets.length})</TabsTrigger>
            <TabsTrigger value="python"><Terminal className="h-3 w-3 mr-1" /> Python/ML ({pythonDatasets.length})</TabsTrigger>
            <TabsTrigger value="all"><Database className="h-3 w-3 mr-1" /> All ({datasets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sql" className="mt-4 space-y-4">
            {sqlDatasets.map(d => <DatasetCard key={d.id} dataset={d} expanded={expandedId === d.id} onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)} onRun={handleRun} onDelete={handleDelete} parseJson={parseJson} />)}
            {sqlDatasets.length === 0 && <EmptyState type="sql" />}
          </TabsContent>

          <TabsContent value="python" className="mt-4 space-y-4">
            {pythonDatasets.map(d => <DatasetCard key={d.id} dataset={d} expanded={expandedId === d.id} onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)} onRun={handleRun} onDelete={handleDelete} parseJson={parseJson} />)}
            {pythonDatasets.length === 0 && <EmptyState type="python" />}
          </TabsContent>

          <TabsContent value="all" className="mt-4 space-y-4">
            {datasets.map(d => <DatasetCard key={d.id} dataset={d} expanded={expandedId === d.id} onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)} onRun={handleRun} onDelete={handleDelete} parseJson={parseJson} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="text-center py-12">
      {type === 'python' ? (
        <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      ) : (
        <Code2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      )}
      <p className="text-muted-foreground">No {type} datasets yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        {type === 'python'
          ? 'Create a Python/ML dataset to generate tables using scripts and ML models'
          : 'Create a SQL virtual dataset to query across imported tables'}
      </p>
    </div>
  );
}

function DatasetCard({ dataset, expanded, onToggle, onRun, onDelete, parseJson }: {
  dataset: DatasetData;
  expanded: boolean;
  onToggle: () => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  parseJson: (s: string | null) => unknown;
}) {
  const tConfig = typeConfig[dataset.type] || typeConfig.virtual;
  const sourceTables = parseJson(dataset.sourceTables) as Array<{ connectorId?: string; schema?: string; table: string }> | null;
  const outputColumns = parseJson(dataset.outputColumns) as Array<{ name: string; type: string; description?: string }> | null;
  const isRunning = dataset.lastRunStatus === 'running';

  return (
    <Card className="overflow-hidden">
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${tConfig.bg} ${tConfig.color}`}>
              {tConfig.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{dataset.name}</span>
                <Badge variant="outline" className="text-[9px]">{tConfig.label}</Badge>
                <Badge className={`text-[9px] ${languageColors[dataset.language] || ''}`}>
                  {dataset.language.toUpperCase()}
                </Badge>
                <Badge variant={dataset.status === 'published' ? 'secondary' : 'outline'} className="text-[9px]">{dataset.status}</Badge>
              </div>
              {dataset.description && <p className="text-xs text-muted-foreground mt-0.5">{dataset.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dataset.lastRunStatus && (
              <Badge variant="outline" className="text-[9px]">
                {dataset.lastRunStatus === 'success' ? <CheckCircle className="h-2.5 w-2.5 text-green-600 mr-0.5" /> :
                 dataset.lastRunStatus === 'failed' ? <XCircle className="h-2.5 w-2.5 text-red-600 mr-0.5" /> :
                 <Loader2 className="h-2.5 w-2.5 text-amber-600 mr-0.5 animate-spin" />}
                {dataset.lastRunStatus}
              </Badge>
            )}
            {outputColumns && (
              <Badge variant="outline" className="text-[9px]">
                <Table2 className="h-2.5 w-2.5 mr-0.5" /> {outputColumns.length} cols
              </Badge>
            )}
            {expanded ? <ChevronDownSvg /> : <ChevronRightSvg />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 p-4 space-y-4">
          {/* Code */}
          {dataset.code && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {dataset.language === 'sql' ? 'SQL Query' : 'Python Script'}
              </p>
              <pre className="text-xs font-mono bg-black/5 rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap border">
                {dataset.code}
              </pre>
            </div>
          )}

          {/* Source Tables → Output Columns Lineage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Source Tables (READS_FROM)</p>
              <div className="space-y-1.5">
                {sourceTables && sourceTables.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-white border">
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{t.schema ? `${t.schema}.` : ''}{t.table}</span>
                  </div>
                ))}
                {(!sourceTables || sourceTables.length === 0) && <p className="text-xs text-muted-foreground">No source tables defined</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Output Columns</p>
              <div className="space-y-1.5">
                {outputColumns && outputColumns.map((col, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-white border">
                    <code className="font-mono font-medium text-emerald-700">{col.name}</code>
                    <Badge variant="outline" className="text-[8px]">{col.type}</Badge>
                    {col.description && <span className="text-muted-foreground ml-auto">{col.description}</span>}
                  </div>
                ))}
                {(!outputColumns || outputColumns.length === 0) && <p className="text-xs text-muted-foreground">No output columns defined</p>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); onRun(dataset.id); }} disabled={isRunning}>
                {isRunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                {isRunning ? 'Running...' : 'Run Now'}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <FileCode className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" /> {dataset.branch}
              {dataset.lastRunAt && <span>Last run: {new Date(dataset.lastRunAt).toLocaleString()}</span>}
              <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(dataset.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ChevronDownSvg() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
}
function ChevronRightSvg() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
