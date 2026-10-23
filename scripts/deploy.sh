#!/usr/bin/env bash
# Pull latest main, test (optional), build, restart Mandate on this host (:6767).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

BRANCH="${DEPLOY_BRANCH:-main}"
echo "[deploy] fetch origin/${BRANCH}…"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
SHA="$(git rev-parse --short HEAD)"
echo "[deploy] at ${SHA}"

if [ ! -d data-service/.venv ]; then
  python3 -m venv data-service/.venv
fi
data-service/.venv/bin/pip install -q -r data-service/requirements.txt

if [ "${SKIP_TESTS:-0}" != "1" ]; then
  echo "[deploy] tests…"
  data-service/.venv/bin/python -m pytest -q data-service/tests
  (cd web && npm ci --no-audit --no-fund && npm test)
else
  (cd web && npm ci --no-audit --no-fund)
fi

echo "[deploy] build web…"
(cd web && npm run build)

echo "[deploy] restart services…"
systemctl --user daemon-reload
systemctl --user restart microsoft-hack-data.service
for i in $(seq 1 90); do
  curl -sf http://127.0.0.1:5001/health >/dev/null && break
  sleep 2
  [ "$i" = 90 ] && { systemctl --user status microsoft-hack-data --no-pager; exit 1; }
done
systemctl --user restart microsoft-hack-web.service
for i in $(seq 1 45); do
  curl -sf http://127.0.0.1:6767/ >/dev/null && break
  sleep 1
  [ "$i" = 45 ] && { systemctl --user status microsoft-hack-web --no-pager; exit 1; }
done

curl -sf -o /dev/null -w "[deploy] live HTTP %{http_code} on :6767\n" http://127.0.0.1:6767/
echo "[deploy] done ${SHA}"
