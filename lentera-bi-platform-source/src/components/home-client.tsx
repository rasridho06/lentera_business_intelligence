'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutDashboard, GitBranch, Shield, LineChart, Search,
  Database, BarChart3, AlertTriangle, ChevronRight, ArrowLeft,
  Menu, X, Lamp, Code2, Terminal, Users, GitMerge, Cable,
  Layers, Wrench, FileSpreadsheet, Upload,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';

// Dynamic imports for heavy components to reduce initial bundle
const OverviewView = dynamic(() => import('@/components/lentera/overview-view').then(m => ({ default: m.OverviewView })), { ssr: false });
const LineageView = dynamic(() => import('@/components/lentera/lineage-view').then(m => ({ default: m.LineageView })), { ssr: false });
const LineageEnhancedView = dynamic(() => import('@/components/lentera/lineage-enhanced-view').then(m => ({ default: m.LineageEnhancedView })), { ssr: false });
const AuditView = dynamic(() => import('@/components/lentera/audit-view').then(m => ({ default: m.AuditView })), { ssr: false });
const MetricsView = dynamic(() => import('@/components/lentera/metrics-view').then(m => ({ default: m.MetricsView })), { ssr: false });
const ImpactView = dynamic(() => import('@/components/lentera/impact-view').then(m => ({ default: m.ImpactView })), { ssr: false });
const NodeDetailView = dynamic(() => import('@/components/lentera/node-detail-view').then(m => ({ default: m.NodeDetailView })), { ssr: false });
const ConnectorsView = dynamic(() => import('@/components/lentera/connectors-view').then(m => ({ default: m.ConnectorsView })), { ssr: false });
const DashboardsView = dynamic(() => import('@/components/lentera/dashboards-view').then(m => ({ default: m.DashboardsView })), { ssr: false });
const MetricsBuilderView = dynamic(() => import('@/components/lentera/metrics-builder-view').then(m => ({ default: m.MetricsBuilderView })), { ssr: false });
const TransformsView = dynamic(() => import('@/components/lentera/transforms-view').then(m => ({ default: m.TransformsView })), { ssr: false });
const CollaborationView = dynamic(() => import('@/components/lentera/collaboration-view').then(m => ({ default: m.CollaborationView })), { ssr: false });
const ChartsView = dynamic(() => import('@/components/lentera/charts-view').then(m => ({ default: m.ChartsView })), { ssr: false });
const DatasetsView = dynamic(() => import('@/components/lentera/datasets-view').then(m => ({ default: m.DatasetsView })), { ssr: false });

type ViewType = 'overview' | 'lineage' | 'audit' | 'metrics' | 'impact' | 'detail' | 'search'
  | 'connectors' | 'dashboards' | 'charts' | 'datasets' | 'metrics-builder' | 'transforms' | 'collaboration';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  section?: string;
}

