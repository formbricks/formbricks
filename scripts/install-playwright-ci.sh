#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/ci-network.sh"

if [[ "${CI:-}" != true ]]; then
  echo 'This installer configures apt on disposable CI runners; use playwright install locally.' >&2
  exit 1
fi
if (( $# == 0 )); then echo 'Specify the required Playwright browsers.' >&2; exit 1; fi

ci_configure_apt
# Reserve time inside the caller's existing 420s budget for an independent mirror and browser
# download. Kill the whole apt process group before retrying so no child retains the dpkg lock.
if ! timeout --kill-after=5s 120s pnpm exec playwright install-deps "$@"; then
  echo '::warning::Playwright OS dependency install failed; retrying against the fallback Ubuntu mirror.'
  # A timeout during package configuration can leave dpkg interrupted even after its lock is released.
  timeout --kill-after=5s 30s sudo dpkg --configure -a
  ci_use_fallback_apt_mirror
  timeout --kill-after=5s 120s pnpm exec playwright install-deps "$@"
fi
exec pnpm exec playwright install "$@"
