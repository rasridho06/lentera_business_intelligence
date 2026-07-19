#!/usr/bin/env node
// Lentera BI Platform - Process Manager
// Keeps both servers alive with auto-restart

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = __dirname;
const DB_PATH = path.join(PROJECT_DIR, 'db', 'custom.db');
const LOG_FILE = path.join(PROJECT_DIR, 'server-keep.log');

const env = {
  ...process.env,
  DATABASE_URL: `file:${DB_PATH}`,
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function startProcess(name, cmd, args, extraEnv = {}) {
  const proc = spawn(cmd, args, {
    cwd: PROJECT_DIR,
    env: { ...env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  proc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log(`[${name}] ${msg}`);
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('ExperimentalWarning')) log(`[${name}:ERR] ${msg}`);
  });

  proc.on('exit', (code, signal) => {
    log(`[${name}] Exited (code=${code}, signal=${signal}). Restarting in 3s...`);
    setTimeout(() => startProcess(name, cmd, args, extraEnv), 3000);
  });

  return proc;
}

// Start API server
log('Starting API server on port 3001...');
startProcess('API', 'bun', ['run', 'bun-api-server.ts'], { PORT: '3001', HOST: '0.0.0.0' });

// Wait for API to be ready, then start main server
async function waitForApi() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:3001/api');
      if (res.ok) {
        log('API server ready!');
        return true;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

waitForApi().then(ready => {
  if (ready) {
    log('Starting main server on port 3000...');
    startProcess('MAIN', 'bun', ['run', 'custom-server.ts'], { PORT: '3000', HOST: '0.0.0.0' });
  } else {
    log('API server failed to start!');
    process.exit(1);
  }
});

// Keep process alive
process.on('SIGINT', () => {
  log('Shutting down...');
  process.exit(0);
});
