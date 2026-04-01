#!/usr/bin/env bash

set -euo pipefail

PROFILE="${1:-}"
SCENARIO="${2:-all}"
K6_DOCKER_IMAGE="${K6_DOCKER_IMAGE:-grafana/k6:latest}"

if [[ -z "$PROFILE" ]]; then
  echo "usage: scripts/rate-limit/run-k6.sh <smoke|burst|soak> [public|management|negative|all]" >&2
  exit 1
fi

case "$PROFILE" in
  smoke|burst|soak) ;;
  *)
    echo "invalid profile: $PROFILE" >&2
    exit 1
    ;;
esac

case "$SCENARIO" in
  public|management|negative|all) ;;
  *)
    echo "invalid scenario: $SCENARIO" >&2
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K6_SCRIPT="/workspace/scripts/rate-limit/k6/envoy-hardening.js"

build_env_args() {
  local key
  env_args=()
  for key in HOST ENVIRONMENT_ID API_KEY VUS ITERATIONS DURATION MAX_DURATION SLEEP_SECONDS; do
    if [[ -n "${!key:-}" ]]; then
      env_args+=(-e "$key=${!key}")
    fi
  done
}

run_single() {
  local scenario="$1"
  local tmp_output
  local status=0
  local command_status=0
  tmp_output="$(mktemp)"

  echo "== k6 profile=$PROFILE scenario=$scenario =="

  build_env_args

  if command -v k6 >/dev/null 2>&1; then
    set +e
    (
      cd "$REPO_ROOT"
      k6 run "${env_args[@]}" -e "PROFILE=$PROFILE" -e "SCENARIO=$scenario" \
        "scripts/rate-limit/k6/envoy-hardening.js"
    ) | tee "$tmp_output"
    command_status="${PIPESTATUS[0]}"
    set -e
  else
    if ! docker info >/dev/null 2>&1; then
      echo "docker is required for the k6 fallback, but the Docker daemon is not reachable" >&2
      rm -f "$tmp_output"
      return 1
    fi

    set +e
    docker run --rm -i \
      -v "$REPO_ROOT:/workspace" \
      -w /workspace \
      "${env_args[@]}" \
      -e "PROFILE=$PROFILE" \
      -e "SCENARIO=$scenario" \
      "$K6_DOCKER_IMAGE" run "$K6_SCRIPT" | tee "$tmp_output"
    command_status="${PIPESTATUS[0]}"
    set -e
  fi

  if [[ "$command_status" -ne 0 ]]; then
    rm -f "$tmp_output"
    return "$command_status"
  fi

  if rg -q '^result=FAIL$' "$tmp_output"; then
    status=1
  fi

  rm -f "$tmp_output"
  return "$status"
}

overall_status=0

if [[ "$SCENARIO" == "all" ]]; then
  for scenario in public management negative; do
    if ! run_single "$scenario"; then
      overall_status=1
    fi
  done
else
  if ! run_single "$SCENARIO"; then
    overall_status=1
  fi
fi

exit "$overall_status"