const navSections = [
  {
    label: 'BI Platform',
    items: [
      { id: 'connectors' as ViewType, label: 'Data Sources', icon: <Cable className="h-4 w-4" /> },
      { id: 'charts' as ViewType, label: 'Charts', icon: <BarChart3 className="h-4 w-4" /> },
      { id: 'dashboards' as ViewType, label: 'Dashboards', icon: <LayoutDashboard className="h-4 w-4" /> },
      { id: 'datasets' as ViewType, label: 'Datasets', icon: <FileSpreadsheet className="h-4 w-4" /> },
      { id: 'metrics-builder' as ViewType, label: 'Metrics', icon: <Layers className="h-4 w-4" /> },
      { id: 'transforms' as ViewType, label: 'Transforms', icon: <Wrench className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Lineage & Audit',
    items: [
      { id: 'overview' as ViewType, label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
      { id: 'lineage' as ViewType, label: 'Lineage', icon: <GitBranch className="h-4 w-4" /> },
      { id: 'audit' as ViewType, label: 'Audit', icon: <Shield className="h-4 w-4" /> },
      { id: 'metrics' as ViewType, label: 'Metric Drift', icon: <LineChart className="h-4 w-4" /> },
      { id: 'impact' as ViewType, label: 'Impact', icon: <AlertTriangle className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Collaboration',
    items: [
      { id: 'collaboration' as ViewType, label: 'Team & MRs', icon: <GitMerge className="h-4 w-4" /> },
    ],
  },
];

const allNavItems = navSections.flatMap(s => s.items);

// Loading spinner for dynamic imports
function ComponentLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      <span className="ml-3 text-muted-foreground">Loading...</span>
    </div>
  );
}

// Data cache
const dataCache: Record<string, unknown> = {};

async function fetchData<T>(key: string, url: string): Promise<T> {
  if (dataCache[key]) return dataCache[key] as T;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Fetch ${url} failed: ${res.status}`);
      return {} as T;
    }
    const data = await res.json();
    dataCache[key] = data;
    return data as T;
  } catch (err) {
    console.error(`Fetch ${url} error:`, err);
    return {} as T;
  }
}

export default function HomeClient() {
  const [currentView, setCurrentView] = useState<ViewType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overviewData, setOverviewData] = useState<Record<string, unknown> | null>(null);
  const [lineageData, setLineageData] = useState<Record<string, unknown> | null>(null);
  const [auditData, setAuditData] = useState<Record<string, unknown> | null>(null);
  const [metricsData, setMetricsData] = useState<Record<string, unknown> | null>(null);
  const [nodeDetailData, setNodeDetailData] = useState<Record<string, unknown> | null>(null);
  const [impactData, setImpactData] = useState<Record<string, unknown> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [auditBadgeCount, setAuditBadgeCount] = useState(0);

  const loadOverview = useCallback(async () => {
    try {
      const data = await fetchData<Record<string, unknown>>('overview', '/api/overview');
      if (data && typeof data === 'object' && 'severityCounts' in data) {
        setOverviewData(data);
        const sc = data.severityCounts as Record<string, number>;
        if (sc) setAuditBadgeCount((sc.critical || 0) + (sc.error || 0));
      }
    } catch (err) {
      console.error('Failed to load overview:', err);
    }
  }, []);

  const loadLineage = useCallback(async () => {
    try {
      const data = await fetchData<Record<string, unknown>>('lineage', '/api/lineage');
      if (data && typeof data === 'object') setLineageData(data);
    } catch (err) {
      console.error('Failed to load lineage:', err);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const data = await fetchData<Record<string, unknown>>('audit', '/api/audit');
      if (data && typeof data === 'object') setAuditData(data);
    } catch (err) {
      console.error('Failed to load audit:', err);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await fetchData<Record<string, unknown>>('metrics', '/api/metrics');
      if (data && typeof data === 'object') setMetricsData(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
  }, []);

  const loadNodeDetail = useCallback(async (nodeId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nodes?id=${encodeURIComponent(nodeId)}`);
      const data = await res.json();
      setNodeDetailData(data);
      setCurrentView('detail');
    } catch (err) {
      console.error('Failed to load node detail:', err);
    }
    setLoading(false);
  }, []);

  const loadImpact = useCallback(async (nodeId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/impact?nodeId=${encodeURIComponent(nodeId)}&direction=downstream`);
      const data = await res.json();
      setImpactData(data);
    } catch (err) {
      console.error('Failed to load impact:', err);
    }
    setLoading(false);
  }, []);

  const handleSearch = useCallback(async (query?: string) => {
    const q = query || searchQuery;
    if (!q.trim() || q.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      setCurrentView('search');
    } catch (err) {
      console.error('Search failed:', err);
    }
    setLoading(false);
  }, [searchQuery]);

  const switchView = useCallback((view: ViewType) => {
    setCurrentView(view);
    if (view === 'overview') loadOverview();
    else if (view === 'lineage') loadLineage();
    else if (view === 'audit') loadAudit();
    else if (view === 'metrics') loadMetrics();
  }, [loadOverview, loadLineage, loadAudit, loadMetrics]);

  const handleImpactSearch = useCallback((nodeId: string) => {
    loadImpact(nodeId);
  }, [loadImpact]);

  // Initial load
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const navigateBack = () => {
    if (currentView === 'detail') switchView('lineage');
    else switchView('overview');
  };

  const getCurrentSection = () => {
    for (const section of navSections) {
      if (section.items.some(item => item.id === currentView)) return section.label;
    }
    return '';
  };

  const activeUsers = [
    { name: 'Maya Sari', color: '#dc2626' },
    { name: 'Budi Santoso', color: '#7c3aed' },
  ];

  return (
    <TooltipProvider>
      <div className="min-h-screen flex bg-background">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} border-r bg-card transition-all duration-200 flex flex-col shrink-0`}>
          {/* Logo */}
          <div className="p-4 border-b flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-600 text-white shrink-0">
              <Lamp className="h-4 w-4" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-lg leading-tight">Lentera</h1>
                <p className="text-[10px] text-muted-foreground">BI Platform + Lineage & Audit</p>
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <nav className="flex-1 overflow-y-auto p-2">
            {navSections.map((section) => (
              <div key={section.label} className="mb-4">
                {sidebarOpen && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1.5">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map(item => (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => switchView(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            currentView === item.id
                              ? 'bg-emerald-50 text-emerald-700 font-medium border border-emerald-200'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {item.icon}
                          {sidebarOpen && (
                            <>
                              <span>{item.label}</span>
                              {item.id === 'audit' && auditBadgeCount > 0 && (
                                <Badge variant="destructive" className="text-[9px] ml-auto h-4 min-w-4">{auditBadgeCount}</Badge>
                              )}
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      {!sidebarOpen && <TooltipContent side="right">{item.label}</TooltipContent>}
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Global Search */}
          {sidebarOpen && (
            <div className="p-3 border-t">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={() => handleSearch()} className="h-8 px-2 shrink-0">
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Active Users */}
          {sidebarOpen && (
            <div className="p-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Online now</span>
              </div>
              <div className="flex -space-x-1.5">
                <div className="h-6 w-6 rounded-full bg-green-500 text-white text-[8px] flex items-center justify-center border-2 border-white font-bold">A</div>
                {activeUsers.map((user, i) => (
                  <div
                    key={i}
                    className="h-6 w-6 rounded-full text-white text-[8px] flex items-center justify-center border-2 border-white font-bold"
                    style={{ backgroundColor: user.color }}
                    title={user.name}
                  >
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Info */}
          {sidebarOpen && (
            <div className="p-3 border-t">
              <div className="text-[10px] text-muted-foreground">
                <p>Project: <strong>hungryhub-analytics</strong></p>
                <p>ClickHouse + dbt + Superset</p>
              </div>
            </div>
          )}

          {/* Collapse button */}
          <div className="p-2 border-t">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <header className="border-b px-6 py-3 flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              {(currentView === 'detail' || currentView === 'search') && (
                <Button variant="ghost" size="sm" onClick={navigateBack} className="h-7 px-2">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              <h2 className="font-semibold text-lg">
                {currentView === 'detail' && nodeDetailData
                  ? (nodeDetailData as Record<string, Record<string, string>>).node?.name || 'Node Detail'
                  : currentView === 'search' ? 'Search Results' : allNavItems.find(i => i.id === currentView)?.label || currentView}
              </h2>
              <Badge variant="outline" className="text-[9px]">{getCurrentSection()}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs"><Database className="h-3 w-3 mr-1" />ClickHouse</Badge>
              <Badge variant="outline" className="text-xs"><GitBranch className="h-3 w-3 mr-1" />dbt</Badge>
              <Badge variant="outline" className="text-xs"><BarChart3 className="h-3 w-3 mr-1" />Superset</Badge>
              <div className="h-7 w-7 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold ml-2" title="Andi Pratama">
                AP
              </div>
            </div>
          </header>

          {/* Content Area */}
          <ScrollArea className="h-[calc(100vh-57px)]">
            <div className="p-6 max-w-7xl mx-auto">
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                  <span className="ml-3 text-muted-foreground">Loading...</span>
                </div>
              )}

              {/* BI Platform Views - with Error Boundaries */}
              {!loading && currentView === 'connectors' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><ConnectorsView /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'charts' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><ChartsView /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'dashboards' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><DashboardsView /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'datasets' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><DatasetsView /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'metrics-builder' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><MetricsBuilderView /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'transforms' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><TransformsView /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'collaboration' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><CollaborationView /></Suspense></ErrorBoundary>
              )}

              {/* Legacy Lineage & Audit Views */}
              {!loading && currentView === 'overview' && overviewData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><OverviewView data={overviewData as Parameters<typeof OverviewView>[0]['data']} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'lineage' && lineageData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><LineageView data={lineageData as Parameters<typeof LineageView>[0]['data']} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'audit' && auditData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><AuditView data={auditData as Parameters<typeof AuditView>[0]['data']} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'metrics' && metricsData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><MetricsView data={metricsData as Parameters<typeof MetricsView>[0]['data']} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'impact' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><ImpactView data={impactData as Parameters<typeof ImpactView>[0]['data']} onSearch={handleImpactSearch} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'detail' && nodeDetailData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><NodeDetailView data={nodeDetailData as Parameters<typeof NodeDetailView>[0]['data']} /></Suspense></ErrorBoundary>
              )}

              {!loading && currentView === 'search' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
                  </p>
                  {searchResults.map((r) => {
                    const t = r.type as string;
                    return (
                      <button
                        key={r.id as string}
                        onClick={() => loadNodeDetail(r.id as string)}
                        className="w-full text-left p-4 rounded-lg border hover:bg-muted transition-colors flex items-center gap-4"
                      >
                        <div className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${
                          t === 'source' ? 'bg-amber-100 text-amber-700' :
                          t === 'model' ? 'bg-emerald-100 text-emerald-700' :
                          t === 'dataset' ? 'bg-sky-100 text-sky-700' :
                          t === 'chart' ? 'bg-violet-100 text-violet-700' :
                          t === 'dashboard' ? 'bg-rose-100 text-rose-700' :
                          t === 'metric' ? 'bg-teal-100 text-teal-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {t === 'source' || t === 'dataset' ? <Database className="h-5 w-5" /> :
                           t === 'model' ? <GitBranch className="h-5 w-5" /> :
                           t === 'chart' ? <BarChart3 className="h-5 w-5" /> :
                           t === 'dashboard' ? <LayoutDashboard className="h-5 w-5" /> :
                           <LineChart className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{r.name as string}</p>
                          <p className="text-sm font-mono text-muted-foreground truncate">{r.qualifiedName as string}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] capitalize">{t.replace('_', ' ')}</Badge>
                          <Badge variant="outline" className="text-[10px]">{r.platform as string}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Empty/loading states for legacy views */}
              {!loading && currentView === 'overview' && !overviewData && (
                <div className="text-center py-20"><LayoutDashboard className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p>Loading overview...</p></div>
              )}
              {!loading && currentView === 'lineage' && !lineageData && (
                <div className="text-center py-20"><GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p>Loading lineage...</p></div>
              )}
              {!loading && currentView === 'audit' && !auditData && (
                <div className="text-center py-20"><Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p>Loading audit data...</p></div>
              )}
              {!loading && currentView === 'metrics' && !metricsData && (
                <div className="text-center py-20"><LineChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p>Loading metrics...</p></div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </TooltipProvider>
  );
}
