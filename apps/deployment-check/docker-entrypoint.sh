#!/bin/sh
set -eu

# Docker creates a missing bind-mount source (`-v "$PWD/report:/report"`) as root on Linux, which pwuser
# cannot write. Hand the directory to pwuser only when it is not already writable, then drop privileges.
if [ "$(id -u)" = "0" ]; then
  if ! setpriv --reuid=pwuser --regid=pwuser --init-groups test -w "$REPORT_DIR"; then
    chown pwuser:pwuser "$REPORT_DIR"
  fi
  export HOME=/home/pwuser
  exec setpriv --reuid=pwuser --regid=pwuser --init-groups node_modules/.bin/playwright test "$@"
fi

# Started with --user: run as that user and leave the mount alone.
exec node_modules/.bin/playwright test "$@"
