#!/usr/bin/env bash

# Validates the canonical Formbricks authorization schema (schema.zed) against
# the assertion suite in schema-validation.yaml using `zed validate`.
#
# Runs fully offline — no SpiceDB server required. Uses a local `zed` binary
# when available, otherwise the pinned zed container image (the same pin as the
# authzed-cli service in docker-compose.dev.yml).

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly VALIDATION_FILE="schema-validation.yaml"
readonly ZED_IMAGE="${ZED_IMAGE_REF:-authzed/zed:v1.1.1}"

if command -v zed >/dev/null 2>&1; then
  zed validate "${SCRIPT_DIR}/${VALIDATION_FILE}"
elif command -v docker >/dev/null 2>&1; then
  docker run --rm \
    --volume "${SCRIPT_DIR}:/authzed:ro" \
    "${ZED_IMAGE}" \
    validate "/authzed/${VALIDATION_FILE}"
else
  printf '%s\n' "Neither a zed binary nor docker is available. Install zed (https://github.com/authzed/zed) or start Docker." >&2
  exit 1
fi
