#!/bin/bash
cd "$(dirname "$0")"
while true; do
  PORT="${PORT:-3000}" HOST="${HOST:-0.0.0.0}" bun run bun-api-server.ts 2>&1
  echo "[$(date)] Server exited, restarting..." | tee -a server.log
  sleep 3
done
