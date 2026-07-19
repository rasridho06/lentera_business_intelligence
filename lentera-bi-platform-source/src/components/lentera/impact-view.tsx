'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ArrowDown, ArrowUp, Database, GitBranch, BarChart3, LayoutDashboard, LineChart, Search, ChevronRight } from 'lucide-react';

interface ImpactData {
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

const typeIcons: Record<string, React.ReactNode> = {
  source: <Database className="h-4 w-4" />,
  model: <GitBranch className="h-4 w-4" />,
  dataset: <Database className="h-4 w-4" />,
  chart: <BarChart3 className="h-4 w-4" />,
  dashboard: <LayoutDashboard className="h-4 w-4" />,
  metric: <LineChart className="h-4 w-4" />,
  column: <Database className="h-4 w-4" />,
  filter: <AlertTriangle className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  source: 'bg-amber-50 text-amber-700 border-amber-200',
  model: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dataset: 'bg-sky-50 text-sky-700 border-sky-200',
  chart: 'bg-violet-50 text-violet-700 border-violet-200',
  dashboard: 'bg-rose-50 text-rose-700 border-rose-200',
  metric: 'bg-teal-50 text-teal-700 border-teal-200',
  column: 'bg-slate-50 text-slate-700 border-slate-200',
  filter: 'bg-pink-50 text-pink-700 border-pink-200',
};

interface SearchResult {
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

export function ImpactView({ data, onSearch }: { data: ImpactData | null; onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Impact Analysis — Search for an Asset</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search for a table, model, column, dataset, metric, chart, or dashboard to see downstream impact.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by name, qualified name, or owner..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => onSearch(r.id)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors flex items-center gap-3"
                >
                  <span className={`flex items-center justify-center h-7 w-7 rounded ${typeColors[r.type] || 'bg-gray-50'} border`}>
                    {typeIcons[r.type] || <Database className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{r.qualifiedName}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">{r.type.replace('_', ' ')}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impact Results */}
      {data && (
        <div className="space-y-4">
          {/* Source Node */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center h-10 w-10 rounded-lg ${typeColors[data.sourceNode.type] || 'bg-gray-50'} border`}>
                  {typeIcons[data.sourceNode.type] || <Database className="h-5 w-5" />}
                </span>
                <div>
                  <p className="font-semibold">{data.sourceNode.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{data.sourceNode.qualifiedName}</p>
                </div>
                <Badge variant="outline" className="capitalize ml-auto">{data.direction}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{data.totalAffected}</p>
                <p className="text-xs text-muted-foreground">Total Affected</p>
              </CardContent>
            </Card>
            {Object.entries(data.byType).map(([type, ids]) => (
              <Card key={type}>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{ids.length}</p>
                  <p className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}s</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Affected Assets List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Affected Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.affectedNodes.map(node => (
                  <div key={node.id} className={`flex items-center gap-3 p-3 rounded-lg border ${typeColors[node.type] || 'bg-gray-50'}`}>
                    <span className="shrink-0">{typeIcons[node.type] || <Database className="h-4 w-4" />}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{node.name}</p>
                      <p className="text-xs font-mono text-muted-foreground truncate">{node.qualifiedName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] capitalize">{node.type.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className="text-[10px]">{node.platform}</Badge>
                      {node.status === 'excluded' && <Badge variant="destructive" className="text-[10px]">Excluded</Badge>}
                      {node.status === 'active' && <Badge variant="secondary" className="text-[10px]">Active</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Confidence Summary */}
          {Object.keys(data.confidenceSummary).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Confidence Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(data.confidenceSummary).map(([conf, count]) => (
                    <div key={conf} className="flex items-center gap-2 text-sm">
                      <span className={`inline-block w-3 h-3 rounded-full ${
                        conf === 'verified' ? 'bg-green-500' :
                        conf === 'declared' ? 'bg-blue-500' :
                        conf === 'inferred' ? 'bg-yellow-500' :
                        conf === 'partial' ? 'bg-orange-500' : 'bg-gray-400'
                      }`}></span>
                      <span className="capitalize">{conf}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
