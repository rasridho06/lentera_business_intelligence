/**
 * Lentera BI Platform - Node.js Static + Proxy Server
 * Uses Node.js (lighter) for static serving + API proxy
 * Bun handles the heavy API server separately
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000');
const API_PORT = 3001;
const PROJECT_DIR = __dirname;

// Load pre-rendered HTML
let indexHtml = '';
try {
  indexHtml = fs.readFileSync(path.join(PROJECT_DIR, '.next', 'server', 'app', 'index.html'), 'utf-8');
} catch (e) {
  console.error('index.html not found. Run `npx next build` first.');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// Proxy API request to Bun API server on port 3001
function proxyApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const apiUrl = `http://127.0.0.1:${API_PORT}${url.pathname}${url.search}`;
  
  const options = {
    hostname: '127.0.0.1',
    port: API_PORT,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` },
  };

  const proxy = http.request(options, (apiRes) => {
    res.writeHead(apiRes.statusCode, apiRes.headers);
    apiRes.pipe(res);
  });

  proxy.on('error', (e) => {
    console.error(`API proxy error ${url.pathname}:`, e.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API server unavailable' }));
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxy);
  } else {
    proxy.end();
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API routes -> proxy
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return proxyApi(req, res);
  }

  // Next.js static chunks
  if (pathname.startsWith('/_next/static/')) {
    const filePath = path.join(PROJECT_DIR, '.next', pathname.replace('/_next/', ''));
    if (fs.existsSync(filePath)) {
      const contentType = getMimeType(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Public files
  if (!pathname.startsWith('/_next/') && pathname !== '/') {
    const filePath = path.join(PROJECT_DIR, 'public', pathname);
    if (fs.existsSync(filePath)) {
      const contentType = getMimeType(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // All page routes -> static HTML (SPA)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(indexHtml);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Lentera static server: http://0.0.0.0:${PORT}`);
  console.log(`   API proxy -> 127.0.0.1:${API_PORT}`);
});
