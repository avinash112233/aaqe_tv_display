#!/bin/sh
# Starts the Vite dev server in the background so you don't have to keep a
# terminal tab open running `npm run dev`. Safe to run again — it won't start
# a second copy if one is already running.
set -e

cd "$(dirname "$0")/.."

PID_FILE=".dev.pid"
LOG_FILE=".dev.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Dev server already running (PID $(cat "$PID_FILE")). Open http://localhost:5174"
  exit 0
fi

nohup npm run dev >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
sleep 1
echo "Dev server starting in the background (PID $(cat "$PID_FILE"))."
echo "Logs: $(pwd)/$LOG_FILE"
echo "Open: http://localhost:5174"
echo "Stop it anytime with: npm run dev:stop"
