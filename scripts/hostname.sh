#!/bin/bash
# Point gbm.local at this machine, optionally without a port suffix.
#
#   sudo ./scripts/hostname.sh install     # gbm.local:4321
#   sudo ./scripts/hostname.sh install 80  # gbm.local  (adds a pf redirect 80 -> 4321)
#   sudo ./scripts/hostname.sh uninstall
#   ./scripts/hostname.sh status
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "$(basename "$0") is macOS-only (pf, dscacheutil). See README → Other platforms." >&2
  exit 1
fi

HOST="${BRANCH_MATRIX_HOST:-gbm.local}"
PORT="${PORT:-4321}"
MARK="# branch-matrix"
ANCHOR="/etc/pf.anchors/branch-matrix"
HOSTS_BAK="/etc/hosts.branch-matrix.bak"

need_root() {
  [ "$(id -u)" -eq 0 ] || { echo "needs sudo: sudo $0 $*" >&2; exit 1; }
}

# Every address /etc/hosts maps HOST to, one per line. Fields after a bare `#`
# are a trailing comment, not more hostnames.
host_addrs() {
  awk -v host="$HOST" '
    /^[[:space:]]*#/ { next }
    {
      for (i = 2; i <= NF; i++) {
        if ($i == "#") break
        if ($i == host) { print $1; next }
      }
    }
  ' /etc/hosts
}

# The app binds 127.0.0.1 only, so an IPv6 record just points the resolver at a
# dead address first: browsers recover through Happy Eyeballs after paying a
# refused round-trip, `curl -6` and anything IPv6-only fails outright. Earlier
# versions of this script wrote an ::1 line, so install sweeps them back out.
#
# HOST is dropped from the record rather than the line: a hand-edited hosts file
# may well have parked it on `::1 localhost`, and deleting that whole line would
# take IPv6 localhost down with it.
strip_ipv6_records() {
  local count tmp
  count=$(host_addrs | grep -c ':' || true)
  [ "$count" -gt 0 ] || return 0

  tmp="$(mktemp)"
  awk -v host="$HOST" '
    /^[[:space:]]*#/ { print; next }
    $1 !~ /:/        { print; next }
    {
      names = ""; comment = ""; hit = 0; kept = 0
      for (i = 2; i <= NF; i++) {
        if ($i == "#") {                       # trailing comment: copy it as-is
          for (j = i; j <= NF; j++) comment = comment (comment ? " " : "") $j
          break
        }
        if ($i == host) { hit = 1; continue }
        names = names (names ? " " : "") $i
        kept++
      }
      if (!hit)     { print; next }
      if (kept == 0) next                      # the record existed only for host
      print $1 "\t" names (comment ? "\t" comment : "")
    }
  ' /etc/hosts > "$tmp"

  [ -f "$HOSTS_BAK" ] || cp /etc/hosts "$HOSTS_BAK"
  cat "$tmp" > /etc/hosts   # rewrite in place: keeps the inode, owner and mode
  rm -f "$tmp"
  echo "• /etc/hosts: removed ${count} IPv6 record(s) for ${HOST} (the app only listens on 127.0.0.1)"
}

install_host() {
  strip_ipv6_records
  if host_addrs | grep -qv ':'; then
    echo "• /etc/hosts: ${HOST} already there, skipped"
  else
    [ -f "$HOSTS_BAK" ] || cp /etc/hosts "$HOSTS_BAK"
    printf '127.0.0.1\t%s\t%s\n' "$HOST" "$MARK" >> /etc/hosts
    echo "• /etc/hosts: added ${HOST} (backup: ${HOSTS_BAK})"
  fi
  dscacheutil -flushcache 2>/dev/null || true
  killall -HUP mDNSResponder 2>/dev/null || true
}

