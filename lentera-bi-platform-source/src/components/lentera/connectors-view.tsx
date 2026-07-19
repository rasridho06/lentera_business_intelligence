'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Database, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertCircle,
  Table2, Eye, LayoutGrid, ChevronRight, ChevronDown, Server, Cable,
  Upload, FileText, FileSpreadsheet, FileJson, FileArchive,
  Loader2, Wifi, WifiOff, Zap, HardDrive,
} from 'lucide-react';
import type { Connector, DataSourceTable, ConnectionTestResult, FileUploadResult } from '@/types';

const MAX_FILE_SIZE_MB = 100;

const dbConnectorTypes: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string; defaultPort: number; demoHost: string; demoUser: string; demoPass: string }> = {
  clickhouse: { icon: <Database className="h-5 w-5" />, color: 'text-amber-700', bg: 'bg-amber-50', label: 'ClickHouse', defaultPort: 9000, demoHost: 'demo-clickhouse', demoUser: 'default', demoPass: '' },
  postgres: { icon: <Database className="h-5 w-5" />, color: 'text-sky-700', bg: 'bg-sky-50', label: 'PostgreSQL', defaultPort: 5432, demoHost: 'demo-postgres', demoUser: 'postgres', demoPass: 'postgres' },
  mysql: { icon: <Database className="h-5 w-5" />, color: 'text-blue-700', bg: 'bg-blue-50', label: 'MySQL', defaultPort: 3306, demoHost: 'demo-mysql', demoUser: 'root', demoPass: 'root' },
  bigquery: { icon: <Database className="h-5 w-5" />, color: 'text-indigo-700', bg: 'bg-indigo-50', label: 'BigQuery', defaultPort: 443, demoHost: 'demo-bigquery', demoUser: 'service-account', demoPass: 'key.json' },
  snowflake: { icon: <Database className="h-5 w-5" />, color: 'text-cyan-700', bg: 'bg-cyan-50', label: 'Snowflake', defaultPort: 443, demoHost: 'demo-snowflake', demoUser: 'admin', demoPass: 'Snowflake123!' },
  redshift: { icon: <Database className="h-5 w-5" />, color: 'text-rose-700', bg: 'bg-rose-50', label: 'Redshift', defaultPort: 5439, demoHost: 'demo-redshift', demoUser: 'awsuser', demoPass: 'Redshift123!' },
  sqlite: { icon: <Database className="h-5 w-5" />, color: 'text-gray-700', bg: 'bg-gray-50', label: 'SQLite', defaultPort: 0, demoHost: 'local', demoUser: '', demoPass: '' },
};

const fileConnectorTypes: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string; accept: string }> = {
  csv: { icon: <FileText className="h-5 w-5" />, color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'CSV', accept: '.csv,.tsv,.txt' },
  json: { icon: <FileJson className="h-5 w-5" />, color: 'text-amber-700', bg: 'bg-amber-50', label: 'JSON', accept: '.json,.jsonl,.ndjson' },
  excel: { icon: <FileSpreadsheet className="h-5 w-5" />, color: 'text-green-700', bg: 'bg-green-50', label: 'Excel', accept: '.xlsx,.xls' },
  parquet: { icon: <FileArchive className="h-5 w-5" />, color: 'text-violet-700', bg: 'bg-violet-50', label: 'Parquet', accept: '.parquet,.pq' },
};

const tableTypeIcons: Record<string, React.ReactNode> = {
  table: <Table2 className="h-4 w-4" />,
  view: <Eye className="h-4 w-4" />,
  materialized_view: <LayoutGrid className="h-4 w-4" />,
};



