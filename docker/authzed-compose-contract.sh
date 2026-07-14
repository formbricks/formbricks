#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly DEV_COMPOSE_FILE="${REPO_ROOT}/docker-compose.dev.yml"
readonly PROD_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

readonly AUTHZED_TOKEN="${AUTHZED_TOKEN:-0000000000000000000000000000000000000000000000000000000000000001}"
readonly AUTHZED_DATABASE_PASSWORD="${AUTHZED_DATABASE_PASSWORD:-0000000000000000000000000000000000000000000000000000000000000002}"
readonly SPICEDB_IMAGE_REF="authzed/spicedb:v1.52.0"
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

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

docker compose --file "${PROD_COMPOSE_FILE}" config --format json >"${temp_dir}/production.json"
docker compose --file "${DEV_COMPOSE_FILE}" --profile authzed-ui --profile authzed-tools config --format json >"${temp_dir}/development.json"

jq --exit-status --arg token "${AUTHZED_TOKEN}" '
  .services.spicedb.image == "authzed/spicedb:v1.52.0" and
  .services["spicedb-migrate"].image == .services.spicedb.image and
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
  .services.formbricks.environment.AUTHZED_CONSISTENCY == "minimize_latency" and
  .services.formbricks.depends_on.spicedb? == null and
  ([.services | to_entries[] | select(.value.environment.AUTHZED_TOKEN? != null) | .key] | sort) == ["formbricks"]
' "${temp_dir}/production.json" >/dev/null

jq --exit-status --arg token "${AUTHZED_TOKEN}" '
  .services.spicedb.image == "authzed/spicedb:v1.52.0" and
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
