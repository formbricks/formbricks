#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly DEV_COMPOSE_FILE="${REPO_ROOT}/docker-compose.dev.yml"
readonly PROD_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
readonly EXTERNAL_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.spicedb-external.yml"

readonly POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-authzed-compose-contract-postgres}"
readonly AUTHZED_TOKEN="${AUTHZED_TOKEN:-0000000000000000000000000000000000000000000000000000000000000001}"
readonly AUTHZED_DATABASE_PASSWORD="${AUTHZED_DATABASE_PASSWORD:-0000000000000000000000000000000000000000000000000000000000000002}"
readonly EXTERNAL_DATABASE_URI="postgresql://scoped:contract-password@external-db:5432/spicedb?sslmode=verify-full&sslrootcert=/certs/ca.pem"
readonly SPICEDB_IMAGE_REF="authzed/spicedb:v1.56.2"
readonly SPICEDB_GRPC_PORT="50051"
readonly AUTHZED_GRPCUI_PORT="50052"
readonly GRPCUI_IMAGE_REF="fullstorydev/grpcui:v1.5.2"
readonly ZED_IMAGE_REF="authzed/zed:v1.1.1"

export AUTHZED_DATABASE_PASSWORD
export AUTHZED_GRPCUI_PORT
export AUTHZED_TOKEN
export GRPCUI_IMAGE_REF
export SPICEDB_GRPC_PORT
export SPICEDB_IMAGE_REF
export ZED_IMAGE_REF
export POSTGRES_PASSWORD
unset SPICEDB_DATASTORE_CONN_URI

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

docker compose --file "${PROD_COMPOSE_FILE}" --profile authzed-ops config --format json >"${temp_dir}/production.json"
docker compose --file "${PROD_COMPOSE_FILE}" config --services >"${temp_dir}/production-services.txt"
env -u AUTHZED_DATABASE_PASSWORD SPICEDB_DATASTORE_CONN_URI="${EXTERNAL_DATABASE_URI}" \
  docker compose --file "${PROD_COMPOSE_FILE}" --file "${EXTERNAL_COMPOSE_FILE}" \
  config --format json >"${temp_dir}/external.json"
env -u AUTHZED_DATABASE_PASSWORD SPICEDB_DATASTORE_CONN_URI="${EXTERNAL_DATABASE_URI}" \
  docker compose --file "${PROD_COMPOSE_FILE}" config --format json >"${temp_dir}/missing-override.json"
env -u AUTHZED_DATABASE_PASSWORD -u SPICEDB_DATASTORE_CONN_URI \
  docker compose --file "${PROD_COMPOSE_FILE}" config --format json >"${temp_dir}/missing-bundled.json"
docker compose --file "${DEV_COMPOSE_FILE}" --profile authzed-ui --profile authzed-tools config --format json >"${temp_dir}/development.json"

jq --exit-status --arg token "${AUTHZED_TOKEN}" --arg password "${AUTHZED_DATABASE_PASSWORD}" '
  .services.spicedb.image == "authzed/spicedb:v1.56.2" and
  .services["spicedb-migrate"].image == .services.spicedb.image and
  (.services | has("authzed-db-bootstrap")) and
  .services["authzed-db-bootstrap"].environment.POSTGRES_ADMIN_URL != null and
  .services["authzed-db-bootstrap"].environment.SPICEDB_EXTERNAL_POSTGRES == "" and
  .services["spicedb-migrate"].environment.SPICEDB_DATASTORE_CONN_URI ==
    ("postgresql://spicedb:" + $password + "@postgres:5432/spicedb?sslmode=disable") and
  .services.spicedb.environment.SPICEDB_DATASTORE_CONN_URI == .services["spicedb-migrate"].environment.SPICEDB_DATASTORE_CONN_URI and
  .services.spicedb.mem_limit == "536870912" and
  (.services.spicedb | has("cpus") | not) and
  (.services.spicedb | has("ports") | not) and
  .services.spicedb.depends_on["spicedb-migrate"].condition == "service_completed_successfully" and
  .services["spicedb-migrate"].depends_on["authzed-db-bootstrap"].condition == "service_completed_successfully" and
  .services.spicedb.healthcheck.test == ["CMD", "/usr/local/bin/grpc_health_probe", "-addr=localhost:50051"] and
  .services.spicedb.environment.SPICEDB_GRPC_PRESHARED_KEY == $token and
  .services.formbricks.environment.AUTHZED_ENABLED == "true" and
  .services.formbricks.environment.AUTHZED_ENDPOINT == "spicedb:50051" and
  .services.formbricks.environment.AUTHZED_TOKEN == $token and
  .services.formbricks.environment.AUTHZED_SYSTEM_KEY == "formbricks" and
  .services.formbricks.environment.AUTHZED_INSECURE == "true" and
  .services.formbricks.environment.AUTHZED_CONSISTENCY == "fully_consistent" and
  .services.formbricks.depends_on.spicedb? == null and
  .services["authzed-ops"].image == .services.formbricks.image and
  .services["authzed-ops"].profiles == ["authzed-ops"] and
  .services["authzed-ops"].entrypoint == ["formbricks-authzed"] and
  .services["authzed-ops"].command == ["health"] and
  .services["authzed-ops"].depends_on.postgres.condition == "service_healthy" and
  .services["authzed-ops"].depends_on.spicedb.condition == "service_healthy" and
  .services["authzed-ops"].environment.DATABASE_URL == .services.formbricks.environment.DATABASE_URL and
  .services["authzed-ops"].environment.AUTHZED_CONSISTENCY == "fully_consistent" and
  .services["authzed-initialize"].image == .services.formbricks.image and
  .services["authzed-initialize"].entrypoint == ["formbricks-authzed"] and
  .services["authzed-initialize"].command == ["upgrade", "prepare"] and
  .services["authzed-initialize"].restart == "no" and
  .services["authzed-initialize"].depends_on["formbricks-migrate"].condition == "service_completed_successfully" and
  .services["authzed-initialize"].depends_on.spicedb.condition == "service_healthy" and
  (.services["authzed-initialize"] | has("ports") | not) and
  (.services["authzed-initialize"] | has("volumes") | not) and
  (.services["authzed-ops"] | has("ports") | not) and
  (.services["authzed-ops"] | has("volumes") | not) and
  (.services["authzed-ops"] | has("restart") | not) and
  ([.services | to_entries[] | select(.value.environment.AUTHZED_TOKEN? != null) | .key] | sort) == ["authzed-initialize", "authzed-ops", "formbricks"]
