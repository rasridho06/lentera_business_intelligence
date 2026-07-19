'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LayoutDashboard, Plus, BarChart3, LineChart, PieChart, GitBranch,
  Users, Lock, Unlock, Save, Eye, Edit3, Trash2, GripVertical, Maximize2,
  ArrowRight, Clock, CheckCircle, AlertTriangle, GitMerge,
} from 'lucide-react';

interface ChartData {
  id: string;
  name: string;
  chartType: string;
  status: string;
  config: string | null;
  chartMetrics: Array<{ id: string; metricId: string; metric: { id: string; name: string; expression: string | null } }>;
}

interface DashboardData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isPublic: boolean;
  branch: string;
  layout: string | null;
  charts: ChartData[];
}

interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  dashboardId: string;
  x: number;
  y: number;
  activeChartId: string | null;
}

const chartTypeIcons: Record<string, React.ReactNode> = {
  bar: <BarChart3 className="h-4 w-4" />,
  line: <LineChart className="h-4 w-4" />,
  pie: <PieChart className="h-4 w-4" />,
  area: <LineChart className="h-4 w-4" />,
  metric_card: <LayoutDashboard className="h-4 w-4" />,
  table: <LayoutDashboard className="h-4 w-4" />,
};

const chartTypeColors: Record<string, string> = {
  bar: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  line: 'bg-sky-50 text-sky-700 border-sky-200',
  pie: 'bg-violet-50 text-violet-700 border-violet-200',
  area: 'bg-amber-50 text-amber-700 border-amber-200',
  metric_card: 'bg-rose-50 text-rose-700 border-rose-200',
  table: 'bg-gray-50 text-gray-700 border-gray-200',
};

// Fake user cursors for demo
const demoUsers: UserPresence[] = [
  { userId: 'u1', userName: 'Maya Sari', userColor: '#dc2626', dashboardId: 'dash-sales', x: 320, y: 150, activeChartId: 'chart-gmv-trend' },
  { userId: 'u2', userName: 'Budi Santoso', userColor: '#7c3aed', dashboardId: 'dash-sales', x: 580, y: 280, activeChartId: null },
];