install_pf() {
  cat > "$ANCHOR" <<EOF
rdr pass on lo0 inet proto tcp from any to 127.0.0.1 port 80 -> 127.0.0.1 port ${PORT}
EOF
  if ! grep -q 'rdr-anchor "branch-matrix"' /etc/pf.conf; then
    cp /etc/pf.conf /etc/pf.conf.branch-matrix.bak
    # rdr-anchor must sit with the other translation rules, before filter rules
    sed -i '' '/^rdr-anchor/a\
rdr-anchor "branch-matrix"
' /etc/pf.conf 2>/dev/null || printf 'rdr-anchor "branch-matrix"\n' >> /etc/pf.conf
    printf 'load anchor "branch-matrix" from "%s"\n' "$ANCHOR" >> /etc/pf.conf
    echo "• /etc/pf.conf: added the anchor (backup: /etc/pf.conf.branch-matrix.bak)"
  fi
  pfctl -f /etc/pf.conf >/dev/null 2>&1 || true
  pfctl -E >/dev/null 2>&1 || true
  echo "• pf: port 80 -> ${PORT} active (run again after a reboot)"
}

# Configured and actually loaded are different things: the anchor lives in
# root-owned files that survive a reboot, the loaded rule does not.
pf_status() {
  local server_up="$1"

  if ! { [ -f "$ANCHOR" ] && grep -q 'rdr-anchor "branch-matrix"' /etc/pf.conf 2>/dev/null; }; then
    echo "pf     : not used, so the URL carries :${PORT} (enable: sudo $0 install 80)"
    return
  fi

  if [ "$server_up" != "1" ]; then
    echo "pf     : anchor installed, cannot tell if it is loaded (server down)"
    return
  fi

  # Root-less probe: nothing else should hold :80, so an accepted connection
  # there means the redirect is live.
  if nc -z -G 1 -w 1 127.0.0.1 80 >/dev/null 2>&1; then
    echo "pf     : redirect 80 -> ${PORT} active"
  else
    echo "pf     : anchor installed but redirect DOWN — pf rules are lost on every reboot"
    echo "         just now    : sudo pfctl -E -f /etc/pf.conf"
    echo "         permanently : sudo ./scripts/service.sh pf"
  fi
}

case "${1:-status}" in
  install)
    need_root "$@"
    install_host
    [ "${2:-}" = "80" ] && install_pf
    echo
    if [ "${2:-}" = "80" ]; then echo "open: http://${HOST}"; else echo "open: http://${HOST}:${PORT}"; fi
    ;;
  uninstall)
    need_root "$@"
    sed -i '' "/${MARK}\$/d" /etc/hosts
    sed -i '' '/rdr-anchor "branch-matrix"/d;/load anchor "branch-matrix"/d' /etc/pf.conf 2>/dev/null || true
    rm -f "$ANCHOR"
    pfctl -f /etc/pf.conf >/dev/null 2>&1 || true
    dscacheutil -flushcache 2>/dev/null || true
    killall -HUP mDNSResponder 2>/dev/null || true
    echo "• removed ${HOST} from /etc/hosts and pf"
    ;;
  status)
    server_up=0
    lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1 && server_up=1

    echo "host  : ${HOST}"
    echo "port  : ${PORT}"
    grep -E "[[:space:]]${HOST}([[:space:]]|$)" /etc/hosts || echo "  (not in /etc/hosts yet)"
    if host_addrs | grep -q ':'; then
      echo "  ⚠ IPv6 record present — every lookup tries a dead address first (fix: sudo $0 install)"
    fi
    if ip=$(dscacheutil -q host -a name "$HOST" 2>/dev/null | awk '/^ip_address/ {print $2; exit}'); [ -n "${ip:-}" ]; then
      echo "resolve: ${ip}"
    else
      echo "resolve: not yet (run: sudo $0 install)"
    fi
    if [ "$server_up" = "1" ]; then
      echo "server : listening on :${PORT}"
    else
      echo "server : not running on :${PORT} (npm run dev)"
    fi
    pf_status "$server_up"
    ;;
  *) echo "usage: $0 {install [80]|uninstall|status}" >&2; exit 1 ;;
esac
