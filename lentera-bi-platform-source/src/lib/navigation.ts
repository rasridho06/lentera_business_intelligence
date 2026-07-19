import type { ElementType } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Cable,
  FileSpreadsheet,
  GitBranch,
  GitMerge,
  Layers,
  LayoutDashboard,
  LineChart,
  Shield,
  Terminal,
  Wrench,
} from 'lucide-react';

export type ViewType =
  | 'overview'
  | 'lineage'
  | 'audit'
  | 'metrics'
  | 'impact'
  | 'detail'
  | 'search'
  | 'connectors'
  | 'dashboards'
  | 'charts'
  | 'datasets'
  | 'metrics-builder'
  | 'transforms'
  | 'collaboration'
  | 'query';

export interface NavItem {
  id: ViewType;
  label: string;
  icon: ElementType<{ className?: string }>;
}

export const navSections = [
  {
    label: 'BI Platform',
    items: [
      { id: 'connectors' as ViewType, label: 'Data Sources', icon: Cable },
      { id: 'charts' as ViewType, label: 'Charts', icon: BarChart3 },
      { id: 'dashboards' as ViewType, label: 'Dashboards', icon: LayoutDashboard },
      { id: 'datasets' as ViewType, label: 'Datasets', icon: FileSpreadsheet },
      { id: 'metrics-builder' as ViewType, label: 'Metrics', icon: Layers },
      { id: 'transforms' as ViewType, label: 'Transforms', icon: Wrench },
      { id: 'query' as ViewType, label: 'SQL Query', icon: Terminal },
    ],
  },
  {
    label: 'Lineage & Audit',
    items: [
      { id: 'overview' as ViewType, label: 'Overview', icon: LayoutDashboard },
      { id: 'lineage' as ViewType, label: 'Lineage', icon: GitBranch },
      { id: 'audit' as ViewType, label: 'Audit', icon: Shield },
      { id: 'metrics' as ViewType, label: 'Metric Drift', icon: LineChart },
      { id: 'impact' as ViewType, label: 'Impact', icon: AlertTriangle },
    ],
  },
  {
    label: 'Collaboration',
    items: [
      { id: 'collaboration' as ViewType, label: 'Team & MRs', icon: GitMerge },
    ],
  },
] satisfies ReadonlyArray<{ label: string; items: NavItem[] }>;

export const allNavItems = navSections.flatMap(section => section.items);

export const routeViewIds = new Set<ViewType>(['overview', 'lineage', 'audit', 'metrics', 'impact', 'connectors', 'dashboards', 'charts', 'datasets', 'metrics-builder', 'transforms', 'collaboration', 'query']);
