#!/usr/bin/env bash
# Install user systemd units on hamza@192.168.1.185 (or any Linux host). App listens on 0.0.0.0:6767.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$UNIT_DIR"
for f in microsoft-hack-data.service microsoft-hack-web.service; do
  sed "s|%h|$HOME|g" "$REPO/scripts/systemd/$f" > "$UNIT_DIR/$f"
done
systemctl --user daemon-reload
systemctl --user enable microsoft-hack-data.service microsoft-hack-web.service
echo "Installed. Start with: systemctl --user start microsoft-hack-data microsoft-hack-web"
echo "Mobile API URL: http://$(hostname -I | awk '{print $1}'):6767  (or http://192.168.1.185:6767)"
