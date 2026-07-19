/**
 * Lentera BI Platform - Combined Single-Process Server
 * Handles both API routes AND static HTML/asset serving in one Bun process
 * Solves the two-process memory issue
 */
import { serve } from 'bun';
import path from 'path';
import fs from 'fs';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';
const PROJECT_DIR = path.resolve(__dirname);

// ── Import API handler from bun-api-server ──
// We need to extract the handleRequest function
// Since bun-api-server.ts starts its own server, we need to import just the handler

// Set up Prisma and env for the API handler
const DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(PROJECT_DIR, 'db', 'custom.db')}`;
process.env.DATABASE_URL = DATABASE_URL;

import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { __bunPrisma: PrismaClient | undefined };
const db = globalForPrisma.__bunPrisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.__bunPrisma = db;

// ── Inline minimal API handlers ──
// We'll proxy to a lightweight API server on a different port to avoid code duplication
// BUT we'll start it as part of this same process using a worker

// Actually, the simplest approach: start the API server as a Bun worker
// and proxy requests to it via fetch to localhost

import { spawn, ChildProcess } from 'child_process';

// Start API server on port 3001 as a child process
const apiProc: ChildProcess = spawn('bun', ['run', 'bun-api-server.ts'], {
  cwd: PROJECT_DIR,
  env: {
    ...process.env,
    DATABASE_URL,
    PORT: '3001',
    HOST: '127.0.0.1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
apiProc.unref();
apiProc.stdout?.on('data', (d: Buffer) => { const m = d.toString().trim(); if (m) console.log(`[API] ${m}`); });
apiProc.stderr?.on('data', (d: Buffer) => { const m = d.toString().trim(); if (m && !m.includes('Experimental')) console.error(`[API] ${m}`); });

// Wait for API to be ready
async function waitForApi(): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:3001/api`);
      if (r.ok) { console.log('✅ API ready'); return true; }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// Load pre-rendered HTML
let indexHtml = '';
try {
  indexHtml = fs.readFileSync(path.join(PROJECT_DIR, '.next', 'server', 'app', 'index.html'), 'utf-8');
} catch {
  console.error('❌ index.html not found');
  process.exit(1);
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json',
};
function mime(p: string) { return MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'; }

// Proxy to API
async function proxyApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  try {
    const init: RequestInit = { method: req.method, headers: Object.fromEntries(req.headers.entries()) };
    if (req.method !== 'GET' && req.method !== 'HEAD') init.body = await req.arrayBuffer();
    const r = await fetch(`http://127.0.0.1:3001${url.pathname}${url.search}`, init);
    const h = new Headers(); r.headers.forEach((v, k) => h.set(k, v));
    h.set('Content-Type', 'application/json');
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'API unavailable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}

waitForApi().then(ok => {
  if (!ok) { console.error('❌ API failed'); process.exit(1); }
  serve({
    port: PORT, hostname: HOST,
    async fetch(req) {
      const url = new URL(req.url);
      const p = url.pathname;
      if (p === '/api' || p.startsWith('/api/')) return proxyApi(req);
      if (p.startsWith('/_next/static/')) {
        const fp = path.join(PROJECT_DIR, '.next', p.replace('/_next/', ''));
        const f = Bun.file(fp);
        if (await f.exists()) return new Response(f, { headers: { 'Content-Type': mime(fp) } });
      }
      if (!p.startsWith('/_next/') && p !== '/') {
        const fp = path.join(PROJECT_DIR, 'public', p);
        const f = Bun.file(fp);
        if (await f.exists()) return new Response(f, { headers: { 'Content-Type': mime(fp) } });
      }
      return new Response(indexHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } });
    },
  });
  console.log(`🚀 Lentera: http://${HOST}:${PORT}`);
});
