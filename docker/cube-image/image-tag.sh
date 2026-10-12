#!/usr/bin/env bash
# Prints the immutable tag of ghcr.io/formbricks/cube: "<Cube version>-<revision>", from the
# @cubejs-backend/server version pinned in package.json and the number in REVISION.
#
#   docker/cube-image/image-tag.sh            # from the working tree
#   docker/cube-image/image-tag.sh <git-rev>  # from a commit; prints nothing if the image did not exist there
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rev="${1:-}"

fail() {
  echo "image-tag.sh: $*" >&2
  exit 1
}

read_image_file() {
  if [ -n "$rev" ]; then
    # "./" resolves the path against -C, so this works from any working directory.
    git -C "$script_dir" show "$rev:./$1" 2>/dev/null
  else
    cat "$script_dir/$1"
  fi
}

if ! package_json="$(read_image_file package.json)" || ! revision="$(read_image_file REVISION)"; then
  [ -n "$rev" ] && exit 0
  fail "package.json and REVISION must exist in $script_dir"
fi

server_version="$(jq -r '.dependencies["@cubejs-backend/server"] // ""' <<<"$package_json")"
driver_version="$(jq -r '.dependencies["@cubejs-backend/postgres-driver"] // ""' <<<"$package_json")"
revision="$(tr -d '[:space:]' <<<"$revision")"

[[ "$server_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  fail "@cubejs-backend/server must be pinned to an exact version, got \"$server_version\""
[ "$driver_version" = "$server_version" ] ||
  fail "@cubejs-backend/postgres-driver ($driver_version) must match @cubejs-backend/server ($server_version)"
[[ "$revision" =~ ^[1-9][0-9]*$ ]] || fail "REVISION must be a positive integer, got \"$revision\""

echo "$server_version-$revision"
