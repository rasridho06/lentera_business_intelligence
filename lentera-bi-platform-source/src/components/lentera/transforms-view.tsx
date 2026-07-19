'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Code2, Terminal, Plus, Trash2, Play, Clock, CheckCircle, XCircle,
  AlertCircle, Database, ArrowRight, FileOutput, GitBranch,
  RefreshCw, Loader2, Wrench,
} from 'lucide-react';

interface TransformData {
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

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  success: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600' },
  failed: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600' },
  running: { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-amber-600' },
};

export function TransformsView() {
  const [transforms, setTransforms] = useState<TransformData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newTransform, setNewTransform] = useState({
    name: '', description: '', type: 'sql', code: '',
    schedule: 'manual',
  });

  const loadTransforms = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/transforms');
    const data = await res.json();
    setTransforms(data);
    setLoading(false);
  }, []);

  // Load on mount
  const [initTransforms] = useState(() => {
    setTimeout(() => { loadTransforms(); }, 0);
    return true;
  });
  void initTransforms;

  const handleCreate = async () => {
    await fetch('/api/transforms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTransform),
    });
    setShowCreateDialog(false);
    setNewTransform({ name: '', description: '', type: 'sql', code: '', schedule: 'manual' });
    loadTransforms();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/transforms?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadTransforms();
  };

  const handleRun = async (id: string) => {
    await fetch('/api/transforms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, lastRunStatus: 'running' }),
    });
    loadTransforms();
    // Simulate run completion
    setTimeout(async () => {
      await fetch('/api/transforms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lastRunStatus: 'success', lastRunAt: new Date().toISOString() }),
      });
      loadTransforms();
    }, 3000);
  };

  const parseJson = (jsonStr: string | null) => {
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch { return null; }
  };

  const sqlTransforms = transforms.filter(t => t.type === 'sql');
  const pythonTransforms = transforms.filter(t => t.type === 'python');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Transforms</h2>
          <p className="text-sm text-muted-foreground">Build SQL queries and Python/ML scripts to generate new tables and columns</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> New Transform
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Transform</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Transform name" value={newTransform.name} onChange={(e) => setNewTransform(prev => ({ ...prev, name: e.target.value }))} />
                <Select value={newTransform.type} onValueChange={(v) => setNewTransform(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sql"><Code2 className="h-3 w-3 mr-1 inline" /> SQL</SelectItem>
                    <SelectItem value="python"><Terminal className="h-3 w-3 mr-1 inline" /> Python / ML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Description" value={newTransform.description} onChange={(e) => setNewTransform(prev => ({ ...prev, description: e.target.value }))} />

              {newTransform.type === 'sql' ? (
                <Textarea
                  placeholder="-- Write your SQL transform here&#10;SELECT ...&#10;FROM source_table&#10;WHERE ..."
                  value={newTransform.code}
                  onChange={(e) => setNewTransform(prev => ({ ...prev, code: e.target.value }))}
                  className="font-mono text-sm min-h-[200px]"
                />
              ) : (
                <Textarea
                  placeholder={`# Python / ML Transform\nimport pandas as pd\nfrom sklearn.ensemble import RandomForestClassifier\n\n# Your ML pipeline here\n# Output will be written to the specified output table`}
                  value={newTransform.code}
                  onChange={(e) => setNewTransform(prev => ({ ...prev, code: e.target.value }))}
                  className="font-mono text-sm min-h-[200px]"
                />
              )}

              <Select value={newTransform.schedule} onValueChange={(v) => setNewTransform(prev => ({ ...prev, schedule: v }))}>
                <SelectTrigger><SelectValue placeholder="Schedule" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="0 * * * *">Hourly</SelectItem>
                  <SelectItem value="0 2 * * *">Daily at 2 AM</SelectItem>
                  <SelectItem value="0 3 * * 0">Weekly (Sunday 3 AM)</SelectItem>
                  <SelectItem value="0 0 1 * *">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTransform.name || !newTransform.code} className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
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
            <TabsTrigger value="sql"><Code2 className="h-3 w-3 mr-1" /> SQL Transforms ({sqlTransforms.length})</TabsTrigger>
            <TabsTrigger value="python"><Terminal className="h-3 w-3 mr-1" /> Python / ML ({pythonTransforms.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sql" className="mt-4 space-y-4">
            {sqlTransforms.map(t => <TransformCard key={t.id} transform={t} expanded={expandedId === t.id} onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)} onRun={handleRun} onDelete={handleDelete} />)}
          </TabsContent>

          <TabsContent value="python" className="mt-4 space-y-4">
            {pythonTransforms.map(t => <TransformCard key={t.id} transform={t} expanded={expandedId === t.id} onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)} onRun={handleRun} onDelete={handleDelete} />)}
            {pythonTransforms.length === 0 && (
              <div className="text-center py-12">
                <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No Python/ML transforms yet</p>
                <p className="text-sm text-muted-foreground mt-1">Use Python with scikit-learn, pandas, or any ML library to generate new tables and columns</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function TransformCard({ transform, expanded, onToggle, onRun, onDelete }: {
  transform: TransformData;
  expanded: boolean;
  onToggle: () => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const runStatus = statusConfig[transform.lastRunStatus || ''] || statusConfig.running;
  const inputTables = transform.inputTables ? JSON.parse(transform.inputTables) : [];
  const outputSpec = transform.outputSpec ? JSON.parse(transform.outputSpec) : null;
  const environment = transform.environment ? JSON.parse(transform.environment) : null;

  return (
    <Card className="overflow-hidden">
      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center h-9 w-9 rounded-lg ${transform.type === 'sql' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
              {transform.type === 'sql' ? <Code2 className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{transform.name}</span>
                <Badge variant="outline" className="text-[9px]">{transform.type.toUpperCase()}</Badge>
                <Badge variant={transform.status === 'published' ? 'secondary' : 'outline'} className="text-[9px]">{transform.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{transform.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {transform.lastRunStatus && (
              <Badge variant="outline" className="text-[9px]">
                <span className={runStatus.color}>{runStatus.icon}</span>
                <span className="ml-1">{transform.lastRunStatus}</span>
              </Badge>
            )}
            {transform.schedule && transform.schedule !== 'manual' && (
              <Badge variant="outline" className="text-[9px]">
                <Clock className="h-2.5 w-2.5 mr-0.5" /> {transform.schedule}
              </Badge>
            )}
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 p-4 space-y-4">
          {/* Code */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {transform.type === 'sql' ? 'SQL Query' : 'Python / ML Script'}
            </p>
            <pre className="text-xs font-mono bg-black/5 rounded-lg p-3 max-h-80 overflow-auto whitespace-pre-wrap border">
              {transform.code}
            </pre>
          </div>

          {/* Input → Output Lineage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Tables */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Input Tables (READS_FROM)</p>
              <div className="space-y-1.5">
                {inputTables.map((t: { connectorId?: string; schema?: string; table: string }, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-white border">
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{t.schema ? `${t.schema}.` : ''}{t.table}</span>
                  </div>
                ))}
                {inputTables.length === 0 && <p className="text-xs text-muted-foreground">No input tables defined</p>}
              </div>
            </div>

            {/* Output Spec */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Output (WRITES_TO)</p>
              {outputSpec ? (
                <div className="p-2 rounded-lg bg-white border">
                  <div className="flex items-center gap-2 text-xs mb-2">
                    <FileOutput className="h-3 w-3 text-emerald-600" />
                    <span className="font-mono font-medium">{outputSpec.schema}.{outputSpec.table}</span>
                    <Badge variant="outline" className="text-[9px]">{outputSpec.type}</Badge>
                  </div>
                  {outputSpec.columns && (
                    <div className="flex flex-wrap gap-1">
                      {outputSpec.columns.map((col: string, i: number) => (
                        <code key={i} className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{col}</code>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No output spec defined</p>
              )}
            </div>
          </div>

          {/* Environment (Python) */}
          {environment && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Runtime Environment</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[9px]">Python {environment.python}</Badge>
                {environment.packages?.map((pkg: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[9px]">{pkg}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); onRun(transform.id); }} disabled={transform.lastRunStatus === 'running'}>
                {transform.lastRunStatus === 'running' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                {transform.lastRunStatus === 'running' ? 'Running...' : 'Run Now'}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Wrench className="h-3 w-3 mr-1" /> Edit
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" /> {transform.branch}
              {transform.lastRunAt && <span>Last run: {new Date(transform.lastRunAt).toLocaleString()}</span>}
              <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(transform.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ChevronDownIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
}
function ChevronRightIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
}
