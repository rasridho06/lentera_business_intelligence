'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Plus, Trash2,
  Edit3, Eye, LayoutDashboard, ArrowRight, GitBranch, Layers,
  Code2, Terminal, Database, LayoutGrid, Save, ChevronDown, ChevronRight,
  Settings2, Palette, X, Check, Maximize2, Move,
} from 'lucide-react';
import type { ChartConfig, ChartDetailData, DashboardOption, DatasetOption, ConnectorOption } from '@/types';

// ── Recharts imports ──
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, FunnelChart, Funnel, LabelList,
  Cell as FunnelCell,
} from 'recharts';

// ── Demo data generators ──
function generateDemoData(chartType: string, configOverride?: ChartConfig | null, configJsonString?: string | null) {
  // Try to use real data from config.chartData
  if (configOverride || configJsonString) {
    const cfg = configOverride || (configJsonString ? parseConfigSafe(configJsonString) : null);
    if (cfg && (cfg as any).chartData && Array.isArray((cfg as any).chartData)) {
      const realData = (cfg as any).chartData as unknown[];
      if (realData.length > 0) {
        if (chartType === 'pie') {
          const dim = (cfg as any).dimension as string || (cfg as ChartConfig).xAxis || 'name';
          const metricKey = ((cfg as ChartConfig).yAxis && (cfg as ChartConfig).yAxis[0]) || 'value';
          // Check if data is already in {name, value} format
          const firstItem = realData[0] as Record<string, unknown>;
          if (firstItem && ('value' in firstItem || metricKey in firstItem)) {
            return realData.map((item, idx) => {
              const d = item as Record<string, unknown>;
              return {
                name: String(d[dim] || d.name || `Item ${idx + 1}`),
                value: Number(d.value || d[metricKey] || 0),
                color: CHART_PALETTES.superset[idx % CHART_PALETTES.superset.length],
              };
            });
          }
        }
        // For metric_card, transform to card format
        if (chartType === 'metric_card') {
          const metrics = (cfg as any).metrics as Array<{ label: string; value: string; change: string; changeType: string }> | undefined;
          if (metrics && Array.isArray(metrics)) {
            return metrics.map(m => ({
              label: m.label,
              value: m.value,
              change: m.change || '0%',
              changeType: m.changeType || 'positive',
            }));
          }
        }
        return realData;
      }
    }
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  switch (chartType) {
    case 'bar':
    case 'line':
    case 'area':
      return months.map(m => ({
        name: m,
        Revenue: Math.floor(Math.random() * 50000) + 10000,
        Orders: Math.floor(Math.random() * 500) + 100,
        Profit: Math.floor(Math.random() * 20000) + 5000,
      }));

    case 'pie':
      return [
        { name: 'Direct', value: 400, color: '#10b981' },
        { name: 'Organic', value: 300, color: '#3b82f6' },
        { name: 'Referral', value: 200, color: '#f59e0b' },
        { name: 'Social', value: 150, color: '#ef4444' },
        { name: 'Email', value: 100, color: '#8b5cf6' },
      ];

    case 'scatter':
      return Array.from({ length: 30 }, () => ({
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        size: Math.floor(Math.random() * 20) + 5,
      }));

    case 'heatmap':
      return (() => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const hours = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm'];
        return days.flatMap(d => hours.map(h => ({
          day: d, hour: h, value: Math.floor(Math.random() * 100),
        })));
      })();

    case 'funnel':
      return [
        { name: 'Visitors', value: 10000, fill: '#10b981' },
        { name: 'Leads', value: 5000, fill: '#3b82f6' },
        { name: 'Qualified', value: 2000, fill: '#f59e0b' },
        { name: 'Proposals', value: 800, fill: '#ef4444' },
        { name: 'Closed', value: 300, fill: '#8b5cf6' },
      ];

    case 'histogram':
      return Array.from({ length: 20 }, (_, i) => ({
        range: `${i * 5}-${(i + 1) * 5}`,
        count: Math.floor(Math.random() * 100) + (i > 5 && i < 15 ? 50 : 0),
      }));

    case 'metric_card':
      return [{
        label: 'Total Revenue',
        value: '$1,234,567',
        change: '+12.5%',
        changeType: 'positive',
      }];

    case 'table':
      return [
        { id: 1, name: 'Widget A', category: 'Electronics', price: '$29.99', stock: 150 },
        { id: 2, name: 'Widget B', category: 'Home', price: '$49.99', stock: 85 },
        { id: 3, name: 'Widget C', category: 'Electronics', price: '$19.99', stock: 200 },
        { id: 4, name: 'Widget D', category: 'Sports', price: '$89.99', stock: 42 },
        { id: 5, name: 'Widget E', category: 'Home', price: '$39.99', stock: 110 },
      ];

    default:
      return months.map(m => ({ name: m, value: Math.floor(Math.random() * 100) }));
  }
}

