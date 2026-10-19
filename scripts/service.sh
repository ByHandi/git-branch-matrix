#!/bin/bash
# Run Git Branch Matrix as a background service that starts at login.
#
#   ./scripts/service.sh install      # app auto-start (no sudo)
#   sudo ./scripts/service.sh pf      # keep the port-80 redirect after reboot
#   ./scripts/service.sh status
#   ./scripts/service.sh uninstall
#   ./scripts/service.sh logs
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.gitbranchmatrix.app"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
PF_LABEL="com.gitbranchmatrix.pf"
PF_PLIST="/Library/LaunchDaemons/${PF_LABEL}.plist"
LOG="$HOME/Library/Logs/git-branch-matrix.log"

# Renamed from branch-matrix. The pf anchor and the /etc/hosts marker keep their
# old names on purpose — both live in root-owned files this script may not touch.
LEGACY_LABEL="com.branchmatrix.app"
LEGACY_PLIST="$HOME/Library/LaunchAgents/${LEGACY_LABEL}.plist"
LEGACY_PF_LABEL="com.branchmatrix.pf"

drop_legacy() {
  if launchctl print "gui/$(id -u)/${LEGACY_LABEL}" >/dev/null 2>&1 || [ -f "$LEGACY_PLIST" ]; then
    launchctl bootout "gui/$(id -u)/${LEGACY_LABEL}" 2>/dev/null || true
    rm -f "$LEGACY_PLIST"
    echo "• service lama (${LEGACY_LABEL}) dicabut"
  fi
}
PORT="${PORT:-4321}"

install_app() {
  local node npm_cli node_bin
  drop_legacy
  node="$(command -v node)" || { echo "node nggak ketemu di PATH" >&2; exit 1; }
  node_bin="$(dirname "$node")"
  npm_cli="$(dirname "$(readlink -f "$(command -v npm)" 2>/dev/null || command -v npm)")/npm-cli.js"

  [ -d "$APP_DIR/.next" ] || { echo "belum ada build. jalankan dulu: npm run build" >&2; exit 1; }
  [ -f "$APP_DIR/node_modules/next/dist/bin/next" ] || { echo "next belum keinstall: npm install" >&2; exit 1; }

  # a dev server still holding the port would make the service crash-loop
  if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port ${PORT} lagi kepakai. hentikan dulu prosesnya:" >&2
    lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN | tail -n +2 | awk '{print "  pid " $2 "  " $1}' >&2
    exit 1
  fi

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
    <string>${APP_DIR}/node_modules/next/dist/bin/next</string>
    <string>start</string>
    <string>-p</string>
    <string>${PORT}</string>
    <!-- loopback only: this dashboard has no auth, keep it off the LAN -->
    <string>-H</string>
    <string>127.0.0.1</string>
  </array>
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${node_bin}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key><string>production</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <!-- Postgres may not be up yet at login; KeepAlive retries until it is. -->
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
  echo "• LaunchAgent terpasang: ${PLIST}"
  echo "• log: ${LOG}"
}

install_pf() {
  [ "$(id -u)" -eq 0 ] || { echo "butuh sudo: sudo $0 pf" >&2; exit 1; }
  [ -f /etc/pf.anchors/branch-matrix ] || {
    echo "anchor pf belum ada. jalankan dulu: sudo ./scripts/hostname.sh install 80" >&2; exit 1; }

  cat > "$PF_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${PF_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/sbin/pfctl</string>
    <string>-E</string>
    <string>-f</string>
    <string>/etc/pf.conf</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
  plutil -lint "$PF_PLIST" >/dev/null
  chown root:wheel "$PF_PLIST"; chmod 644 "$PF_PLIST"
  launchctl bootout system/"${PF_LABEL}" 2>/dev/null || true
  launchctl bootstrap system "$PF_PLIST"
  echo "• LaunchDaemon pf terpasang: ${PF_PLIST}"
}

case "${1:-status}" in
  install) install_app ;;
  pf)      install_pf ;;
  uninstall)
    drop_legacy
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST"
    echo "• LaunchAgent dicabut"
    [ "$(id -u)" -eq 0 ] && {
      for l in "${PF_LABEL}" "${LEGACY_PF_LABEL}"; do
        launchctl bootout system/"$l" 2>/dev/null || true
        rm -f "/Library/LaunchDaemons/${l}.plist"
      done
      echo "• LaunchDaemon pf dicabut"
    }
    ;;
  restart)
    # `next dev` overwrites .next, so a stale production build is the usual
    # reason the service 500s. Rebuild, then hand the port back to launchd.
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    ( cd "$APP_DIR" && rm -rf .next && npm run build )
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "• dibuild ulang dan direstart"
    ;;
  logs) tail -f "$LOG" ;;
  status)
    if launchctl print "gui/$(id -u)/${LABEL}" >/dev/null 2>&1; then
      echo "app    : terdaftar auto-start"
      launchctl print "gui/$(id -u)/${LABEL}" | awk '/state =|pid =|last exit/ {print "         " $0}'
    else
      echo "app    : belum auto-start (./scripts/service.sh install)"
    fi
    if launchctl print system/"${PF_LABEL}" >/dev/null 2>&1; then
      echo "pf     : terdaftar auto-start"
    else
      echo "pf     : belum auto-start (sudo ./scripts/service.sh pf)"
    fi
    lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1 \
      && echo "server : listen di :${PORT}" || echo "server : mati"
    ;;
  *) echo "pakai: $0 {install|restart|pf|uninstall|status|logs}" >&2; exit 1 ;;
esac
