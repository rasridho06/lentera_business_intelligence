'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { allNavItems, navSections, routeViewIds, type ViewType } from '@/lib/navigation';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutDashboard, GitBranch, Shield, LineChart, Search,
  Database, BarChart3, AlertTriangle, ChevronRight, ArrowLeft,
  Menu, X, Lamp, Terminal, Users, GitMerge,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeToggle } from '@/components/theme-toggle';
import { PlatformShell } from '@/components/platform-shell';

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
const QueryView = dynamic(() => import('@/components/lentera/query-view').then(m => ({ default: m.QueryView })), { ssr: false });
const ChartsView = dynamic(() => import('@/components/lentera/charts-view').then(m => ({ default: m.ChartsView })), { ssr: false });
const DatasetsView = dynamic(() => import('@/components/lentera/datasets-view').then(m => ({ default: m.DatasetsView })), { ssr: false });

function ComponentLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      <span className="ml-3 text-muted-foreground">Loading...</span>
    </div>
  );
}

function fetcher(url: string) {
  return fetch(url).then(r => { if (!r.ok) throw new Error(`Fetch ${url} failed: ${r.status}`); return r.json(); });
}

interface HomeClientProps { initialView?: ViewType; }

export default function HomeClient({ initialView = 'overview' }: HomeClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [nodeDetailId, setNodeDetailId] = useState<string | null>(null);
  const [impactNodeId, setImpactNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState('');

  useEffect(() => {
    const route = pathname.split('/').filter(Boolean)[0];
    setCurrentView(routeViewIds.has(route as ViewType) ? route as ViewType : initialView);
  }, [initialView, pathname]);

  const { data: overviewData } = useQuery({
    queryKey: ['overview'],
    queryFn: () => fetcher('/api/overview'),
    staleTime: 60_000,
  });

  const auditBadgeCount = overviewData
    ? ((overviewData as Record<string, Record<string, number>>).severityCounts?.critical || 0) +
      ((overviewData as Record<string, Record<string, number>>).severityCounts?.error || 0)
    : 0;

  const { data: lineageData } = useQuery({
    queryKey: ['lineage'],
    queryFn: () => fetcher('/api/lineage'),
    enabled: currentView === 'lineage',
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit'],
    queryFn: () => fetcher('/api/audit'),
    enabled: currentView === 'audit',
  });

  const { data: metricsData } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetcher('/api/metrics'),
    enabled: currentView === 'metrics',
  });

  const { data: nodeDetailData, isFetching: detailLoading } = useQuery({
    queryKey: ['node-detail', nodeDetailId],
    queryFn: () => fetcher(`/api/nodes?id=${encodeURIComponent(nodeDetailId!)}`),
    enabled: !!nodeDetailId,
  });

  const { data: impactData, isFetching: impactLoading } = useQuery({
    queryKey: ['impact', impactNodeId],
    queryFn: () => fetcher(`/api/impact?nodeId=${encodeURIComponent(impactNodeId!)}&direction=downstream`),
    enabled: !!impactNodeId,
  });

  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ['search', searchActive],
    queryFn: () => fetcher(`/api/search?q=${encodeURIComponent(searchActive)}`).then(d => (d as Record<string, unknown[]>).results || []),
    enabled: !!searchActive && searchActive.length >= 2,
  });

  const loading = detailLoading || impactLoading || searchLoading;

  const switchView = (view: ViewType) => {
    router.push(view === 'overview' ? '/overview' : '/' + view);
    setCurrentView(view);
    if (view !== 'detail') setNodeDetailId(null);
    if (view !== 'impact') setImpactNodeId(null);
    if (view !== 'search') setSearchActive('');
  };

  const handleNodeSelect = (nodeId: string) => {
    setNodeDetailId(nodeId);
    setCurrentView('detail');
  };

  const handleImpactSearch = (nodeId: string) => {
    setImpactNodeId(nodeId);
    setCurrentView('impact');
  };

  const handleSearch = (query?: string) => {
    const q = query ?? searchQuery;
    if (!q.trim() || q.length < 2) return;
    setSearchActive(q);
    setCurrentView('search');
  };

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
    <PlatformShell>
      <div>
        <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} border-r bg-card transition-all duration-200 flex flex-col shrink-0`}>
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
                          <item.icon className="h-4 w-4" />
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

          {sidebarOpen && (
            <div className="p-3 border-t">
              <div className="text-[10px] text-muted-foreground">
                <p>Project: <strong>hungryhub-analytics</strong></p>
                <p>ClickHouse + dbt + Superset</p>
              </div>
            </div>
          )}

          <div className="p-2 border-t flex gap-1">
            <ThemeToggle sidebarOpen={sidebarOpen} />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-1 flex items-center justify-center p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
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

          <ScrollArea className="h-[calc(100vh-57px)]">
            <div className="p-6 max-w-7xl mx-auto">
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                  <span className="ml-3 text-muted-foreground">Loading...</span>
                </div>
              )}

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
              {!loading && currentView === 'query' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><QueryView /></Suspense></ErrorBoundary>
              )}

              {!loading && currentView === 'overview' && overviewData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><OverviewView data={overviewData as any} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'lineage' && lineageData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><LineageView data={lineageData as any} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'audit' && auditData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><AuditView data={auditData as any} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'metrics' && metricsData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><MetricsView data={metricsData as any} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'impact' && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><ImpactView data={impactData as any} onSearch={handleImpactSearch} /></Suspense></ErrorBoundary>
              )}
              {!loading && currentView === 'detail' && nodeDetailData && (
                <ErrorBoundary><Suspense fallback={<ComponentLoader />}><NodeDetailView data={nodeDetailData as any} /></Suspense></ErrorBoundary>
              )}

              {!loading && currentView === 'search' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {(searchResults as Record<string, unknown>[]).length} result{(searchResults as Record<string, unknown>[]).length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
                  </p>
                  {(searchResults as Record<string, unknown>[]).map((r) => {
                    const t = r.type as string;
                    return (
                      <button
                        key={r.id as string}
                        onClick={() => handleNodeSelect(r.id as string)}
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
    </PlatformShell>
  );
}