// ── Safe config parser (used before parseConfig is defined) ──
function parseConfigSafe(configStr: string | null): ChartConfig | null {
  if (!configStr) return null;
  try {
    const parsed = JSON.parse(configStr);
    const merged = { ...defaultConfig, ...parsed };
    // Ensure yAxis is always an array
    if (typeof merged.yAxis === 'string') {
      merged.yAxis = (merged.yAxis as string).split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(merged.yAxis)) {
      merged.yAxis = merged.yAxis ? [String(merged.yAxis)] : [...defaultConfig.yAxis];
    }
    if (typeof merged.metrics === 'string') {
      merged.metrics = (merged.metrics as string).split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(merged.metrics)) {
      merged.metrics = [...defaultConfig.metrics];
    }
    return merged as ChartConfig;
  } catch { return null; }
}

// ── Color palettes (Superset-style) ──
const CHART_PALETTES = {
  superset: ['#6666ff', '#00c4aa', '#ff6349', '#ffc53d', '#4444ff', '#22ddbb', '#ff8564', '#ffd255'],
  looker: ['#00897B', '#43A047', '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00', '#F4511E'],
  databricks: '#1179f0 #e44 #10b981 #f59e0b #8b5cf6'.split(' '),
  categorical: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
  diverging: ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6'],
  sequential: ['#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46'],
};

const defaultConfig: ChartConfig = {
  xAxis: 'name',
  yAxis: ['Revenue'],
  metrics: ['Revenue', 'Orders', 'Profit'],
  dimensions: ['name'],
  colorPalette: 'superset',
  showLegend: true,
  showGrid: true,
  showLabels: false,
  stacked: false,
  smooth: true,
  orientation: 'vertical',
  donut: false,
  aggregateFunction: 'sum',
  limit: 100,
};

