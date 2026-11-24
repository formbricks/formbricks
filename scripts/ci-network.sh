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

ci_use_fallback_apt_mirror() {
  local apt_dir="${1:-/etc/apt}"
  # Handle both legacy .list and deb822 .sources files. Only Ubuntu archive/security hosts
  # change; GitHub's Ubuntu mirror+file source also becomes a direct fallback URL.
  # Package signatures, suites and third-party repositories remain as configured.
  sudo python3 - "$apt_dir" <<'PY'
from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
for path in [root / 'sources.list', *root.glob('sources.list.d/*.list'), *root.glob('sources.list.d/*.sources')]:
    if path.is_file():
        original = path.read_text()
        updated = re.sub(r'https?://(?:[\w.-]+\.)?archive\.ubuntu\.com/ubuntu\b|https?://security\.ubuntu\.com/ubuntu\b'
                         r'|mirror\+file:/etc/apt/apt-mirrors\.txt(?=\s|$)',
                         'https://azure.archive.ubuntu.com/ubuntu', original)
        if updated != original:
            path.write_text(updated)
PY
}
