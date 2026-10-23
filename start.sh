#!/bin/bash
# Starts the data service (port 5001) and the web app (port 3000). Ctrl+C stops both.
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"

if [ ! -d data-service/.venv ]; then
  python3.11 -m venv data-service/.venv && data-service/.venv/bin/pip install -q -r data-service/requirements.txt
fi
if [ ! -d web/node_modules ]; then (cd web && npm install --no-audit --no-fund); fi
if [ "$1" = "--reset" ]; then rm -f web/data/db.json && echo "Demo data reset"; fi

(cd data-service && .venv/bin/python prewarm.py && exec .venv/bin/python app.py) &
FLASK=$!
trap 'kill $FLASK 2>/dev/null' EXIT
cd web && npm run build && npm start
