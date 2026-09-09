#!/usr/bin/env bash

set -euo pipefail

readonly CONTAINER_NAME="formbricks-authzed-ci"
readonly SPICEDB_IMAGE="${SPICEDB_IMAGE_REF:-authzed/spicedb:v1.52.0}"
readonly ZED_IMAGE="${ZED_IMAGE_REF:-authzed/zed:v1.1.1}"

AUTHZED_TOKEN="${AUTHZED_TOKEN:-}"
if [[ -z "${AUTHZED_TOKEN}" && -f .env ]]; then
  AUTHZED_TOKEN="$(sed -n 's/^AUTHZED_TOKEN=//p' .env | tail -n 1)"
fi
if [[ -z "${AUTHZED_TOKEN}" ]]; then
  printf '%s\n' "AUTHZED_TOKEN is missing from the environment and repository .env file." >&2
  exit 1
fi
readonly AUTHZED_TOKEN

docker rm --force "${CONTAINER_NAME}" >/dev/null 2>&1 || true

docker run --detach \
  --name "${CONTAINER_NAME}" \
  --network host \
  --memory 512m \
  --env SPICEDB_DATASTORE_ENGINE=memory \
  --env SPICEDB_GRPC_PRESHARED_KEY="${AUTHZED_TOKEN}" \
  --env SPICEDB_LOG_FORMAT=json \
  --env SPICEDB_LOG_LEVEL=info \
  --env SPICEDB_TELEMETRY_ENDPOINT= \
  "${SPICEDB_IMAGE}" \
  serve >/dev/null

for _ in $(seq 1 30); do
  if docker exec "${CONTAINER_NAME}" \
    /usr/local/bin/grpc_health_probe -addr=localhost:50051 >/dev/null 2>&1; then
    docker run --rm \
      --network host \
      --entrypoint zed \
      --volume "${PWD}/authzed/schema.zed:/schema.zed:ro" \
      "${ZED_IMAGE}" \
      schema write /schema.zed \
      --endpoint localhost:50051 \
      --token "${AUTHZED_TOKEN}" \
      --insecure \
      --skip-version-check >/dev/null

    printf '%s\n' "AuthZed CI fixture is healthy and the canonical schema is installed."
    exit 0
  fi
  sleep 2
done

printf '%s\n' "AuthZed CI fixture did not become healthy." >&2
docker logs "${CONTAINER_NAME}" >&2 || true
exit 1
