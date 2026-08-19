#!/usr/bin/env bash

# Validates the three candidate target schemas against the shared scenario corpus.
#
# Mirrors authzed/validate.sh: fully offline, `zed validate` shares its parser and evaluator
# with SpiceDB, so no server is required. Uses a local `zed` binary when available, otherwise
# the same pinned container image as the authzed-cli service in docker-compose.dev.yml.
#
# These files are DESIGN ARTIFACTS. They are not the shipping schema and must never be applied
# to a live SpiceDB: authzed/schema.zed is the frozen cutover artifact (see authzed/CUTOVER.md).

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly ZED_IMAGE="${ZED_IMAGE_REF:-authzed/zed:v1.1.1}"
readonly SUITES=(
  "candidate-a-validation.yaml"
  "candidate-b-validation.yaml"
  "candidate-c-validation.yaml"
)

run_zed() {
  if command -v zed >/dev/null 2>&1; then
    zed validate "${SCRIPT_DIR}/$1"
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm \
      --volume "${SCRIPT_DIR}:/authzed:ro" \
      "${ZED_IMAGE}" \
      validate "/authzed/$1"
  else
    printf '%s\n' "Neither a zed binary nor docker is available. Install zed (https://github.com/authzed/zed) or start Docker." >&2
    exit 1
  fi
}

status=0
for suite in "${SUITES[@]}"; do
  printf '\n=== %s ===\n' "${suite}"
  run_zed "${suite}" || status=1
done

exit "${status}"
