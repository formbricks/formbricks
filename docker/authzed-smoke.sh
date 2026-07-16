#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_ROOT}/docker-compose.dev.yml"
readonly PROJECT_NAME="formbricks-authzed-smoke-${$}"
readonly AUTHZED_TOKEN="0000000000000000000000000000000000000000000000000000000000000001"
readonly AUTHZED_DATABASE_PASSWORD="0000000000000000000000000000000000000000000000000000000000000002"
readonly WRONG_AUTHZED_TOKEN="0000000000000000000000000000000000000000000000000000000000000003"

compose() {
  docker compose --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}" "$@"
}

wait_for_spicedb() {
  for _ in $(seq 1 30); do
    if [[ "$(compose ps --format json spicedb | tr -d '\n')" == *'"Health":"healthy"'* ]]; then
      return 0
    fi
    sleep 2
  done

  printf '%s\n' "SpiceDB did not become healthy." >&2
  return 1
}

refresh_spicedb_port() {
  spicedb_binding="$(compose port spicedb 50051)"
  spicedb_port="${spicedb_binding##*:}"
}

authzed_health() {
  local token="$1"

  env \
    AUTHZED_CONSISTENCY=minimize_latency \
    AUTHZED_ENABLED=true \
    AUTHZED_ENDPOINT="localhost:${spicedb_port}" \
    AUTHZED_INSECURE=true \
    AUTHZED_SYSTEM_KEY=formbricks \
    AUTHZED_TOKEN="${token}" \
    CUBEJS_API_SECRET=authzed-smoke-cube-secret \
    CUBEJS_API_URL=https://cube.formbricks.local \
    DATABASE_URL=https://database.formbricks.local/formbricks \
    ENCRYPTION_KEY=authzed-smoke-encryption-key \
    HUB_API_KEY=authzed-smoke-hub-key \
    HUB_API_URL=https://hub.formbricks.local \
    LOG_LEVEL=fatal \
    NODE_ENV=test \
    NODE_OPTIONS=--conditions=react-server \
    pnpm --dir "${REPO_ROOT}/apps/web" exec tsx ./scripts/authzed-health.ts
}

assert_health_result() {
  local output="$1"
  local expected_status="$2"
  local expected_code="${3:-}"

  if [[ -n "${expected_code}" ]]; then
    if jq --exit-status \
      --arg status "${expected_status}" \
      --arg code "${expected_code}" \
      '.status == $status and .code == $code and (.latencyMs | type == "number")' \
      <<<"${output}" >/dev/null; then
      return
    fi
  elif jq --exit-status \
    --arg status "${expected_status}" \
    '.status == $status and (.latencyMs | type == "number")' \
    <<<"${output}" >/dev/null; then
    return
  fi

  printf '%s\n' "Application health CLI returned an invalid or unexpected result:" >&2
  printf '%s\n' "${output}" | sanitize_logs >&2
  return 1
}

sanitize_logs() {
  sed \
    -e "s/${AUTHZED_TOKEN}/[REDACTED_AUTHZED_TOKEN]/g" \
    -e "s/${WRONG_AUTHZED_TOKEN}/[REDACTED_WRONG_AUTHZED_TOKEN]/g" \
    -e "s/${AUTHZED_DATABASE_PASSWORD}/[REDACTED_AUTHZED_DATABASE_PASSWORD]/g"
}

cleanup() {
  local exit_code=$?

  if [[ ${exit_code} -ne 0 ]]; then
    compose ps --all || true
    compose logs --no-color postgres authzed-db-bootstrap spicedb-migrate spicedb 2>&1 | sanitize_logs || true
  fi

  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "${exit_code}"
}

trap cleanup EXIT

export AUTHZED_DATABASE_PASSWORD
export AUTHZED_TOKEN
export POSTGRES_PORT=0
export SPICEDB_GRPC_PORT=0

compose config --quiet
compose up --detach postgres
compose up authzed-db-bootstrap spicedb-migrate

# Prove both initialization stages are safe to repeat before starting the server.
compose run --rm authzed-db-bootstrap
compose run --rm spicedb-migrate

compose up --detach spicedb
wait_for_spicedb

refresh_spicedb_port

if ! empty_schema_health="$(authzed_health "${AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI failed before schema installation." >&2
  exit 1
fi
assert_health_result "${empty_schema_health}" "healthy"

if wrong_token_health="$(authzed_health "${WRONG_AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI unexpectedly accepted an incorrect token." >&2
  exit 1
fi
assert_health_result "${wrong_token_health}" "unhealthy" "authzed_permission_denied"
jq --exit-status '.retryable == false' <<<"${wrong_token_health}" >/dev/null

zed() {
  compose run --rm --no-deps authzed-cli "$@" \
    --endpoint spicedb:50051 \
    --token "${AUTHZED_TOKEN}" \
    --insecure \
    --skip-version-check
}

zed schema write /schema.zed

zed relationship create document:smoke reader user:alice

alice_result="$(zed permission check document:smoke view user:alice --consistency-full)"
bob_result="$(zed permission check document:smoke view user:bob --consistency-full)"

[[ "${alice_result}" == *"true"* ]]
[[ "${bob_result}" == *"false"* ]]

compose stop spicedb

if unavailable_health="$(authzed_health "${AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI unexpectedly succeeded while SpiceDB was stopped." >&2
  exit 1
fi
assert_health_result "${unavailable_health}" "unhealthy" "authzed_unavailable"
jq --exit-status '.latencyMs <= 4000' <<<"${unavailable_health}" >/dev/null

compose up --detach --force-recreate spicedb
wait_for_spicedb
refresh_spicedb_port

if ! restored_health="$(authzed_health "${AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI did not recover after SpiceDB recreation." >&2
  exit 1
fi
assert_health_result "${restored_health}" "healthy"

[[ "$(zed permission check document:smoke view user:alice --consistency-full)" == *"true"* ]]
[[ "$(zed permission check document:smoke view user:bob --consistency-full)" == *"false"* ]]

service_logs="$(compose logs --no-color postgres authzed-db-bootstrap spicedb-migrate spicedb)"
application_outputs="${empty_schema_health}${wrong_token_health}${unavailable_health}${restored_health}"
if [[ "${service_logs}${application_outputs}" == *"${AUTHZED_TOKEN}"* || \
  "${service_logs}${application_outputs}" == *"${WRONG_AUTHZED_TOKEN}"* || \
  "${service_logs}${application_outputs}" == *"${AUTHZED_DATABASE_PASSWORD}"* ]]; then
  printf '%s\n' "AuthZed service logs exposed a configured secret." >&2
  exit 1
fi

printf '%s\n' "AuthZed smoke test passed: application health, authentication failure, bounded outage handling, idempotent migrations, and persistence were verified."