' "${temp_dir}/production.json" >/dev/null

jq --exit-status --arg uri "${EXTERNAL_DATABASE_URI}" '
  (.services | has("authzed-db-bootstrap") | not) and
  .services["spicedb-migrate"].depends_on == null and
  .services.spicedb.depends_on["spicedb-migrate"].condition == "service_completed_successfully" and
  .services["spicedb-migrate"].environment.SPICEDB_DATASTORE_CONN_URI == $uri and
  .services.spicedb.environment.SPICEDB_DATASTORE_CONN_URI == $uri and
  ([.services[] | .environment.POSTGRES_ADMIN_URL?] | all(. == null))
' "${temp_dir}/external.json" >/dev/null

jq --exit-status --arg uri "${EXTERNAL_DATABASE_URI}" '
  .services["authzed-db-bootstrap"].environment.SPICEDB_EXTERNAL_POSTGRES == "true" and
  .services["spicedb-migrate"].environment.SPICEDB_DATASTORE_CONN_URI == $uri and
  .services.spicedb.environment.SPICEDB_DATASTORE_CONN_URI == $uri
' "${temp_dir}/missing-override.json" >/dev/null

jq --exit-status '
  .services["authzed-db-bootstrap"].environment.AUTHZED_DATABASE_PASSWORD == "" and
  .services["spicedb-migrate"].environment.SPICEDB_DATASTORE_CONN_URI ==
    "postgresql://spicedb:@postgres:5432/spicedb?sslmode=disable"
' "${temp_dir}/missing-bundled.json" >/dev/null

bootstrap_entrypoint="$(jq -r '.services["authzed-db-bootstrap"].entrypoint[2]' "${temp_dir}/production.json" | sed 's/\$\$/\$/g')"
if env -u AUTHZED_DATABASE_PASSWORD SPICEDB_EXTERNAL_POSTGRES= sh -ec "${bootstrap_entrypoint}" \
  >"${temp_dir}/missing-bundled.log" 2>&1; then
  printf '%s\n' "Bundled bootstrap accepted a missing database password." >&2
  exit 1
fi
grep --fixed-strings 'AUTHZED_DATABASE_PASSWORD is required' "${temp_dir}/missing-bundled.log" >/dev/null

if env -u SPICEDB_DATASTORE_CONN_URI \
  docker compose --file "${PROD_COMPOSE_FILE}" --file "${EXTERNAL_COMPOSE_FILE}" \
  config --quiet >"${temp_dir}/missing-external.log" 2>&1; then
  printf '%s\n' "External SpiceDB unexpectedly accepted a missing datastore URI." >&2
  exit 1
fi

if SPICEDB_EXTERNAL_POSTGRES=true sh -ec "${bootstrap_entrypoint}" \
  >"${temp_dir}/bootstrap-guard.log" 2>&1; then
  printf '%s\n' "Bundled bootstrap ran despite an external datastore URI." >&2
  exit 1
fi
grep --fixed-strings 'refusing bundled bootstrap' "${temp_dir}/bootstrap-guard.log" >/dev/null

if grep --fixed-strings --line-regexp "authzed-ops" "${temp_dir}/production-services.txt" >/dev/null; then
  printf '%s\n' "authzed-ops must not start without its explicit profile." >&2
  exit 1
fi

jq --exit-status --arg token "${AUTHZED_TOKEN}" '
  .services.spicedb.image == "authzed/spicedb:v1.56.2" and
  .services["spicedb-migrate"].image == .services.spicedb.image and
  .services.spicedb.mem_limit == "536870912" and
  (.services.spicedb | has("cpus") | not) and
  .services.spicedb.ports == [{"mode":"ingress","host_ip":"127.0.0.1","target":50051,"published":"50051","protocol":"tcp"}] and
  .services.spicedb.environment.SPICEDB_GRPC_PRESHARED_KEY == $token and
  .services["authzed-cli"].image == "authzed/zed:v1.1.1" and
  .services["authzed-ui"].profiles == ["authzed-ui"] and
  .services["authzed-ui"].image == "fullstorydev/grpcui:v1.5.2" and
  .services["authzed-ui"].ports == [{"mode":"ingress","host_ip":"127.0.0.1","target":8080,"published":"50052","protocol":"tcp"}] and
  .services["authzed-ui"].depends_on.spicedb.condition == "service_healthy"
' "${temp_dir}/development.json" >/dev/null

printf '%s\n' "AuthZed Compose contracts are valid."
