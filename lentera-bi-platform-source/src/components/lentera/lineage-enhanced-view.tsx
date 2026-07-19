'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, Database, GitBranch, BarChart3, LayoutDashboard, LineChart,
  ZoomIn, ZoomOut, Maximize, Code2, Terminal, RefreshCw, ArrowRight, Layers,
} from 'lucide-react';
import ReactFlow, { Node, Edge, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, NodeProps, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';

interface LineageData {
  nodes: Array<{
    id: string;
    externalId: string;
    name: string;
    type: string;
    platform: string;
    qualifiedName: string;
    description: string | null;
    owner: string | null;
    status: string | null;
    metadata: Record<string, unknown> | null;
    findings: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    confidence: string;
    extractionMethod: string | null;
    expression: string | null;
    sourcePlatform: string | null;
  }>;
}

const typeConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  source: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', icon: <Database className="h-3.5 w-3.5" />, label: 'Source' },
  model: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: <GitBranch className="h-3.5 w-3.5" />, label: 'Model' },
  dataset: { color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-300', icon: <Database className="h-3.5 w-3.5" />, label: 'Dataset' },
  chart: { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-300', icon: <BarChart3 className="h-3.5 w-3.5" />, label: 'Chart' },
  dashboard: { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-300', icon: <LayoutDashboard className="h-3.5 w-3.5" />, label: 'Dashboard' },
  metric: { color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-300', icon: <LineChart className="h-3.5 w-3.5" />, label: 'Metric' },
  column: { color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-300', icon: <Database className="h-3.5 w-3.5" />, label: 'Column' },
  filter: { color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-300', icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Filter' },
  dimension: { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-300', icon: <BarChart3 className="h-3.5 w-3.5" />, label: 'Dimension' },
  time_dimension: { color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-300', icon: <LineChart className="h-3.5 w-3.5" />, label: 'Time Dim' },
  transform: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', icon: <Code2 className="h-3.5 w-3.5" />, label: 'SQL Transform' },
  python_transform: { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', icon: <Terminal className="h-3.5 w-3.5" />, label: 'ML/Python' },
};

const confidenceColors: Record<string, string> = {
  verified: '#16a34a', declared: '#2563eb', inferred: '#d97706', partial: '#ea580c', unknown: '#9ca3af',
};

function CustomNode({ data }: NodeProps) {
  const config = typeConfig[data.nodeType as string] || typeConfig.source;
  return (
    <div className={`px-3 py-2 rounded-lg border-2 ${config.bg} ${config.border} shadow-sm min-w-[140px] max-w-[220px]`}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-2 !h-2" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={config.color}>{config.icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{config.label}</span>
        {data.findings > 0 && (
          <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold">{data.findings}</span>
        )}
      </div>
      <p className="text-xs font-semibold truncate" title={data.label}>{data.label}</p>
      {data.platform && <p className="text-[9px] text-muted-foreground mt-0.5">{data.platform}</p>}
      <Handle type="source" position={Position.Right} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

function layoutNodes(nodes: LineageData['nodes'], edges: LineageData['edges']): { nodes: Node[], edges: Edge[] } {
  const layerOrder = ['source', 'column', 'model', 'dataset', 'transform', 'python_transform', 'metric', 'filter', 'dimension', 'time_dimension', 'chart', 'dashboard'];
  const nodesByLayer: Record<string, LineageData['nodes']> = {};
  nodes.forEach(n => {
    const layer = layerOrder.indexOf(n.type) >= 0 ? n.type : 'model';
    if (!nodesByLayer[layer]) nodesByLayer[layer] = [];
    nodesByLayer[layer].push(n);
  });

  const activeLayers = layerOrder.filter(l => nodesByLayer[l]?.length > 0);
  const xSpacing = 280;
  const ySpacing = 90;
  const positionMap: Record<string, { x: number; y: number }> = {};

  activeLayers.forEach((layer, layerIdx) => {
    const layerNodes = nodesByLayer[layer];
    const x = layerIdx * xSpacing + 50;
    layerNodes.forEach((n, nodeIdx) => {
      positionMap[n.id] = { x, y: nodeIdx * ySpacing + 50 };
    });
  });

  const rfNodes: Node[] = nodes.map(n => ({
    id: n.id,
    type: 'custom',
    position: positionMap[n.id] || { x: 0, y: 0 },
    data: { label: n.name, nodeType: n.type, platform: n.platform, qualifiedName: n.qualifiedName, findings: n.findings },
  }));

  const rfEdges: Edge[] = edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.confidence === 'inferred' || e.confidence === 'partial',
    style: { stroke: confidenceColors[e.confidence] || '#9ca3af', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: confidenceColors[e.confidence] || '#9ca3af' },
    label: e.type.replace('_', ' '),
    labelStyle: { fontSize: 9, fill: '#666' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

export function LineageEnhancedView({ data }: { data: LineageData }) {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');

  const filteredNodes = useMemo(() => {
    let filtered = data.nodes;
    if (filterType !== 'all') filtered = filtered.filter(n => n.type === filterType);
    if (filterPlatform !== 'all') filtered = filtered.filter(n => n.platform === filterPlatform);
    return filtered;
  }, [data.nodes, filterType, filterPlatform]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() => data.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)), [data.edges, filteredNodeIds]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => layoutNodes(filteredNodes, filteredEdges), [filteredNodes, filteredEdges]);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => { setRfNodes(layoutedNodes); }, [layoutedNodes, setRfNodes]);
  useEffect(() => { setRfEdges(layoutedEdges); }, [layoutedEdges, setRfEdges]);

  const platforms = [...new Set(data.nodes.map(n => n.platform))];
  const types = [...new Set(data.nodes.map(n => n.type))];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter by platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredNodes.length} nodes • {filteredEdges.length} edges</span>
      </div>

      {/* Legend - including new types */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(typeConfig).filter(([k]) => types.includes(k) || k === 'transform' || k === 'python_transform').map(([type, config]) => (
          <div key={type} className="flex items-center gap-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${config.bg} ${config.border} ${config.color}`}>
              {config.icon} {config.label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-muted-foreground">Confidence:</span>
          {Object.entries(confidenceColors).map(([conf, color]) => (
            <span key={conf} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5" style={{ backgroundColor: color }}></span>
              <span className="capitalize">{conf}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Graph */}
      <Card className="overflow-hidden">
        <div style={{ height: '600px', width: '100%' }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(n) => {
                const config = typeConfig[(n.data as Record<string, unknown>)?.nodeType as string];
                return config ? '#999' : '#999';
              }}
            />
          </ReactFlow>
        </div>
      </Card>
    </div>
  );
}