export function ConnectorsView() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMode, setAddMode] = useState<'database' | 'file'>('database');
  const [newDbConnector, setNewDbConnector] = useState({
    name: '', type: 'clickhouse', host: '', port: '9000', database: '', username: '', password: '', schema: '',
  });
  const [newFileConnector, setNewFileConnector] = useState({
    name: '', type: 'csv', filePath: '', sheet: '', delimiter: ',', encoding: 'utf-8', header: 'true',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<FileUploadResult | null>(null);

  // Connection test state
  const [testingConnection, setTestingConnection] = useState<string | null>(null); // connector ID being tested
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testForm, setTestForm] = useState({
    type: 'clickhouse', host: '', port: '9000', username: '', password: '', database: '',
  });

  const loadConnectors = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/connectors');
    const data = await res.json();
    setConnectors(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadConnectors, 0);
    return () => clearTimeout(timer);
  }, [loadConnectors]);

  // ── Database Connection Test ──
  const handleTestConnection = async (connectorId?: string) => {
    const connId = connectorId || testingConnection;
    setTestResult(null);

    try {
      const res = await fetch('/api/connectors-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testForm,
          port: parseInt(testForm.port) || 0,
          connectorId: connId || undefined,
        }),
      });
      const result: ConnectionTestResult = await res.json();
      setTestResult(result);

      if (result.success && connId) {
        // Reload to get synced tables
        loadConnectors();
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Network error: could not reach the server',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const openTestDialog = (connector?: Connector) => {
    if (connector) {
      setTestingConnection(connector.id);
      setTestForm({
        type: connector.type,
        host: connector.host || '',
        port: String(connector.port || ''),
        username: connector.username || '',
        password: connector.password || '',
        database: connector.database || '',
      });
    } else {
      setTestingConnection(null);
      const dbType = newDbConnector.type;
      const config = dbConnectorTypes[dbType];
      setTestForm({
        type: dbType,
        host: config?.demoHost || '',
        port: String(config?.defaultPort || ''),
        username: config?.demoUser || '',
        password: config?.demoPass || '',
        database: '',
      });
    }
    setTestResult(null);
    setShowTestDialog(true);
  };

  const fillDemoCredentials = () => {
    const config = dbConnectorTypes[testForm.type];
    if (config) {
      setTestForm(prev => ({
        ...prev,
        host: config.demoHost,
        port: String(config.defaultPort),
        username: config.demoUser,
        password: config.demoPass,
      }));
    }
  };

  const handleAddDatabase = async () => {
    await fetch('/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newDbConnector,
        port: newDbConnector.port ? parseInt(newDbConnector.port) : null,
        category: 'olap',
      }),
    });
    setShowAddDialog(false);
    setNewDbConnector({ name: '', type: 'clickhouse', host: '', port: '9000', database: '', username: '', password: '', schema: '' });
    loadConnectors();
  };

  // ── Real File Upload ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size validation
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadResult({
        success: false,
        error: `File too large: ${(file.size / (1024 * 1024)).toFixed(2)} MB. Maximum allowed: ${MAX_FILE_SIZE_MB} MB.`,
      });
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setUploadResult(null);
  };

  const handleAddFile = async () => {
    if (!selectedFile && !newFileConnector.name) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();

      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      formData.append('name', newFileConnector.name || selectedFileName);
      formData.append('type', newFileConnector.type);
      formData.append('delimiter', newFileConnector.delimiter);
      formData.append('encoding', newFileConnector.encoding);
      formData.append('header', newFileConnector.header);
      if (newFileConnector.sheet) {
        formData.append('sheet', newFileConnector.sheet);
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result: FileUploadResult = await res.json();
      setUploadResult(result);

      if (result.success && result.schema) {
        // Create connector with uploaded file schema
        const connectorRes = await fetch('/api/connectors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newFileConnector.name || selectedFileName,
            type: newFileConnector.type,
            category: 'file',
            filePath: result.file?.path || `/uploads/${selectedFileName}`,
            fileConfig: {
              sheet: newFileConnector.sheet || undefined,
              delimiter: newFileConnector.delimiter,
              encoding: newFileConnector.encoding,
              header: newFileConnector.header === 'true',
              sizeBytes: result.file?.size,
              rowCount: result.schema.rowCount,
              columns: result.schema.columns,
            },
          }),
        });
        const newConnector = await connectorRes.json();

        // Update the connector's table with real parsed schema
        if (result.schema.columns && newConnector.id) {
          await fetch('/api/connectors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              // Update table columns via the auto-creation logic
              ...newFileConnector,
              type: newFileConnector.type,
              fileConfig: {
                columns: result.schema.columns.map((c: { name: string; type: string; nullable: boolean }) => ({
                  name: c.name,
                  type: c.type,
                  nullable: c.nullable,
                })),
                rowCount: result.schema.rowCount,
              },
            }),
          });
        }

        // Wait a moment to show success, then reload
        setTimeout(() => {
          setShowAddDialog(false);
          setSelectedFile(null);
          setSelectedFileName('');
          setUploadResult(null);
          setUploading(false);
          setUploadProgress(0);
          setNewFileConnector({ name: '', type: 'csv', filePath: '', sheet: '', delimiter: ',', encoding: 'utf-8', header: 'true' });
          loadConnectors();
        }, 1500);
      }
    } catch (err) {
      setUploadResult({
        success: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/connectors?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    loadConnectors();
  };

  // ── Sync tables for a connector ──
  const handleSync = async (connector: Connector) => {
    // Update connector status to syncing
    await fetch('/api/connectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: connector.id, status: 'syncing' }),
    });
    loadConnectors();

    // Test connection to re-sync tables
    const res = await fetch('/api/connectors-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: connector.type,
        host: connector.host || '',
        port: connector.port || 0,
        username: connector.username || '',
        password: connector.password || '',
        database: connector.database || '',
        connectorId: connector.id,
      }),
    });
    const result = await res.json();

    if (!result.success) {
      // Mark as error
      await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: connector.id, status: 'error' }),
      });
    }
    loadConnectors();
  };

  const parseColumns = (columnsJson: string | null) => {
    if (!columnsJson) return [];
    try { return JSON.parse(columnsJson); } catch { return []; }
  };

  const groupTablesBySchema = (tables: DataSourceTable[]) => {
    const groups: Record<string, DataSourceTable[]> = {};
    tables.forEach(t => {
      const schema = t.schema || 'default';
      if (!groups[schema]) groups[schema] = [];
      groups[schema].push(t);
    });
    return groups;
  };

  const getConnectorConfig = (connector: Connector) => {
    if (dbConnectorTypes[connector.type]) return dbConnectorTypes[connector.type];
    if (fileConnectorTypes[connector.type]) return { icon: fileConnectorTypes[connector.type].icon, color: fileConnectorTypes[connector.type].color, bg: fileConnectorTypes[connector.type].bg, label: fileConnectorTypes[connector.type].label, defaultPort: 0, demoHost: '', demoUser: '', demoPass: '' };
    return { icon: <Database className="h-5 w-5" />, color: 'text-gray-700', bg: 'bg-gray-50', label: connector.type, defaultPort: 0, demoHost: '', demoUser: '', demoPass: '' };
  };

  const dbConnectors = connectors.filter(c => c.category !== 'file');
  const fileConnectors = connectors.filter(c => c.category === 'file');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Data Sources</h2>
          <p className="text-sm text-muted-foreground">Connect to OLTP/OLAP databases or upload CSV, JSON, Excel, and Parquet files (max {MAX_FILE_SIZE_MB} MB)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openTestDialog()}>
            <Wifi className="h-4 w-4 mr-1" /> Test Connection
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-1" /> Add Data Source
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Data Source</DialogTitle>
              </DialogHeader>

              <Tabs value={addMode} onValueChange={(v) => setAddMode(v as 'database' | 'file')}>
                <TabsList className="w-full">
                  <TabsTrigger value="database" className="flex-1"><Database className="h-3 w-3 mr-1" /> Database</TabsTrigger>
                  <TabsTrigger value="file" className="flex-1"><Upload className="h-3 w-3 mr-1" /> File Upload</TabsTrigger>
                </TabsList>

                <TabsContent value="database" className="mt-4 space-y-3">
                  <Select value={newDbConnector.type} onValueChange={(v) => {
                    const config = dbConnectorTypes[v];
                    setNewDbConnector(prev => ({
                      ...prev, type: v,
                      port: config?.defaultPort ? String(config.defaultPort) : '',
                    }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select database type" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(dbConnectorTypes).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">{config.icon} {config.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input placeholder="Connection name" value={newDbConnector.name} onChange={(e) => setNewDbConnector(prev => ({ ...prev, name: e.target.value }))} />

                  {/* DBeaver-like connection form */}
                  <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connection Details</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Host</Label>
                        <Input placeholder="e.g., clickhouse.production.internal" value={newDbConnector.host} onChange={(e) => setNewDbConnector(prev => ({ ...prev, host: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Port</Label>
                        <Input placeholder="9000" value={newDbConnector.port} onChange={(e) => setNewDbConnector(prev => ({ ...prev, port: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Database</Label>
                      <Input placeholder="e.g., booking_production" value={newDbConnector.database} onChange={(e) => setNewDbConnector(prev => ({ ...prev, database: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Username</Label>
                        <Input placeholder="default" value={newDbConnector.username} onChange={(e) => setNewDbConnector(prev => ({ ...prev, username: e.target.value }))} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Password</Label>
                        <Input placeholder="••••••••" type="password" value={newDbConnector.password} onChange={(e) => setNewDbConnector(prev => ({ ...prev, password: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Schema (optional)</Label>
                      <Input placeholder="e.g., analytics" value={newDbConnector.schema} onChange={(e) => setNewDbConnector(prev => ({ ...prev, schema: e.target.value }))} />
                    </div>
                    {/* Quick fill demo credentials */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-emerald-600 hover:text-emerald-700 h-7"
                      onClick={() => {
                        const config = dbConnectorTypes[newDbConnector.type];
                        if (config) {
                          setNewDbConnector(prev => ({
                            ...prev,
                            host: config.demoHost,
                            port: String(config.defaultPort),
                            username: config.demoUser,
                            password: config.demoPass,
                            name: prev.name || `${config.label} Demo`,
                          }));
                        }
                      }}
                    >
                      <Zap className="h-3 w-3 mr-1" /> Fill demo credentials
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="file" className="mt-4 space-y-3">
                  <Select value={newFileConnector.type} onValueChange={(v) => setNewFileConnector(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select file type" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(fileConnectorTypes).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">{config.icon} {config.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input placeholder="Dataset name (optional — uses filename if empty)" value={newFileConnector.name} onChange={(e) => setNewFileConnector(prev => ({ ...prev, name: e.target.value }))} />

                  {/* Real File Upload Area */}
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors relative"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept={fileConnectorTypes[newFileConnector.type]?.accept}
                      onChange={handleFileChange}
                    />
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    {selectedFileName ? (
                      <div>
                        <p className="text-sm font-medium text-emerald-700">{selectedFileName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change` : 'Click to change file'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-muted-foreground">Click to upload {fileConnectorTypes[newFileConnector.type]?.label} file</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Accepts: {fileConnectorTypes[newFileConnector.type]?.accept} • Max: {MAX_FILE_SIZE_MB} MB
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Upload Progress */}
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Uploading...</span>
                        <span className="font-medium">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  {/* Upload Result */}
                  {uploadResult && (
                    <div className={`p-3 rounded-lg text-xs ${uploadResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                      {uploadResult.success ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle className="h-3 w-3" /> Upload successful!
                          </div>
                          <p className="text-muted-foreground">File: {uploadResult.file?.name} ({uploadResult.file?.sizeMB})</p>
                          {uploadResult.schema && (
                            <p className="text-muted-foreground">
                              Schema detected: {uploadResult.schema.rowCount} rows, {uploadResult.schema.columns.length} columns
                            </p>
                          )}
                          {uploadResult.parseError && (
                            <p className="text-amber-600"><AlertCircle className="h-3 w-3 inline mr-1" />{uploadResult.parseError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-700 font-medium">
                          <XCircle className="h-3 w-3" /> {uploadResult.error}
                        </div>
                      )}
                    </div>
                  )}

                  {/* File Preview */}
                  {uploadResult?.success && uploadResult.preview && uploadResult.preview.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Preview (first 5 rows)</Label>
                      <div className="overflow-auto max-h-40 border rounded-lg">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-muted/50">
                              {Object.keys(uploadResult.preview[0]).map(key => (
                                <th key={key} className="text-left p-1.5 font-medium">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {uploadResult.preview.map((row, i) => (
                              <tr key={i} className="border-t">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="p-1.5">{String(val ?? '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* File-specific options */}
                  <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">File Options</p>
                    {newFileConnector.type === 'csv' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Delimiter</Label>
                            <Select value={newFileConnector.delimiter} onValueChange={(v) => setNewFileConnector(prev => ({ ...prev, delimiter: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value=",">Comma (,)</SelectItem>
                                <SelectItem value=";">Semicolon (;)</SelectItem>
                                <SelectItem value="\t">Tab</SelectItem>
                                <SelectItem value="|">Pipe (|)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Encoding</Label>
                            <Select value={newFileConnector.encoding} onValueChange={(v) => setNewFileConnector(prev => ({ ...prev, encoding: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="utf-8">UTF-8</SelectItem>
                                <SelectItem value="latin-1">Latin-1</SelectItem>
                                <SelectItem value="utf-16">UTF-16</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Header Row</Label>
                          <Select value={newFileConnector.header} onValueChange={(v) => setNewFileConnector(prev => ({ ...prev, header: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Yes — first row is headers</SelectItem>
                              <SelectItem value="false">No — generate column names</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    {newFileConnector.type === 'excel' && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Sheet Name (optional)</Label>
                        <Input placeholder="e.g., Sheet1" value={newFileConnector.sheet} onChange={(e) => setNewFileConnector(prev => ({ ...prev, sheet: e.target.value }))} />
                      </div>
                    )}
                    {newFileConnector.type === 'json' && (
                      <p className="text-xs text-muted-foreground">Supports JSON array, JSON Lines (NDJSON), and nested JSON formats. Auto-detected on upload.</p>
                    )}
                    {newFileConnector.type === 'parquet' && (
                      <p className="text-xs text-muted-foreground">Parquet files are self-describing — schema will be auto-detected from the file metadata.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowAddDialog(false); setSelectedFile(null); setSelectedFileName(''); setUploadResult(null); }}>Cancel</Button>
                <Button
                  onClick={addMode === 'database' ? handleAddDatabase : handleAddFile}
                  disabled={addMode === 'database' ? !newDbConnector.name : (!newFileConnector.name && !selectedFile) || uploading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {addMode === 'database' ? (
                    <><Cable className="h-4 w-4 mr-1" /> Connect</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-1" /> {uploading ? 'Uploading...' : 'Upload & Connect'}</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Connector List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all"><Database className="h-3 w-3 mr-1" /> All ({connectors.length})</TabsTrigger>
            <TabsTrigger value="oltp_olap"><Server className="h-3 w-3 mr-1" /> OLTP/OLAP ({dbConnectors.length})</TabsTrigger>
            <TabsTrigger value="file"><Upload className="h-3 w-3 mr-1" /> File ({fileConnectors.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-4">
            {connectors.map(c => (
              <ConnectorCard
                key={c.id}
                connector={c}
                expanded={expandedConnector}
                onExpand={setExpandedConnector}
                expandedTable={expandedTable}
                onExpandTable={setExpandedTable}
                onDelete={handleDelete}
                onSync={handleSync}
                onTest={openTestDialog}
                parseColumns={parseColumns}
                groupTablesBySchema={groupTablesBySchema}
                getConnectorConfig={getConnectorConfig}
              />
            ))}
            {connectors.length === 0 && <EmptyState />}
          </TabsContent>

          <TabsContent value="oltp_olap" className="mt-4 space-y-4">
            {dbConnectors.map(c => (
              <ConnectorCard
                key={c.id}
                connector={c}
                expanded={expandedConnector}
                onExpand={setExpandedConnector}
                expandedTable={expandedTable}
                onExpandTable={setExpandedTable}
                onDelete={handleDelete}
                onSync={handleSync}
                onTest={openTestDialog}
                parseColumns={parseColumns}
                groupTablesBySchema={groupTablesBySchema}
                getConnectorConfig={getConnectorConfig}
              />
            ))}
            {dbConnectors.length === 0 && <EmptyState type="database" />}
          </TabsContent>

          <TabsContent value="file" className="mt-4 space-y-4">
            {fileConnectors.map(c => (
              <ConnectorCard
                key={c.id}
                connector={c}
                expanded={expandedConnector}
                onExpand={setExpandedConnector}
                expandedTable={expandedTable}
                onExpandTable={setExpandedTable}
                onDelete={handleDelete}
                onSync={handleSync}
                onTest={() => {}}
                parseColumns={parseColumns}
                groupTablesBySchema={groupTablesBySchema}
                getConnectorConfig={getConnectorConfig}
              />
            ))}
            {fileConnectors.length === 0 && <EmptyState type="file" />}
          </TabsContent>
        </Tabs>
      )}

      {/* Connection Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Test Database Connection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={testForm.type} onValueChange={(v) => {
              setTestForm(prev => ({ ...prev, type: v }));
              const config = dbConnectorTypes[v];
              if (config) {
                setTestForm(prev => ({ ...prev, port: String(config.defaultPort) }));
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Database type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(dbConnectorTypes).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">{config.icon} {config.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Host</Label>
                <Input
                  placeholder="demo-clickhouse"
                  value={testForm.host}
                  onChange={(e) => setTestForm(prev => ({ ...prev, host: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Port</Label>
                <Input
                  placeholder="9000"
                  value={testForm.port}
                  onChange={(e) => setTestForm(prev => ({ ...prev, port: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Database</Label>
              <Input
                placeholder="my_database"
                value={testForm.database}
                onChange={(e) => setTestForm(prev => ({ ...prev, database: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Username</Label>
                <Input
                  placeholder="default"
                  value={testForm.username}
                  onChange={(e) => setTestForm(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Password</Label>
                <Input
                  placeholder="••••••••"
                  type="password"
                  value={testForm.password}
                  onChange={(e) => setTestForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>

            <Button variant="ghost" size="sm" className="text-xs text-emerald-600 h-7" onClick={fillDemoCredentials}>
              <Zap className="h-3 w-3 mr-1" /> Fill demo credentials
            </Button>

            {/* Test Result */}
            {testResult && (
              <div className={`p-3 rounded-lg text-xs space-y-1 ${testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-1 font-medium">
                  {testResult.success ? (
                    <><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Connection Successful</>
                  ) : (
                    <><XCircle className="h-3.5 w-3.5 text-red-600" /> Connection Failed</>
                  )}
                </div>
                <p className={testResult.success ? 'text-emerald-700' : 'text-red-700'}>{testResult.message}</p>
                {testResult.latency && <p className="text-muted-foreground">Latency: {testResult.latency}ms</p>}
                {testResult.version && <p className="text-muted-foreground">Version: {testResult.version}</p>}
                {testResult.tables && testResult.tables.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="font-medium text-emerald-700">Tables synced ({testResult.tables.length}):</p>
                    {testResult.tables.map(t => (
                      <div key={`${t.schema}.${t.name}`} className="flex items-center gap-2 text-muted-foreground">
                        <Table2 className="h-3 w-3" />
                        <span className="font-mono">{t.schema}.{t.name}</span>
                        <Badge variant="outline" className="text-[8px]">{t.type}</Badge>
                        <span className="text-[9px]">{t.rowCount.toLocaleString()} rows</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>Close</Button>
            <Button
              onClick={() => handleTestConnection()}
              disabled={!testForm.host}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Wifi className="h-4 w-4 mr-1" /> Test Connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Connector Card with Sync & Test ──
function ConnectorCard({ connector, expanded, onExpand, expandedTable, onExpandTable, onDelete, onSync, onTest, parseColumns, groupTablesBySchema, getConnectorConfig }: {
  connector: Connector;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  expandedTable: string | null;
  onExpandTable: (id: string | null) => void;
  onDelete: (id: string) => void;
  onSync: (connector: Connector) => void;
  onTest: (connector: Connector) => void;
  parseColumns: (json: string | null) => Array<{ name: string; type: string; nullable?: boolean; isPK?: boolean }>;
  groupTablesBySchema: (tables: DataSourceTable[]) => Record<string, DataSourceTable[]>;
  getConnectorConfig: (c: Connector) => { icon: React.ReactNode; color: string; bg: string; label: string; defaultPort: number };
}) {
  const config = getConnectorConfig(connector);
  const isExpanded = expanded === connector.id;
  const isFile = connector.category === 'file';
  const tableGroups = groupTablesBySchema(connector.tables);
  const schemaCount = Object.keys(tableGroups).length;
  const isSyncing = connector.status === 'syncing';
  const totalRows = connector.tables.reduce((sum, t) => sum + (t.rowCount || 0), 0);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
        onClick={() => onExpand(isExpanded ? null : connector.id)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${config.bg} ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{connector.name}</span>
              <Badge variant="outline" className="text-[10px]">{config.label}</Badge>
              <Badge variant={connector.category === 'file' ? 'outline' : 'secondary'} className="text-[10px]">
                {isFile ? 'FILE' : connector.category?.toUpperCase() || 'OLAP'}
              </Badge>
              <Badge variant={connector.status === 'connected' ? 'secondary' : connector.status === 'syncing' ? 'outline' : 'destructive'} className="text-[10px]">
                {connector.status === 'connected' ? <CheckCircle className="h-3 w-3 mr-0.5" /> :
                 connector.status === 'syncing' ? <Loader2 className="h-3 w-3 mr-0.5 animate-spin" /> :
                 connector.status === 'error' ? <AlertCircle className="h-3 w-3 mr-0.5" /> :
                 <XCircle className="h-3 w-3 mr-0.5" />}
                {connector.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFile
                ? `File: ${connector.filePath || 'uploaded'}`
                : `${connector.host}${connector.port ? `:${connector.port}` : ''} • ${connector.database || 'no database'}`
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <p>{connector.tables.length} table{connector.tables.length !== 1 ? 's' : ''}</p>
              {!isFile && <p>{schemaCount} schema{schemaCount !== 1 ? 's' : ''}</p>}
              {totalRows > 0 && <p className="text-[9px]">{totalRows >= 1000000 ? `${(totalRows / 1000000).toFixed(1)}M` : totalRows >= 1000 ? `${(totalRows / 1000).toFixed(0)}K` : totalRows} rows total</p>}
            </div>
            {connector.lastSyncAt && (
              <div className="text-[9px] text-muted-foreground text-right">
                <HardDrive className="h-3 w-3 inline mr-0.5" />
                Last sync: {new Date(connector.lastSyncAt).toLocaleTimeString()}
              </div>
            )}
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t bg-muted/30">
          <div className="p-3 flex gap-2 border-b">
            {!isFile && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onSync(connector)} disabled={isSyncing}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} /> {isSyncing ? 'Syncing...' : 'Sync Tables'}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onTest(connector)}>
                  <Wifi className="h-3 w-3 mr-1" /> Test Connection
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => onDelete(connector.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
          <ScrollArea className="max-h-96">
            {connector.tables.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {!isFile ? 'No tables synced yet. Click "Sync Tables" to fetch the schema.' : 'File schema not loaded. Try re-uploading.'}
              </div>
            ) : (
              Object.entries(tableGroups).map(([schema, tables]) => (
                <div key={schema} className="border-b last:border-b-0">
                  {!isFile && (
                    <div className="px-4 py-2 bg-muted/50 flex items-center gap-2">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{schema}</span>
                      <Badge variant="outline" className="text-[9px] ml-1">{tables.length}</Badge>
                    </div>
                  )}
                  {tables.map((table) => {
                    const isTableExpanded = expandedTable === table.id;
                    const columns = parseColumns(table.columns);

                    return (
                      <div key={table.id} className="border-t first:border-t-0">
                        <button
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-2"
                          onClick={() => onExpandTable(isTableExpanded ? null : table.id)}
                        >
                          <span className="text-muted-foreground">
                            {tableTypeIcons[table.type] || <Table2 className="h-4 w-4" />}
                          </span>
                          <span className="text-sm font-medium">{table.name}</span>
                          <Badge variant="outline" className="text-[9px] capitalize">{table.type.replace('_', ' ')}</Badge>
                          {table.rowCount && (
                            <span className="text-[10px] text-muted-foreground ml-auto mr-2">
                              {table.rowCount >= 1000000 ? `${(table.rowCount / 1000000).toFixed(1)}M` : table.rowCount >= 1000 ? `${(table.rowCount / 1000).toFixed(0)}K` : table.rowCount} rows
                            </span>
                          )}
                          <Badge variant="outline" className="text-[9px]">{columns.length} cols</Badge>
                          {isTableExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>

                        {isTableExpanded && (
                          <div className="px-4 pb-3 bg-muted/20">
                            <div className="grid gap-1">
                              {columns.map((col, i) => (
                                <div key={i} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 text-xs">
                                  {col.isPK ? <Cable className="h-3 w-3 text-amber-500" /> : <div className="w-3" />}
                                  <span className="font-mono font-medium">{col.name}</span>
                                  <code className="text-muted-foreground bg-muted px-1 rounded">{col.type}</code>
                                  {col.nullable && <Badge variant="outline" className="text-[8px]">nullable</Badge>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      )}
    </Card>
  );
}

function EmptyState({ type }: { type?: string }) {
  return (
    <div className="text-center py-20">
      <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">
        {type === 'file' ? 'No file data sources uploaded' :
         type === 'database' ? 'No database connections configured' :
         'No data sources connected'}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Click &quot;Add Data Source&quot; to {type === 'file' ? 'upload a file' : type === 'database' ? 'connect to a database' : 'connect your first data source'}
      </p>
    </div>
  );
}
