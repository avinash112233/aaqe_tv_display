#!/bin/sh
# Stops the background dev server started by dev-start.sh.
cd "$(dirname "$0")/.."

PID_FILE=".dev.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Dev server stopped."
else
  echo "Dev server isn't running (or was started outside dev-start.sh)."
  rm -f "$PID_FILE"
fi
