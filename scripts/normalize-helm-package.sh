#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf '%s\n' "Usage: normalize-helm-package.sh PACKAGE_PATH CHART_NAME" >&2
  exit 64
fi

package_path="$1"
chart_name="$2"

[[ -f "$package_path" ]] || { printf '%s\n' "Helm package is missing" >&2; exit 1; }
[[ "$chart_name" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { printf '%s\n' "Invalid Helm chart name" >&2; exit 1; }
tar --version | grep --fixed-strings "GNU tar" >/dev/null || {
  printf '%s\n' "GNU tar is required to normalize Helm packages" >&2
  exit 1
}

temporary_directory=$(mktemp -d)
temporary_package="${package_path}.normalized"
cleanup() {
  rm -rf -- "$temporary_directory"
  rm -f -- "$temporary_package"
}
trap cleanup EXIT

tar -xzf "$package_path" -C "$temporary_directory"
[[ -d "${temporary_directory}/${chart_name}" ]] || {
  printf '%s\n' "Helm package does not contain the expected chart" >&2
  exit 1
}

tar \
  --sort=name \
  --mtime='@0' \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  --format=gnu \
  -C "$temporary_directory" \
  -cf - \
  "$chart_name" | gzip -n >"$temporary_package"

mv -- "$temporary_package" "$package_path"
