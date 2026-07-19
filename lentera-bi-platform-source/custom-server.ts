/**
 * Lentera BI Platform - Main Server
 * - Serves static HTML for pages (avoids Next.js SSR OOM)  
 * - Proxies API requests to lightweight Bun API server
 * - Serves Next.js static assets (JS/CSS chunks)
 */
import { serve } from 'bun';
import path from 'path';
import fs from 'fs';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';
const PROJECT_DIR = path.resolve(__dirname);
const API_PORT = 3001;

// Wait for API server (should be started separately or by start-lentera.sh)
async function waitForApi(maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${API_PORT}/api`);
      if (res.ok) {
        console.log('✅ API server ready');
        return true;
      }
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

// Load pre-rendered HTML
const indexHtmlPath = path.join(PROJECT_DIR, '.next', 'server', 'app', 'index.html');
let indexHtml = '';
try {
  indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
} catch {
  console.error('❌ index.html not found. Run `npx next build` first.');
  process.exit(1);
}

// MIME types
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// Proxy API request to Bun API server
async function proxyApiRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const apiUrl = `http://localhost:${API_PORT}${url.pathname}${url.search}`;
  
  try {
    const init: RequestInit = {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await req.arrayBuffer();
    }
    
    const apiRes = await fetch(apiUrl, init);
    
    const resHeaders = new Headers();
    apiRes.headers.forEach((v, k) => resHeaders.set(k, v));
    // Ensure correct content-type for API responses
    resHeaders.set('Content-Type', 'application/json');
    
    return new Response(apiRes.body, {
      status: apiRes.status,
      statusText: apiRes.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    console.error(`API proxy error ${url.pathname}:`, err);
    return new Response(JSON.stringify({ error: 'API server unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Start main server
waitForApi().then((ready) => {
  if (!ready) {
    console.error('❌ API server failed to start on port ' + API_PORT);
    console.error('   Start it first: PORT=3001 bun run bun-api-server.ts');
    process.exit(1);
  }

  serve({
    port: PORT,
    hostname: HOST,
    async fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      // ── API routes → proxy to Bun API server ──
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        return proxyApiRequest(req);
      }

      // ── Next.js static chunks ──
      if (pathname.startsWith('/_next/static/')) {
        const buildPath = path.join(PROJECT_DIR, '.next', pathname.replace('/_next/', ''));
        const file = Bun.file(buildPath);
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': getMimeType(buildPath) } });
        }
      }

      // ── Public files ──
      if (!pathname.startsWith('/_next/') && pathname !== '/') {
        const publicPath = path.join(PROJECT_DIR, 'public', pathname);
        const file = Bun.file(publicPath);
        if (await file.exists()) {
          return new Response(file, { headers: { 'Content-Type': getMimeType(publicPath) } });
        }
      }

      // ── All page routes → static HTML (SPA) ──
      return new Response(indexHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    },
  });

  console.log(`🚀 Lentera BI Platform: http://${HOST}:${PORT}`);
  console.log(`   📊 API → Bun server on :${API_PORT}`);
  console.log(`   🖥️  Pages → static HTML (no SSR)`);
});