export function DashboardsView() {
  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardData | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDashboard, setNewDashboard] = useState({ name: '', description: '' });
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [editLocks, setEditLocks] = useState<Record<string, string>>({});
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('view');

  const loadDashboards = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/dashboards');
    const data = await res.json();
    setDashboards(data);
    setLoading(false);
  }, []);

  // Load on mount
  const [initDashboards] = useState(() => {
    setTimeout(() => { loadDashboards(); }, 0);
    return true;
  });
  void initDashboards;

  // Simulate collaborative cursors when viewing a dashboard
  useEffect(() => {
    if (!selectedDashboard) return;
    const interval = setInterval(() => {
      setActiveUsers(prev => {
        if (prev.length === 0) return demoUsers.filter(u => u.dashboardId === selectedDashboard.id);
        return prev.map(u => ({
          ...u,
          x: Math.max(0, u.x + (Math.random() - 0.5) * 30),
          y: Math.max(0, u.y + (Math.random() - 0.5) * 20),
        }));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedDashboard]);

  const handleCreate = async () => {
    await fetch('/api/dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDashboard),
    });
    setShowCreateDialog(false);
    setNewDashboard({ name: '', description: '' });
    loadDashboards();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/dashboards?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (selectedDashboard?.id === id) setSelectedDashboard(null);
    loadDashboards();
  };

  const parseConfig = (config: string | null) => {
    if (!config) return null;
    try { return JSON.parse(config); } catch { return null; }
  };

  // If a dashboard is selected, show its detail view
  if (selectedDashboard) {
    const dash = selectedDashboard;

    return (
      <div className="space-y-4">
        {/* Dashboard Header with Collaboration */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedDashboard(null)}>
              ← Back
            </Button>
            <LayoutDashboard className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-xl font-bold">{dash.name}</h2>
              <p className="text-sm text-muted-foreground">{dash.description}</p>
            </div>
            <Badge variant="outline" className="text-xs">{dash.status}</Badge>
            <Badge variant="outline" className="text-xs">
              <GitBranch className="h-3 w-3 mr-1" /> {dash.branch}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Active Users (collaboration) */}
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-1 mr-2">
                {activeUsers.map(user => (
                  <div key={user.userId} className="relative group">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2"
                      style={{ backgroundColor: user.userColor, borderColor: user.userColor }}
                      title={user.userName}
                    >
                      {user.userName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      {user.userName}
                    </div>
                  </div>
                ))}
                <span className="text-xs text-muted-foreground ml-1">{activeUsers.length} editing</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowBranchDialog(true)}>
              <GitBranch className="h-3 w-3 mr-1" /> Branch
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowMergeDialog(true)}>
              <GitMerge className="h-3 w-3 mr-1" /> Merge Request
            </Button>
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>

        {/* Live cursors overlay (simulated) */}
        <div className="relative">
          {activeUsers.map(user => (
            <div
              key={user.userId}
              className="pointer-events-none absolute z-50 transition-all duration-500 ease-linear"
              style={{ left: user.x, top: user.y }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M0 0L16 6L8 8L6 16L0 0Z" fill={user.userColor} />
              </svg>
              <span
                className="text-[9px] px-1 py-0.5 rounded text-white ml-3 -mt-1 whitespace-nowrap"
                style={{ backgroundColor: user.userColor }}
              >
                {user.userName}
              </span>
            </div>
          ))}
        </div>

        {/* Tabs for View/Edit/Branches */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="view"><Eye className="h-3 w-3 mr-1" /> View</TabsTrigger>
            <TabsTrigger value="edit"><Edit3 className="h-3 w-3 mr-1" /> Edit</TabsTrigger>
            <TabsTrigger value="branches"><GitBranch className="h-3 w-3 mr-1" /> Branches</TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="mt-4">
            {/* Chart Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dash.charts.map(chart => {
                const config = parseConfig(chart.config);
                const isLocked = editLocks[chart.id];
                const lockedBy = activeUsers.find(u => u.activeChartId === chart.id);

                return (
                  <Card key={chart.id} className={`relative group ${isLocked ? 'ring-2 ring-orange-300' : ''}`}>
                    {lockedBy && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-orange-100 text-orange-800 text-[9px] px-1.5 py-0.5 rounded">
                        <Lock className="h-2.5 w-2.5" />
                        {lockedBy.userName}
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={chartTypeColors[chart.chartType] || 'bg-gray-50'}>
                            <Badge variant="outline" className="text-[9px] capitalize">
                              {chartTypeIcons[chart.chartType]} {chart.chartType}
                            </Badge>
                          </span>
                          <CardTitle className="text-sm">{chart.name}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Chart Preview Placeholder */}
                      <div className="h-40 bg-gradient-to-br from-muted to-muted/50 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                        <div className="text-center">
                          {chartTypeIcons[chart.chartType] && (
                            <div className="h-12 w-12 mx-auto mb-2 opacity-20">
                              {React.cloneElement(chartTypeIcons[chart.chartType] as React.ReactElement, { className: 'h-12 w-12' })}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">Chart Preview</p>
                          {config?.xAxis && <p className="text-[10px] text-muted-foreground mt-1">{config.xAxis.label} → {config.yAxis?.label}</p>}
                        </div>
                      </div>
                      {/* Metrics used */}
                      {chart.chartMetrics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {chart.chartMetrics.map(cm => (
                            <Badge key={cm.id} variant="secondary" className="text-[9px]">
                              <LineChart className="h-2.5 w-2.5 mr-0.5" />
                              {cm.metric.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {/* Add Chart button */}
              <Card className="border-2 border-dashed hover:border-emerald-300 transition-colors cursor-pointer group">
                <CardContent className="flex items-center justify-center h-60">
                  <div className="text-center">
                    <Plus className="h-8 w-8 text-muted-foreground group-hover:text-emerald-600 transition-colors mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground group-hover:text-emerald-600">Add Chart</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="mt-4">
            <div className="space-y-3">
              {dash.charts.map(chart => (
                <Card key={chart.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <span className={chartTypeColors[chart.chartType]}>
                      {chartTypeIcons[chart.chartType]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{chart.name}</p>
                      <p className="text-xs text-muted-foreground">{chart.chartType} • {chart.chartMetrics.length} metrics</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="branches" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Branches & Merge Requests</CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowBranchDialog(true)}>
                    <GitBranch className="h-3 w-3 mr-1" /> New Branch
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <GitBranch className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">main</span>
                    <Badge variant="secondary" className="text-[9px]">active</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">Default branch</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border">
                    <GitBranch className="h-4 w-4 text-violet-600" />
                    <span className="text-sm font-medium">feature/add-gmv-funnel</span>
                    <Badge variant="outline" className="text-[9px]">active</Badge>
                    <Badge variant="outline" className="text-[9px]">1 open MR</Badge>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto">
                      <GitMerge className="h-3 w-3 mr-1" /> Create MR
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Branch Dialog */}
        <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Branch</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Branch name (e.g., feature/new-chart)" />
              <Textarea placeholder="Description (optional)" />
              <p className="text-xs text-muted-foreground">
                Creating a branch allows you to make changes without affecting the main dashboard.
                Other users can continue working on main while you develop your changes.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBranchDialog(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700">Create Branch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Merge Request Dialog */}
        <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Merge Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" defaultValue="Add GMV Funnel Chart" />
              <Textarea placeholder="Description" defaultValue="Adding a new funnel chart to visualize the GMV conversion pipeline" />
              <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                <p className="font-medium">Merge workflow:</p>
                <p>1. Submit your changes for review</p>
                <p>2. System checks for conflicts with other concurrent edits</p>
                <p>3. If no conflicts, changes can be merged to main</p>
                <p>4. If conflicts exist, you must resolve them before merging</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMergeDialog(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <GitMerge className="h-3 w-3 mr-1" /> Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Dashboard list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dashboards</h2>
          <p className="text-sm text-muted-foreground">Create and manage dashboards with charts, metrics, and real-time collaboration</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> New Dashboard
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Dashboard</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Dashboard name" value={newDashboard.name} onChange={(e) => setNewDashboard(prev => ({ ...prev, name: e.target.value }))} />
              <Textarea placeholder="Description (optional)" value={newDashboard.description} onChange={(e) => setNewDashboard(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newDashboard.name} className="bg-emerald-600 hover:bg-emerald-700">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(dash => (
            <Card key={dash.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setSelectedDashboard(dash)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-sm">{dash.name}</CardTitle>
                  </div>
                  <Badge variant={dash.status === 'published' ? 'secondary' : 'outline'} className="text-[9px]">{dash.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{dash.description || 'No description'}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> {dash.charts.length} charts</span>
                  <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {dash.branch}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex -space-x-1">
                    <div className="h-5 w-5 rounded-full bg-green-500 text-white text-[8px] flex items-center justify-center border border-white">A</div>
                    <div className="h-5 w-5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center border border-white">M</div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(dash.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-2 border-dashed hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => setShowCreateDialog(true)}>
            <CardContent className="flex items-center justify-center h-40">
              <div className="text-center">
                <Plus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">New Dashboard</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
