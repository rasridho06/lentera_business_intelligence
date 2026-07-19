#!/bin/bash
cd "$(dirname "$0")"
export DATABASE_URL="${DATABASE_URL:-file:./db/custom.db}"

# Start API server
PORT=3001 bun run bun-api-server.ts &
API_PID=$!
echo "API server started (PID: $API_PID)"

# Start main server (if exists)
if [ -f "custom-server.ts" ]; then
  PORT=3000 bun run custom-server.ts &
  MAIN_PID=$!
  echo "Main server started (PID: $MAIN_PID)"
fi

# Monitor both
while true; do
  if ! kill -0 $API_PID 2>/dev/null; then
    echo "[$(date)] API server exited, restarting..."
    PORT=3001 bun run bun-api-server.ts &
    API_PID=$!
  fi
  sleep 5
done
