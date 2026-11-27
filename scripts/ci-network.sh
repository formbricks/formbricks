#!/usr/bin/env bash
# Retry downloads only. Never use this around tests, schema writes or Helm lifecycle operations.

ci_pull_image() {
  local image="$1" attempt status
  if docker image inspect "$image" >/dev/null 2>&1; then return 0; fi
  # Local chart/schema checks also use this helper; macOS need not have GNU timeout installed.
  if [[ "${CI:-}" != true ]]; then docker pull "$image"; return; fi
  for attempt in 1 2 3; do
    if timeout --kill-after=10s 120s docker pull "$image"; then return 0; else status=$?; fi
    printf 'Image pull failed (attempt %s/3): %s\n' "$attempt" "$image" >&2
    if (( attempt < 3 )); then sleep "$((attempt * 5))"; fi
  done
  return "$status"
}

ci_download() {
  # Downloads are safe to repeat, including on DNS failures that curl does not retry by default.
  # Keep the checksum verification in each caller; a successful fetch is not a trust check.
  curl --fail --silent --show-error --location --connect-timeout 10 --max-time 30 \
    --retry 6 --retry-all-errors --retry-delay 5 --retry-max-time 180 "$@"
}

ci_configure_apt() {
  local apt_dir="${1:-/etc/apt}"
  # These jobs use disposable Ubuntu runners. Do not cache /usr or dpkg's database: restored
  # package metadata would claim libraries are installed without restoring those libraries.
  sudo tee "${apt_dir}/apt.conf.d/99formbricks-ci" >/dev/null <<'APT'
Acquire::Retries "1";
Acquire::http::Timeout "10";
Acquire::https::Timeout "10";
Acquire::Languages "none";
APT::Update::Error-Mode "any";
APT
}

ci_apt_running() {
  # Zombies hold no locks and only wait to be reaped, so count running, sleeping and blocked processes.
  # pgrep exits 1 for "none". Any other failure means we cannot tell, so answer "running": the caller
  # then still waits and KILLs, rather than retrying into a lock it never checked.
  # Call it only as a condition (`if`, `||`): its "not running" status is non-zero and would trip `set -e`.
  local status=0
  sudo pgrep -x --runstates DRS 'apt-get|apt|dpkg' >/dev/null || status=$?
  if (( status > 1 )) && [[ -z "${CI_APT_PGREP_WARNED:-}" ]]; then
    CI_APT_PGREP_WARNED=1
    echo "::warning::pgrep failed (exit ${status}); treating apt as still running."
  fi
  (( status != 1 ))
}

ci_stop_apt() {
  # `timeout` signals its own process group, but `sudo` runs apt-get in a new session, so a timed-out
  # `playwright install-deps` can leave apt-get running and holding /var/lib/apt/lists/lock; the
  # retry then fails at once with "Could not get lock" (exit 100). Stop any apt/dpkg still running,
  # bounded so the caller's budget holds: TERM, up to 20s to exit, then KILL and up to 5s more. The
  # kernel releases their locks when they exit. Only for disposable runners, like everything else here.
  local second
  sudo pkill -TERM -x 'apt-get|apt|dpkg' || true
  for ((second = 0; second < 20; second++)); do
    ci_apt_running || return 0
    sleep 1
  done
  sudo pkill -KILL -x 'apt-get|apt|dpkg' || true
  for ((second = 0; second < 5; second++)); do
    ci_apt_running || return 0
    sleep 1
  done
  echo '::warning::apt or dpkg is still running after KILL; the retry may hit its lock.'
}

ci_use_fallback_apt_mirror() {
  local apt_dir="${1:-/etc/apt}" architecture
  # Handle both legacy .list and deb822 .sources files. Only Ubuntu archive, security and ports hosts
  # change; GitHub's and Blacksmith's Ubuntu mirror+file sources also become a direct fallback URL.
  # Package signatures, suites and third-party repositories remain as configured. Azure's archive mirror
  # carries amd64 and i386 only, so other architectures (the arm64 release smoke jobs) use its ports mirror.
  architecture="$(dpkg --print-architecture)"
  sudo python3 - "$apt_dir" "$architecture" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
mirror_files = r'|mirror\+file:/etc/apt/(?:apt|blacksmith-ubuntu)-mirrors\.txt(?=\s|$)'
if sys.argv[2] in ('amd64', 'i386'):
    ubuntu = r'https?://(?:[\w.-]+\.)?archive\.ubuntu\.com/ubuntu\b|https?://security\.ubuntu\.com/ubuntu\b'
    fallback = 'https://azure.archive.ubuntu.com/ubuntu'
else:
    ubuntu = r'https?://(?:[\w.-]+\.)?ports\.ubuntu\.com/ubuntu-ports\b'
    fallback = 'https://azure.ports.ubuntu.com/ubuntu-ports'
rewritten = 0
for path in [root / 'sources.list', *root.glob('sources.list.d/*.list'), *root.glob('sources.list.d/*.sources')]:
    if path.is_file():
        original = path.read_text()
        updated, count = re.subn(ubuntu + mirror_files, fallback, original)
        rewritten += count
        if updated != original:
            path.write_text(updated)
# A runner image that names its Ubuntu mirror differently would otherwise retry the same stalled mirror
# silently; say so where the failure will show.
if rewritten == 0:
    print('::warning::No Ubuntu apt source matched the fallback-mirror rewrite; the retry uses the same mirrors.')
PY
}
