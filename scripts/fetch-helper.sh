#!/bin/bash
# Keep the git-fetch helper running in the background, so the dashboard's
# refresh button can fetch. It runs as you, with your ~/.ssh — see fetch-helper.mjs.
#
#   ./scripts/fetch-helper.sh install     # auto-start at login (no sudo)
#   ./scripts/fetch-helper.sh status
#   ./scripts/fetch-helper.sh logs
#   ./scripts/fetch-helper.sh uninstall
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.gitbranchmatrix.fetch"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$HOME/Library/Logs/git-branch-matrix-fetch.log"
PORT="${FETCH_HELPER_PORT:-4329}"
ROOT="${BRANCH_MATRIX_ROOT:-$HOME/projects}"

install_helper() {
  local node git_bin
  node="$(command -v node)" || { echo "node nggak ketemu di PATH" >&2; exit 1; }
  git_bin="$(command -v git)" || { echo "git nggak ketemu di PATH" >&2; exit 1; }

  mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${APP_DIR}/scripts/fetch-helper.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(dirname "$node"):$(dirname "$git_bin"):/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>FETCH_HELPER_PORT</key><string>${PORT}</string>
    <key>BRANCH_MATRIX_ROOT</key><string>${ROOT}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
EOF
  plutil -lint "$PLIST" >/dev/null
  launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "• fetch helper terpasang: http://127.0.0.1:${PORT} (repo di bawah ${ROOT})"
  echo "• log: ${LOG}"
}

case "${1:-status}" in
  install) install_helper ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST"
    echo "• fetch helper dicabut"
    ;;
  logs) tail -f "$LOG" ;;
  status)
    if launchctl print "gui/$(id -u)/${LABEL}" >/dev/null 2>&1; then
      echo "helper : terdaftar auto-start"
    else
      echo "helper : belum dipasang (./scripts/fetch-helper.sh install)"
    fi
    if curl -fsS -m 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
      echo "server : jalan di 127.0.0.1:${PORT}"
    else
      echo "server : mati"
    fi
    ;;
  *) echo "pakai: $0 {install|uninstall|status|logs}" >&2; exit 1 ;;
esac
