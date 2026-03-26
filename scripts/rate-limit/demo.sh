#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-all}"
HOST="${HOST:-https://staging.app.formbricks.com}"
ENVIRONMENT_ID="${ENVIRONMENT_ID:-}"
API_KEY="${API_KEY:-}"
PUBLIC_COUNT="${PUBLIC_COUNT:-125}"
PUBLIC_CONCURRENCY="${PUBLIC_CONCURRENCY:-20}"
MANAGEMENT_COUNT="${MANAGEMENT_COUNT:-125}"
MANAGEMENT_CONCURRENCY="${MANAGEMENT_CONCURRENCY:-20}"
WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BURST_SCRIPT="$WORKDIR/burst-test.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

usage() {
  cat <<'EOF'
usage: scripts/rate-limit/demo.sh [preflight|public|management|all]

Required environment variables:
  ENVIRONMENT_ID   Staging environment ID for public client route checks
  API_KEY          Single-environment staging API key for management route checks

Optional environment variables:
  HOST                    Defaults to https://staging.app.formbricks.com
  PUBLIC_COUNT            Defaults to 125
  PUBLIC_CONCURRENCY      Defaults to 20
  MANAGEMENT_COUNT        Defaults to 125
  MANAGEMENT_CONCURRENCY  Defaults to 20
EOF
}

require_env_id() {
  if [[ -z "$ENVIRONMENT_ID" ]]; then
    echo "ENVIRONMENT_ID is required" >&2
    exit 1
  fi
}

require_api_key() {
  if [[ -z "$API_KEY" ]]; then
    echo "API_KEY is required" >&2
    exit 1
  fi
}

section() {
  printf '\n== %s ==\n' "$1"
}

run_and_capture() {
  local output_file="$1"
  shift

  "$@" | tee "$output_file"
}

summarize_output() {
  local output_file="$1"

  awk '
    /scenario=/ {
      status = ""
      source = ""
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^status=/) {
          status = substr($i, 8)
        }
        if ($i ~ /^source=/) {
          source = substr($i, 8)
        }
      }
      if (status != "" && source != "") {
        counts[status "|" source]++
      }
    }
    END {
      for (key in counts) {
        split(key, parts, "|")
        printf "status=%s source=%s count=%d\n", parts[1], parts[2], counts[key]
      }
    }
  ' "$output_file" | sort
}

assert_gateway_probe() {
  local output_file="$1"
  if ! rg -q 'source=gateway' "$output_file"; then
    echo "Expected a gateway-tagged response in probe output, but none was found." >&2
    exit 1
  fi
}

assert_gateway_rate_limit() {
  local output_file="$1"
  if ! rg -q 'status=429 source=gateway' "$output_file"; then
    echo "Expected at least one gateway 429 in burst output, but none was found." >&2
    exit 1
  fi
}

print_known_caveat() {
  cat <<'EOF'
Known staging caveat:
- intermittent 500/503 responses can still appear under high burst load on the environment route
- this is a staging stability issue on top of the Envoy POC, not a sign that the gateway path is bypassed
- the demo still passes if you see gateway-tagged 429 responses
EOF
}

run_preflight() {
  require_env_id
  require_api_key

  section "Preflight"
  echo "Host: $HOST"
  echo "Environment ID: $ENVIRONMENT_ID"
  echo "API key: provided"

  section "Public Route Probe"
  public_probe_output="$TMP_DIR/public-probe.txt"
  run_and_capture \
    "$public_probe_output" \
    env HOST="$HOST" ENVIRONMENT_ID="$ENVIRONMENT_ID" COUNT=1 "$BURST_SCRIPT" v1-client-environment
  assert_gateway_probe "$public_probe_output"

  section "Management Route Probe"
  management_probe_output="$TMP_DIR/management-probe.txt"
  run_and_capture \
    "$management_probe_output" \
    env HOST="$HOST" API_KEY="$API_KEY" COUNT=1 "$BURST_SCRIPT" management-api-key
  assert_gateway_probe "$management_probe_output"

  print_known_caveat
}

run_public_demo() {
  require_env_id

  section "Public IP Demo"
  echo "Route: GET /api/v1/client/$ENVIRONMENT_ID/environment"
  echo "Expected: gateway 429 after threshold"
  public_output="$TMP_DIR/public-burst.txt"
  run_and_capture \
    "$public_output" \
    env HOST="$HOST" ENVIRONMENT_ID="$ENVIRONMENT_ID" COUNT="$PUBLIC_COUNT" CONCURRENCY="$PUBLIC_CONCURRENCY" \
      "$BURST_SCRIPT" v1-client-environment

  section "Public IP Summary"
  summarize_output "$public_output"
  assert_gateway_rate_limit "$public_output"
}

run_management_demo() {
  require_api_key

  section "API Key Demo"
  echo "Route: GET /api/v1/management/me"
  echo "Expected: gateway 429 after threshold"
  management_output="$TMP_DIR/management-burst.txt"
  run_and_capture \
    "$management_output" \
    env HOST="$HOST" API_KEY="$API_KEY" COUNT="$MANAGEMENT_COUNT" CONCURRENCY="$MANAGEMENT_CONCURRENCY" \
      "$BURST_SCRIPT" management-api-key

  section "API Key Summary"
  summarize_output "$management_output"
  assert_gateway_rate_limit "$management_output"
}

case "$MODE" in
  preflight)
    run_preflight
    ;;
  public)
    run_public_demo
    ;;
  management)
    run_management_demo
    ;;
  all)
    run_preflight
    run_public_demo
    run_management_demo
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