// ── Chart rendering components ──
function ChartRenderer({ chartType, data, config: rawConfig, height = 300 }: {
  chartType: string;
  data: unknown[];
  config: ChartConfig;
  height?: number;
}) {
  // Ensure config arrays are always valid (defensive against malformed DB data)
  const config = useMemo(() => {
    const safe = { ...rawConfig };
    if (!Array.isArray(safe.yAxis)) {
      safe.yAxis = typeof safe.yAxis === 'string'
        ? (safe.yAxis as string).split(',').map(s => s.trim()).filter(Boolean)
        : safe.yAxis ? [String(safe.yAxis)] : ['value'];
    }
    if (!Array.isArray(safe.metrics)) {
      safe.metrics = [...defaultConfig.metrics];
    }
    if (!Array.isArray(safe.dimensions)) {
      safe.dimensions = [...defaultConfig.dimensions];
    }
    if (!safe.xAxis || typeof safe.xAxis !== 'string') {
      safe.xAxis = 'name';
    }
    return safe as ChartConfig;
  }, [rawConfig]);

  const colors = CHART_PALETTES[config.colorPalette as keyof typeof CHART_PALETTES] || CHART_PALETTES.superset;

  switch (chartType) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout={config.orientation === 'horizontal' ? 'vertical' : 'horizontal'}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey={config.xAxis} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip
              contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {config.yAxis.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[i % colors.length]}
                stackId={config.stacked ? 'stack' : undefined}
                radius={config.stacked ? undefined : [4, 4, 0, 0]}
              >
                {config.showLabels && <LabelList dataKey={key} position="top" style={{ fontSize: 9 }} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey={config.xAxis} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip
              contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {config.yAxis.map((key, i) => (
              <Line
                key={key}
                type={config.smooth ? 'monotone' : 'linear'}
                dataKey={key}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: colors[i % colors.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey={config.xAxis} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip
              contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {config.yAxis.map((key, i) => (
              <Area
                key={key}
                type={config.smooth ? 'monotone' : 'linear'}
                dataKey={key}
                stroke={colors[i % colors.length]}
                fill={colors[i % colors.length]}
                fillOpacity={0.15}
                stackId={config.stacked ? 'stack' : undefined}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data as Record<string, unknown>[]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={config.donut ? height * 0.25 : 0}
              outerRadius={height * 0.35}
              label={config.showLabels ? ({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
              labelLine={config.showLabels}
            >
              {(data as Record<string, unknown>[]).map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </PieChart>
        </ResponsiveContainer>
      );

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey="x" name="X" tick={{ fontSize: 11 }} />
            <YAxis dataKey="y" name="Y" tick={{ fontSize: 11 }} />
            <RechartsTooltip
              contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            />
            <Scatter data={data} fill={colors[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case 'funnel':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <FunnelChart>
            <RechartsTooltip
              contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            />
            <Funnel
              dataKey="value"
              data={data as Record<string, unknown>[]}
              isAnimationActive
            >
              <LabelList position="right" fill="#000" stroke="none" dataKey="name" style={{ fontSize: 11 }} />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      );

    case 'histogram':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
            <XAxis dataKey="range" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <RechartsTooltip
              contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="count" fill={colors[0]} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'metric_card': {
      const cardItems = data as Array<{ label: string; value: string; change: string; changeType: string }>;
      if (!cardItems || cardItems.length === 0) return <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>;
      // If multiple metrics, show as a grid
      if (cardItems.length > 1) {
        const gridCols = cardItems.length <= 2 ? 'grid-cols-2' : cardItems.length <= 3 ? 'grid-cols-3' : cardItems.length <= 4 ? 'grid-cols-4' : 'grid-cols-5';
        return (
          <div className={`grid gap-3 h-full ${gridCols}`} style={{ maxHeight: height }}>
            {cardItems.map((card, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center text-center p-2 bg-emerald-50/50 rounded-lg border border-emerald-100">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{card.label}</p>
                <p className="text-xl font-bold text-emerald-700">{card.value}</p>
                <p className={`text-[11px] mt-0.5 font-medium ${card.changeType === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {card.change}
                </p>
              </div>
            ))}
          </div>
        );
      }
      // Single metric card
      const cardData = cardItems[0];
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{cardData.label}</p>
          <p className="text-3xl font-bold text-emerald-700">{cardData.value}</p>
          <p className={`text-sm mt-1 font-medium ${cardData.changeType === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
            {cardData.change} vs last period
          </p>
        </div>
      );
    }

    case 'heatmap': {
      const heatData = data as Array<{ day: string; hour: string; value: number }>;
      const days = [...new Set(heatData.map(d => d.day))];
      const hours = [...new Set(heatData.map(d => d.hour))];
      const maxVal = Math.max(...heatData.map(d => d.value));
      return (
        <div className="overflow-auto" style={{ maxHeight: height }}>
          <table className="w-full text-[9px]">
            <thead>
              <tr>
                <th className="p-1 text-left"></th>
                {hours.map(h => <th key={h} className="p-1 text-center text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td className="p-1 text-muted-foreground font-medium">{day}</td>
                  {hours.map(hour => {
                    const cell = heatData.find(d => d.day === day && d.hour === hour);
                    const intensity = cell ? (cell.value / maxVal) : 0;
                    return (
                      <td
                        key={hour}
                        className="p-1 text-center rounded-sm"
                        style={{
                          backgroundColor: `rgba(16, 185, 129, ${intensity * 0.8 + 0.05})`,
                          color: intensity > 0.5 ? 'white' : '#065f46',
                        }}
                        title={`${day} ${hour}: ${cell?.value || 0}`}
                      >
                        {cell?.value || ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'table': {
      const rows = data as Record<string, unknown>[];
      if (rows.length === 0) return <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>;
      const cols = Object.keys(rows[0]);
      return (
        <div className="overflow-auto" style={{ maxHeight: height }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                {cols.map(col => (
                  <th key={col} className="text-left p-2 font-medium text-muted-foreground bg-muted/50">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  {cols.map(col => (
                    <td key={col} className="p-2">{String(row[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Unknown chart type: {chartType}
        </div>
      );
  }
}

// ── Full chart editor modal ──
function ChartEditor({ chart, onSave, onCancel, connectors, datasets }: {
  chart: ChartDetailData;
  onSave: (updated: ChartDetailData & { config: ChartConfig }) => void;
  onCancel: () => void;
  connectors: ConnectorOption[];
  datasets: DatasetOption[];
}) {
  const [name, setName] = useState(chart.name);
  const [chartType, setChartType] = useState(chart.chartType);
  const [config, setConfig] = useState<ChartConfig>(() => {
    if (chart.config) {
      try {
        const parsed = JSON.parse(chart.config);
        return { ...defaultConfig, ...parsed };
      } catch { return defaultConfig; }
    }
    return defaultConfig;
  });
  const [dataSourceType, setDataSourceType] = useState(chart.dataSourceType || 'table');
  const [customSQL, setCustomSQL] = useState(chart.customSQL || '');
  const [datasetId, setDatasetId] = useState(chart.datasetId || '');
  const [activeTab, setActiveTab] = useState<'data' | 'style' | 'config'>('data');

  const demoData = useMemo(() => generateDemoData(chartType, config), [chartType, config]);

  const updateConfig = (key: keyof ChartConfig, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleYAxis = (metric: string) => {
    setConfig(prev => ({
      ...prev,
      yAxis: prev.yAxis.includes(metric)
        ? prev.yAxis.filter(m => m !== metric)
        : [...prev.yAxis, metric],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-bold h-8 border-0 bg-transparent focus-visible:ring-0 p-0"
              placeholder="Chart Name"
            />
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartTypeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">{opt.icon} {opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onSave({ ...chart, name, chartType, config: config as any, dataSourceType, customSQL, datasetId })}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: Configuration */}
          <div className="w-80 border-r overflow-y-auto bg-muted/20">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'data' | 'style' | 'config')}>
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="data" className="flex-1 text-xs"><Database className="h-3 w-3 mr-1" /> Data</TabsTrigger>
                <TabsTrigger value="style" className="flex-1 text-xs"><Palette className="h-3 w-3 mr-1" /> Style</TabsTrigger>
                <TabsTrigger value="config" className="flex-1 text-xs"><Settings2 className="h-3 w-3 mr-1" /> Config</TabsTrigger>
              </TabsList>

              <TabsContent value="data" className="p-3 space-y-3 mt-0">
                {/* Data Source Type */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Data Source</Label>
                  <Select value={dataSourceType} onValueChange={setDataSourceType}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table"><Database className="h-3 w-3 mr-1 inline" /> Table</SelectItem>
                      <SelectItem value="dataset"><Layers className="h-3 w-3 mr-1 inline" /> Dataset</SelectItem>
                      <SelectItem value="custom_sql"><Code2 className="h-3 w-3 mr-1 inline" /> Custom SQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dataSourceType === 'dataset' && (
                  <Select value={datasetId} onValueChange={setDatasetId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select dataset" /></SelectTrigger>
                    <SelectContent>
                      {datasets.map(ds => (
                        <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {dataSourceType === 'custom_sql' && (
                  <Textarea
                    placeholder="SELECT date, SUM(gmv) as total_gmv FROM analytics.mart_booking_gmv GROUP BY date"
                    value={customSQL}
                    onChange={(e) => setCustomSQL(e.target.value)}
                    className="font-mono text-xs min-h-[100px]"
                  />
                )}

                {/* Metrics (Y-Axis) - Superset style */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Metrics (Y-Axis)</Label>
                  <div className="space-y-1">
                    {['Revenue', 'Orders', 'Profit', 'GMV', 'Users', 'Sessions'].map(metric => (
                      <label key={metric} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.yAxis.includes(metric)}
                          onChange={() => toggleYAxis(metric)}
                          className="rounded border-gray-300"
                        />
                        <span>{metric}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Dimensions (X-Axis) */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Dimension (X-Axis)</Label>
                  <Select value={config.xAxis} onValueChange={(v) => updateConfig('xAxis', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="channel">Channel</SelectItem>
                      <SelectItem value="region">Region</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Aggregation */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Aggregation</Label>
                  <Select value={config.aggregateFunction} onValueChange={(v) => updateConfig('aggregateFunction', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum">SUM</SelectItem>
                      <SelectItem value="avg">AVG</SelectItem>
                      <SelectItem value="count">COUNT</SelectItem>
                      <SelectItem value="min">MIN</SelectItem>
                      <SelectItem value="max">MAX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="style" className="p-3 space-y-3 mt-0">
                {/* Color Palette */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Color Palette</Label>
                  {Object.entries(CHART_PALETTES).map(([name, palette]) => (
                    <label key={name} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="radio"
                        name="palette"
                        checked={config.colorPalette === name}
                        onChange={() => updateConfig('colorPalette', name)}
                        className="rounded-full border-gray-300"
                      />
                      <div className="flex gap-0.5">
                        {(palette as string[]).slice(0, 6).map((color, i) => (
                          <div key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <span className="capitalize">{name}</span>
                    </label>
                  ))}
                </div>

                <Separator />

                {/* Toggle options */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Legend</Label>
                    <Switch checked={config.showLegend} onCheckedChange={(v) => updateConfig('showLegend', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Grid</Label>
                    <Switch checked={config.showGrid} onCheckedChange={(v) => updateConfig('showGrid', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Labels</Label>
                    <Switch checked={config.showLabels} onCheckedChange={(v) => updateConfig('showLabels', v)} />
                  </div>
                  {chartType === 'line' && (
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Smooth Lines</Label>
                      <Switch checked={config.smooth} onCheckedChange={(v) => updateConfig('smooth', v)} />
                    </div>
                  )}
                  {(chartType === 'bar' || chartType === 'area') && (
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Stacked</Label>
                      <Switch checked={config.stacked} onCheckedChange={(v) => updateConfig('stacked', v)} />
                    </div>
                  )}
                  {chartType === 'pie' && (
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Donut</Label>
                      <Switch checked={config.donut} onCheckedChange={(v) => updateConfig('donut', v)} />
                    </div>
                  )}
                  {chartType === 'bar' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Orientation</Label>
                      <Select value={config.orientation} onValueChange={(v) => updateConfig('orientation', v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vertical">Vertical</SelectItem>
                          <SelectItem value="horizontal">Horizontal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="config" className="p-3 space-y-3 mt-0">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Row Limit</Label>
                  <Input
                    type="number"
                    value={config.limit}
                    onChange={(e) => updateConfig('limit', parseInt(e.target.value) || 100)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Current Config (JSON)</p>
                  <pre className="text-[9px] font-mono overflow-auto max-h-40">{JSON.stringify(config, null, 2)}</pre>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right panel: Chart Preview */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="bg-white border rounded-lg p-4 shadow-sm" style={{ minHeight: 400 }}>
              <ChartRenderer chartType={chartType} data={demoData} config={config} height={380} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const chartTypeOptions = [
  { value: 'bar', label: 'Bar Chart', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'line', label: 'Line Chart', icon: <LineChartIcon className="h-4 w-4" /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieChartIcon className="h-4 w-4" /> },
  { value: 'area', label: 'Area Chart', icon: <LineChartIcon className="h-4 w-4" /> },
  { value: 'scatter', label: 'Scatter Plot', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'table', label: 'Data Table', icon: <LayoutGrid className="h-4 w-4" /> },
  { value: 'metric_card', label: 'Metric Card', icon: <LayoutDashboard className="h-4 w-4" /> },
  { value: 'heatmap', label: 'Heatmap', icon: <LayoutGrid className="h-4 w-4" /> },
  { value: 'funnel', label: 'Funnel', icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'histogram', label: 'Histogram', icon: <BarChart3 className="h-4 w-4" /> },
];

const chartTypeColors: Record<string, string> = {
  bar: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  line: 'bg-sky-50 text-sky-700 border-sky-200',
  pie: 'bg-violet-50 text-violet-700 border-violet-200',
  area: 'bg-amber-50 text-amber-700 border-amber-200',
  scatter: 'bg-teal-50 text-teal-700 border-teal-200',
  table: 'bg-gray-50 text-gray-700 border-gray-200',
  metric_card: 'bg-rose-50 text-rose-700 border-rose-200',
  heatmap: 'bg-orange-50 text-orange-700 border-orange-200',
  funnel: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  histogram: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function ChartsView() {
  const [charts, setCharts] = useState<ChartDetailData[]>([]);
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [connectors, setConnectors] = useState<ConnectorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [insertDashboardId, setInsertDashboardId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingChart, setEditingChart] = useState<ChartDetailData | null>(null);
  const [newChart, setNewChart] = useState({
    name: '', description: '', chartType: 'bar', dataSourceType: 'table',
    customSQL: '', datasetId: '', dashboardId: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [chartsRes, dashRes, dsRes, connRes] = await Promise.all([
      fetch('/api/charts'),
      fetch('/api/dashboards'),
      fetch('/api/datasets'),
      fetch('/api/connectors'),
    ]);
    setCharts(await chartsRes.json());
    const dashData = await dashRes.json();
    setDashboards(dashData.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
    const dsData = await dsRes.json();
    setDatasets(dsData.map((d: { id: string; name: string; type: string }) => ({ id: d.id, name: d.name, type: d.type })));
    const connData = await connRes.json();
    setConnectors(connData.map((c: { id: string; name: string; type: string; tables: Array<{ id: string; name: string; schema: string | null; columns: string | null }> }) => ({ id: c.id, name: c.name, type: c.type, tables: c.tables })));
    setLoading(false);
  }, []);

  const [init] = useState(() => {
    setTimeout(() => { loadData(); }, 0);
    return true;
  });
  void init;

  const handleCreate = async () => {
    await fetch('/api/charts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newChart,
        config: defaultConfig,
        dashboardId: newChart.dashboardId === '__none__' ? null : newChart.dashboardId || null,
      }),
    });
    setShowCreateDialog(false);
    setNewChart({ name: '', description: '', chartType: 'bar', dataSourceType: 'table', customSQL: '', datasetId: '', dashboardId: '' });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/charts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadData();
  };

  const handleInsertToDashboard = async () => {
    if (!selectedChartId || !insertDashboardId) return;
    await fetch('/api/charts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedChartId, dashboardId: insertDashboardId }),
    });
    setShowInsertDialog(false);
    setSelectedChartId(null);
    setInsertDashboardId('');
    loadData();
  };

  const handleSaveChart = async (updated: ChartDetailData & { config: ChartConfig }) => {
    await fetch('/api/charts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: updated.id,
        name: updated.name,
        chartType: updated.chartType,
        config: updated.config,
        dataSourceType: updated.dataSourceType,
        customSQL: updated.customSQL,
        datasetId: updated.datasetId,
        status: 'draft',
      }),
    });
    setEditingChart(null);
    loadData();
  };

  const parseConfig = (config: string | null): ChartConfig => {
    if (!config) return { ...defaultConfig, yAxis: [...defaultConfig.yAxis] };
    try {
      const parsed = JSON.parse(config);
      const merged = { ...defaultConfig, ...parsed };
      // Ensure yAxis is always an array (fixes "r.yAxis.map is not a function")
      if (typeof merged.yAxis === 'string') {
        merged.yAxis = merged.yAxis.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(merged.yAxis)) {
        merged.yAxis = merged.yAxis ? [String(merged.yAxis)] : [...defaultConfig.yAxis];
      }
      // Ensure metrics is always an array
      if (typeof merged.metrics === 'string') {
        merged.metrics = (merged.metrics as string).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(merged.metrics)) {
        merged.metrics = [...defaultConfig.metrics];
      }
      // Ensure dimensions is always an array
      if (typeof merged.dimensions === 'string') {
        merged.dimensions = (merged.dimensions as string).split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(merged.dimensions)) {
        merged.dimensions = [...defaultConfig.dimensions];
      }
      return merged as ChartConfig;
    } catch { return { ...defaultConfig, yAxis: [...defaultConfig.yAxis] }; }
  };

  const standaloneCharts = charts.filter(c => !c.dashboardId);
  const dashboardCharts = charts.filter(c => c.dashboardId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Charts</h2>
          <p className="text-sm text-muted-foreground">Create and customize charts with real-time preview — Superset & Looker Studio inspired builder</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> New Chart
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Chart</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Chart Type Selector - Visual Grid (Superset style) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Chart Type</label>
                <div className="grid grid-cols-5 gap-2">
                  {chartTypeOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all text-xs hover:border-emerald-400 ${
                        newChart.chartType === opt.value ? 'border-emerald-500 bg-emerald-50' : 'border-muted'
                      }`}
                      onClick={() => setNewChart(prev => ({ ...prev, chartType: opt.value }))}
                    >
                      <div className={`h-8 w-8 flex items-center justify-center rounded mb-1 ${chartTypeColors[opt.value] || 'bg-gray-50'}`}>
                        {opt.icon}
                      </div>
                      <span className="text-[10px] text-center leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Input placeholder="Chart name" value={newChart.name} onChange={(e) => setNewChart(prev => ({ ...prev, name: e.target.value }))} />

              <Textarea placeholder="Description (optional)" value={newChart.description} onChange={(e) => setNewChart(prev => ({ ...prev, description: e.target.value }))} />

              {/* Data Source */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Source</label>
                <Select value={newChart.dataSourceType} onValueChange={(v) => setNewChart(prev => ({ ...prev, dataSourceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table"><Database className="h-3 w-3 mr-1 inline" /> Table from Connector</SelectItem>
                    <SelectItem value="dataset"><Layers className="h-3 w-3 mr-1 inline" /> Virtual Dataset</SelectItem>
                    <SelectItem value="custom_sql"><Code2 className="h-3 w-3 mr-1 inline" /> Custom SQL</SelectItem>
                    <SelectItem value="transform"><Terminal className="h-3 w-3 mr-1 inline" /> Transform Output</SelectItem>
                  </SelectContent>
                </Select>

                {newChart.dataSourceType === 'dataset' && (
                  <Select value={newChart.datasetId} onValueChange={(v) => setNewChart(prev => ({ ...prev, datasetId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select dataset" /></SelectTrigger>
                    <SelectContent>
                      {datasets.map(ds => (
                        <SelectItem key={ds.id} value={ds.id}>{ds.name} <Badge variant="outline" className="text-[8px] ml-1">{ds.type}</Badge></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {newChart.dataSourceType === 'custom_sql' && (
                  <Textarea
                    placeholder="-- Write custom SQL for this chart&#10;SELECT date, SUM(gmv) as total_gmv&#10;FROM analytics.mart_booking_gmv&#10;GROUP BY date"
                    value={newChart.customSQL}
                    onChange={(e) => setNewChart(prev => ({ ...prev, customSQL: e.target.value }))}
                    className="font-mono text-sm min-h-[120px]"
                  />
                )}
              </div>

              {/* Optional: Assign to Dashboard */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to Dashboard (optional)</label>
                <Select value={newChart.dashboardId} onValueChange={(v) => setNewChart(prev => ({ ...prev, dashboardId: v }))}>
                  <SelectTrigger><SelectValue placeholder="None — standalone chart" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None — standalone chart</SelectItem>
                    {dashboards.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">You can create a chart now and insert it into a dashboard later</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newChart.name} className="bg-emerald-600 hover:bg-emerald-700">Create Chart</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="standalone"><Eye className="h-3 w-3 mr-1" /> Standalone ({standaloneCharts.length})</TabsTrigger>
            <TabsTrigger value="dashboard"><LayoutDashboard className="h-3 w-3 mr-1" /> In Dashboards ({dashboardCharts.length})</TabsTrigger>
            <TabsTrigger value="all"><BarChart3 className="h-3 w-3 mr-1" /> All ({charts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="standalone" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {standaloneCharts.map(chart => (
                <ChartCard
                  key={chart.id}
                  chart={chart}
                  expanded={expandedId === chart.id}
                  onToggle={() => setExpandedId(expandedId === chart.id ? null : chart.id)}
                  onDelete={handleDelete}
                  onInsertDashboard={(chartId) => { setSelectedChartId(chartId); setShowInsertDialog(true); }}
                  onEdit={(chart) => setEditingChart(chart)}
                  parseConfig={parseConfig}
                />
              ))}
              {standaloneCharts.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No standalone charts</p>
                  <p className="text-sm text-muted-foreground mt-1">Create a chart without assigning it to a dashboard</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardCharts.map(chart => (
                <ChartCard
                  key={chart.id}
                  chart={chart}
                  expanded={expandedId === chart.id}
                  onToggle={() => setExpandedId(expandedId === chart.id ? null : chart.id)}
                  onDelete={handleDelete}
                  onInsertDashboard={() => {}}
                  onEdit={(chart) => setEditingChart(chart)}
                  parseConfig={parseConfig}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {charts.map(chart => (
                <ChartCard
                  key={chart.id}
                  chart={chart}
                  expanded={expandedId === chart.id}
                  onToggle={() => setExpandedId(expandedId === chart.id ? null : chart.id)}
                  onDelete={handleDelete}
                  onInsertDashboard={(chartId) => { if (!chart.dashboardId) { setSelectedChartId(chartId); setShowInsertDialog(true); } }}
                  onEdit={(chart) => setEditingChart(chart)}
                  parseConfig={parseConfig}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Insert to Dashboard Dialog */}
      <Dialog open={showInsertDialog} onOpenChange={setShowInsertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Insert Chart into Dashboard</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a dashboard to insert this chart into.</p>
            <Select value={insertDashboardId} onValueChange={setInsertDashboardId}>
              <SelectTrigger><SelectValue placeholder="Select dashboard" /></SelectTrigger>
              <SelectContent>
                {dashboards.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInsertDialog(false)}>Cancel</Button>
            <Button onClick={handleInsertToDashboard} disabled={!insertDashboardId} className="bg-emerald-600 hover:bg-emerald-700">
              <LayoutDashboard className="h-3 w-3 mr-1" /> Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chart Editor Modal */}
      {editingChart && (
        <ChartEditor
          chart={editingChart}
          onSave={handleSaveChart}
          onCancel={() => setEditingChart(null)}
          connectors={connectors}
          datasets={datasets}
        />
      )}
    </div>
  );
}

// ── Chart Card with real rendering ──
function ChartCard({ chart, expanded, onToggle, onDelete, onInsertDashboard, onEdit, parseConfig }: {
  chart: ChartDetailData;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onInsertDashboard: (chartId: string) => void;
  onEdit: (chart: ChartDetailData) => void;
  parseConfig: (s: string | null) => ChartConfig;
}) {
  const config = parseConfig(chart.config);
  const isStandalone = !chart.dashboardId;
  const demoData = useMemo(() => generateDemoData(chart.chartType, null, chart.config), [chart.chartType, chart.config]);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <button className="w-full text-left" onClick={onToggle}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[9px] capitalize ${chartTypeColors[chart.chartType] || 'bg-gray-50'}`}>
                {chart.chartType}
              </Badge>
              <CardTitle className="text-sm">{chart.name}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {isStandalone && <Badge variant="outline" className="text-[8px] text-amber-700">standalone</Badge>}
              <Badge variant={chart.status === 'published' ? 'secondary' : 'outline'} className="text-[9px]">{chart.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Real Chart Preview */}
          <div className="h-40 bg-white rounded-lg border overflow-hidden">
            <ChartRenderer chartType={chart.chartType} data={demoData} config={config} height={160} />
          </div>

          {/* Metrics & Info */}
          <div className="mt-2 flex flex-wrap gap-1 items-center">
            {chart.chartMetrics.map(cm => (
              <Badge key={cm.id} variant="secondary" className="text-[9px]">
                <LineChartIcon className="h-2.5 w-2.5 mr-0.5" /> {cm.metric.name}
              </Badge>
            ))}
            {chart.dashboard && (
              <Badge variant="outline" className="text-[9px]">
                <LayoutDashboard className="h-2.5 w-2.5 mr-0.5" /> {chart.dashboard.name}
              </Badge>
            )}
            {chart.datasetId && (
              <Badge variant="outline" className="text-[9px]">
                <Layers className="h-2.5 w-2.5 mr-0.5" /> Dataset
              </Badge>
            )}
            {chart.customSQL && (
              <Badge variant="outline" className="text-[9px]">
                <Code2 className="h-2.5 w-2.5 mr-0.5" /> SQL
              </Badge>
            )}
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t bg-muted/30 p-3 space-y-3">
          {chart.description && <p className="text-xs text-muted-foreground">{chart.description}</p>}
          {chart.customSQL && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Custom SQL</p>
              <pre className="text-[10px] font-mono bg-black/5 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{chart.customSQL}</pre>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); onEdit(chart); }}>
                <Edit3 className="h-2.5 w-2.5 mr-1" /> Open in Builder
              </Button>
              {isStandalone && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); onInsertDashboard(chart.id); }}>
                  <LayoutDashboard className="h-2.5 w-2.5 mr-1" /> Insert to Dashboard
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[8px]"><GitBranch className="h-2 w-2 mr-0.5" />{chart.branch}</Badge>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(chart.id); }}>
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
