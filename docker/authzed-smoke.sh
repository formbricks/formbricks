#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_ROOT}/docker-compose.dev.yml"
readonly PROJECT_NAME="formbricks-authzed-smoke-${$}"
readonly AUTHZED_TOKEN="0000000000000000000000000000000000000000000000000000000000000001"
readonly AUTHZED_DATABASE_PASSWORD="0000000000000000000000000000000000000000000000000000000000000002"

compose() {
  docker compose --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}" "$@"
}

cleanup() {
  local exit_code=$?

  if [[ ${exit_code} -ne 0 ]]; then
    compose ps --all || true
    compose logs --no-color postgres authzed-db-bootstrap spicedb-migrate spicedb || true
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

for _ in $(seq 1 30); do
  if [[ "$(compose ps --format json spicedb | tr -d '\n')" == *'"Health":"healthy"'* ]]; then
    break
  fi
  sleep 2
done

if [[ "$(compose ps --format json spicedb | tr -d '\n')" != *'"Health":"healthy"'* ]]; then
  printf '%s\n' "SpiceDB did not become healthy." >&2
  exit 1
fi

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

compose up --detach --force-recreate spicedb

for _ in $(seq 1 30); do
  if [[ "$(compose ps --format json spicedb | tr -d '\n')" == *'"Health":"healthy"'* ]]; then
    break
  fi
  sleep 2
done

[[ "$(zed permission check document:smoke view user:alice --consistency-full)" == *"true"* ]]
[[ "$(zed permission check document:smoke view user:bob --consistency-full)" == *"false"* ]]

service_logs="$(compose logs --no-color authzed-db-bootstrap spicedb-migrate spicedb)"
if [[ "${service_logs}" == *"${AUTHZED_TOKEN}"* || "${service_logs}" == *"${AUTHZED_DATABASE_PASSWORD}"* ]]; then
  printf '%s\n' "AuthZed service logs exposed a configured secret." >&2
  exit 1
fi

printf '%s\n' "AuthZed smoke test passed: migrations were idempotent, Alice was allowed, Bob denied, and data survived recreation."
