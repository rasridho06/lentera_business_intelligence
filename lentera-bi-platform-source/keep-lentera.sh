#!/bin/bash
cd "$(dirname "$0")"
export DATABASE_URL="${DATABASE_URL:-file:./db/custom.db}"
while true; do
  PORT="${PORT:-3000}" HOST="${HOST:-0.0.0.0}" bun run bun-api-server.ts 2>&1 | tee -a server.log
  echo "[$(date)] Server died, restarting in 3s..." | tee -a server.log
  sleep 3
done
