#!/bin/sh
set -eu

# Docker creates a missing bind-mount source (`-v "$PWD/report:/report"`) as root on Linux, and a reused
# report directory can hold root-owned files from an earlier run. Hand the directory and everything in it
# to pwuser, then drop privileges.
if [ "$(id -u)" = "0" ]; then
  chown -R pwuser:pwuser "$REPORT_DIR"
  export HOME=/home/pwuser
  exec setpriv --reuid=pwuser --regid=pwuser --init-groups node_modules/.bin/playwright test "$@"
fi

# Started with --user: run as that user and leave the mount alone.
exec node_modules/.bin/playwright test "$@"
