'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Play, Terminal as TerminalIcon, FileText, XCircle, Loader2 } from 'lucide-react';

// ponytail: in-browser SQLite via sql.js — no server upload endpoint needed

export function QueryView() {
  const [db, setDb] = useState<SqlJsDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [sql, setSql] = useState('SELECT * FROM data LIMIT 10');
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState('');
  const [cols, setCols] = useState<string[]>([]);
  const [loadedFile, setLoadedFile] = useState('');
  const [rowsLoaded, setRowsLoaded] = useState(0);
  const [executing, setExecuting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initSqlJs().then((SQL) => {
      setDb(new SQL.Database());
      setLoading(false);
    });
  }, []);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setResults(null);
    setExecuting(true);

    try {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
      if (parsed.errors.length > 0) {
        setError(`Parse error: ${parsed.errors[0].message}`);
        setExecuting(false);
        return;
      }
      const rows = parsed.data as Record<string, unknown>[];
      const headers = parsed.meta.fields || [];
      if (headers.length === 0) { setError('No columns found in file'); setExecuting(false); return; }

      if (!db) return;
      db.run(`DROP TABLE IF EXISTS data`);
      const createCols = headers.map((h) => `"${h.replace(/"/g, '""')}" TEXT`).join(', ');
      db.run(`CREATE TABLE data (${createCols})`);
      const placeholders = headers.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO data VALUES (${placeholders})`);
      for (const row of rows) {
        stmt.run(headers.map((h) => String(row[h] ?? '')));
      }
      stmt.free();

      setLoadedFile(file.name);
      setRowsLoaded(rows.length);
      setCols(headers);
      setSql(`SELECT * FROM data LIMIT 10`);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
    setExecuting(false);
  }, [db]);

  const executeQuery = useCallback(() => {
    if (!db) return;
    setError('');
    setExecuting(true);
    try {
      const stmt = db.exec(sql);
      if (stmt.length === 0) {
        setResults([]);
        setCols([]);
      } else {
        const { columns, values } = stmt[0];
        setCols(columns);
        setResults(values.map((row) => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col, i) => { obj[col] = row[i]; });
          return obj;
        }));
      }
    } catch (err) {
      setError(`SQL error: ${err instanceof Error ? err.message : 'Unknown'}`);
      setResults(null);
    }
    setExecuting(false);
  }, [db, sql]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) executeQuery();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        <span className="ml-3 text-muted-foreground">Loading SQL engine...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TerminalIcon className="h-5 w-5 text-emerald-600" />
          <div>
            <h2 className="text-xl font-bold">SQL Query</h2>
            <p className="text-sm text-muted-foreground">Upload CSV/Excel and query with SQL</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={executing}>
            <Upload className="h-4 w-4 mr-1" /> Load CSV
          </Button>
          {loadedFile && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" /> {loadedFile} ({rowsLoaded} rows)
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SQL Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            className="font-mono text-xs min-h-[100px]"
            placeholder="SELECT * FROM data LIMIT 10"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={executeQuery} disabled={executing || !db}>
              {executing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Execute (Ctrl+Enter)
            </Button>
            {!loadedFile && <span className="text-xs text-muted-foreground">Load a CSV file first to query data</span>}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-3 flex items-center gap-2 text-destructive text-sm">
            <XCircle className="h-4 w-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {results !== null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Results
              <span className="text-muted-foreground font-normal ml-2">({results.length} row{results.length !== 1 ? 's' : ''})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {cols.map((col) => (
                    <th key={col} className="text-left font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                    {cols.map((col) => (
                      <td key={col} className="px-3 py-1.5 whitespace-nowrap">{String(row[col] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {!loadedFile && !results && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="text-center">
            <div className="h-12 w-12 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center">
              <TerminalIcon className="h-6 w-6" />
            </div>
            <p className="text-sm">Upload a CSV file, then run SQL queries</p>
            <p className="text-xs mt-1">Supports: SELECT, WHERE, GROUP BY, JOIN, and more SQLite-compatible syntax</p>
          </div>
        </div>
      )}
    </div>
  );
}
