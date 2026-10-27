#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly BASE_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
readonly EXTERNAL_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.spicedb-external.yml"
readonly BUNDLED_PROJECT="formbricks-spicedb-bundled-smoke-${$}"
readonly EXTERNAL_PROJECT="formbricks-spicedb-external-smoke-${$}"
readonly EXTERNAL_NETWORK="formbricks-spicedb-external-smoke-${$}"
readonly EXTERNAL_CONTAINER="formbricks-spicedb-postgres-smoke-${$}"
readonly BUNDLED_DATABASE_PASSWORD="bundled-smoke-password"
readonly EXTERNAL_ADMIN_PASSWORD="external-admin-smoke-password"
readonly EXTERNAL_ROLE_PASSWORD="external-role-smoke-password"

export POSTGRES_PASSWORD="bundled-postgres-smoke-password"
export AUTHZED_TOKEN="0000000000000000000000000000000000000000000000000000000000000001"
export EXTERNAL_SMOKE_NETWORK="${EXTERNAL_NETWORK}"

smoke_dir="$(mktemp -d)"
external_database_uri=""

bundled_compose() {
  AUTHZED_DATABASE_PASSWORD="${BUNDLED_DATABASE_PASSWORD}" SPICEDB_DATASTORE_CONN_URI= \
    docker compose --project-name "${BUNDLED_PROJECT}" --file "${BASE_COMPOSE_FILE}" "$@"
}

external_compose() {
  env -u AUTHZED_DATABASE_PASSWORD SPICEDB_DATASTORE_CONN_URI="${external_database_uri}" \
    docker compose --project-name "${EXTERNAL_PROJECT}" --file "${BASE_COMPOSE_FILE}" \
      --file "${EXTERNAL_COMPOSE_FILE}" --file "${smoke_dir}/network.yml" "$@"
}

cleanup() {
  local status=$?
  trap - EXIT
  if ((status != 0)); then
    bundled_compose ps -a >&2 || true
    bundled_compose logs --tail=60 postgres authzed-db-bootstrap spicedb-migrate spicedb >&2 || true
    if [[ -f "${smoke_dir}/network.yml" ]]; then
      external_compose ps -a >&2 || true
      external_compose logs --tail=60 spicedb-migrate spicedb >&2 || true
    fi
    docker logs --tail=60 "${EXTERNAL_CONTAINER}" >&2 || true
  fi
  bundled_compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  if [[ -f "${smoke_dir}/network.yml" ]]; then
    external_compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  docker rm --force "${EXTERNAL_CONTAINER}" >/dev/null 2>&1 || true
  docker network rm "${EXTERNAL_NETWORK}" >/dev/null 2>&1 || true
  rm -rf "${smoke_dir}"
  exit "${status}"
}
trap cleanup EXIT

wait_for_spicedb() {
  local mode="$1"
  for _ in $(seq 1 60); do
    if [[ "$("${mode}_compose" ps --format json spicedb | tr -d '\n')" == *'"Health":"healthy"'* ]]; then
      return 0
    fi
    sleep 2
  done
  printf '%s\n' "${mode} SpiceDB did not become healthy." >&2
  return 1
}

assert_migration_completed() {
  local mode="$1"
  local migration_id
  migration_id="$("${mode}_compose" ps -a -q spicedb-migrate)"
  [[ -n "${migration_id}" ]]
  [[ "$(docker inspect --format '{{.State.ExitCode}}' "${migration_id}")" == "0" ]]
}

bundled_compose up --detach spicedb
assert_migration_completed bundled
wait_for_spicedb bundled
bootstrap_id="$(bundled_compose ps -a -q authzed-db-bootstrap)"
[[ -n "${bootstrap_id}" ]]
[[ "$(docker inspect --format '{{.State.ExitCode}}' "${bootstrap_id}")" == "0" ]]

docker network create "${EXTERNAL_NETWORK}" >/dev/null
cat >"${smoke_dir}/network.yml" <<'YAML'
services:
  spicedb-migrate:
    networks: [default, external-smoke]
  spicedb:
    networks: [default, external-smoke]
networks:
  external-smoke:
    external: true
    name: ${EXTERNAL_SMOKE_NETWORK:?External smoke network is required}
YAML

docker run --detach --name "${EXTERNAL_CONTAINER}" --network "${EXTERNAL_NETWORK}" \
  --network-alias external-db --env POSTGRES_PASSWORD="${EXTERNAL_ADMIN_PASSWORD}" \
  pgvector/pgvector:pg18 >/dev/null

for _ in $(seq 1 60); do
  if docker exec "${EXTERNAL_CONTAINER}" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec "${EXTERNAL_CONTAINER}" pg_isready -U postgres -d postgres >/dev/null

docker exec -i "${EXTERNAL_CONTAINER}" psql -U postgres -d postgres \
  --set=ON_ERROR_STOP=1 --set=role_password="${EXTERNAL_ROLE_PASSWORD}" >/dev/null <<'SQL'
CREATE ROLE spicedb LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'role_password';
CREATE DATABASE spicedb OWNER spicedb;
SQL

role_capabilities="$(docker exec "${EXTERNAL_CONTAINER}" psql -U postgres -d postgres --tuples-only --no-align \
  --command="SELECT rolsuper::int::text || rolcreatedb::int::text || rolcreaterole::int::text FROM pg_roles WHERE rolname = 'spicedb'")"
[[ "${role_capabilities}" == "000" ]]

external_database_uri="postgresql://spicedb:wrong-password@external-db:5432/spicedb?sslmode=disable"
if external_compose up --detach spicedb >"${smoke_dir}/expected-migration-failure.log" 2>&1; then
  printf '%s\n' "External SpiceDB started despite invalid database credentials." >&2
  exit 1
fi
if external_compose ps --status running --services spicedb | grep --fixed-strings --line-regexp spicedb >/dev/null; then
  printf '%s\n' "External SpiceDB started before its datastore migration completed." >&2
  exit 1
fi

external_database_uri="postgresql://spicedb:${EXTERNAL_ROLE_PASSWORD}@external-db:5432/spicedb?sslmode=disable"
external_compose up --detach --force-recreate spicedb-migrate spicedb
assert_migration_completed external
wait_for_spicedb external

external_compose config --format json | jq --exit-status '
  (.services | has("authzed-db-bootstrap") | not) and
  .services["spicedb-migrate"].depends_on == null and
  .services.spicedb.depends_on["spicedb-migrate"].condition == "service_completed_successfully" and
  ([.services[] | .environment.POSTGRES_ADMIN_URL?] | all(. == null))
' >/dev/null

printf '%s\n' "Bundled and external SpiceDB Compose smoke tests passed."
