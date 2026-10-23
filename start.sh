#!/bin/bash
# Starts the data service (port 5001) and the web app (port 3000). Ctrl+C stops both.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"

# Stop anything already running on our ports (an earlier run, or one started from another terminal)
for port in 3000 5001; do
  pids=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [ -n "$pids" ]; then echo "Stopping old server on port $port"; kill $pids 2>/dev/null || true; fi
done
sleep 1

if [ ! -d data-service/.venv ]; then
  python3.11 -m venv data-service/.venv && data-service/.venv/bin/pip install -q -r data-service/requirements.txt
fi
if [ ! -d web/node_modules ]; then (cd web && npm install --no-audit --no-fund); fi
if [ ! -d mcp-server/node_modules ]; then (cd mcp-server && npm install --no-audit --no-fund); fi
(cd mcp-server && npm run build)
if [ "$1" = "--reset" ]; then rm -f web/data/db.json && echo "Demo data reset"; fi

(cd data-service && .venv/bin/python prewarm.py && exec .venv/bin/python app.py) &
FLASK=$!
trap 'kill $FLASK 2>/dev/null' EXIT
cd web && npm run build && npm start
