#!/usr/bin/env bash
# Smoke test for a Cube image built from docker/cube-image. It starts the image the way the bundled
# docker/docker-compose.yml does (same environment, mounts and healthcheck, read from the rendered
# compose file) against a Postgres migrated by the Hub image, then checks tenant isolation through a JWT
# minted like the web app's. Used by .github/workflows/cube-image.yml, and runnable locally:
#
#   docker build -t formbricks-cube:dev docker/cube-image
#   docker/cube-image/smoke-test.sh formbricks-cube:dev
#
# Needs docker with the compose plugin, curl, and Node >= 20. HUB_IMAGE_TAG overrides the Hub image used
# to apply the schema.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <image>" >&2
  exit 2
fi

image="$1"
hub_image_tag="${HUB_IMAGE_TAG:-0.8.5}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
compose_file="$script_dir/../docker-compose.yml"
helper="$script_dir/smoke-test.mjs"

run_id="cube-smoke-$(node "$helper" random-hex 4)"
network="$run_id"
postgres="$run_id-postgres"
cube="$run_id-cube"
cube_without_secret="$run_id-no-secret"
work_dir="$(mktemp -d)"

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ] && docker container inspect "$cube" >/dev/null 2>&1; then
    echo "--- $cube logs ---" >&2
    docker logs "$cube" >&2 2>&1 || true
  fi
  docker rm -f "$postgres" "$cube" "$cube_without_secret" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
  exit "$status"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# Retries a command once a second until it succeeds or the attempts run out.
wait_for() {
  local description="$1" attempts="$2"
  shift 2
  local attempt
  for attempt in $(seq 1 "$attempts"); do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "timed out after ${attempts}s waiting for $description"
}

container_stopped() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1")" = "false" ]
}

postgres_password="$(node "$helper" random-hex 16)"
api_secret="$(node "$helper" random-hex 32)"

# Renders docker/docker-compose.yml with a clean environment, so nothing exported in the caller's shell
# (or a docker/.env) changes what is under test. The second argument is CUBEJS_API_SECRET.
render_compose() {
  env -i PATH="$PATH" HOME="$HOME" ${DOCKER_CONFIG:+DOCKER_CONFIG="$DOCKER_CONFIG"} \
    POSTGRES_PASSWORD="$postgres_password" \
    AUTHZED_TOKEN=smoke-test \
    AUTHZED_DATABASE_PASSWORD=smoke-test \
    HUB_IMAGE_REF=":$hub_image_tag" \
    CUBEJS_API_SECRET="$2" \
    docker compose --env-file /dev/null -f "$compose_file" config --format json >"$1"
}

render_compose "$work_dir/compose.json" "$api_secret"
render_compose "$work_dir/compose-without-secret.json" ""

docker network create "$network" >/dev/null

echo "Starting Postgres and applying the Hub $hub_image_tag schema"
node "$helper" run "$work_dir/compose.json" postgres \
  --detach --name "$postgres" --network "$network" --network-alias postgres >/dev/null
# Over TCP on purpose: during initdb the image runs a temporary server on the Unix socket only.
wait_for "Postgres to accept connections" 60 docker exec "$postgres" pg_isready -h 127.0.0.1 -U postgres -d formbricks
node "$helper" run "$work_dir/compose.json" hub-migrate --rm --network "$network"
node "$helper" seed-sql | docker exec -i "$postgres" psql -v ON_ERROR_STOP=1 -q -U postgres -d formbricks

# As the Helm chart's default cube.containerSecurityContext runs it: uid 1000, a read-only root
# filesystem, no capabilities and no privilege escalation. Cube must need no writable path of its own.
echo "Starting $image as uid 1000 with a read-only root filesystem"
node "$helper" run "$work_dir/compose.json" cube --image "$image" \
  --detach --name "$cube" --network "$network" --publish 127.0.0.1::4000 \
  --user 1000 --read-only --cap-drop ALL --security-opt no-new-privileges >/dev/null
cube_url="http://$(docker port "$cube" 4000/tcp | head -n 1)"

for attempt in $(seq 1 120); do
  if curl -fsS -o /dev/null "$cube_url/readyz" 2>/dev/null; then
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$cube")" != "true" ]; then
    fail "Cube exited before /readyz answered"
  fi
  if [ "$attempt" -eq 120 ]; then
    fail "Cube /readyz did not answer 200 within 120s"
  fi
  sleep 1
done
echo "PASS: /readyz answers 200"

node "$helper" healthcheck "$work_dir/compose.json" cube "$cube"
node "$helper" check-queries "$work_dir/compose.json" "$cube_url"

# As the image's default user (compose sets none), which also proves that user can read the mounts:
# the error below is raised by cube.js itself, so it is only printed once cube.js has loaded.
echo "Starting $image without CUBEJS_API_SECRET"
node "$helper" run "$work_dir/compose-without-secret.json" cube --image "$image" \
  --detach --name "$cube_without_secret" --network "$network" >/dev/null
wait_for "the container without a secret to exit" 60 container_stopped "$cube_without_secret"
exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$cube_without_secret")"
logs="$(docker logs "$cube_without_secret" 2>&1)"
if [ "$exit_code" -eq 0 ] || [[ "$logs" != *"CUBEJS_API_SECRET is required to run Cube"* ]]; then
  echo "$logs" >&2
  fail "a container without CUBEJS_API_SECRET exited $exit_code without the expected error"
fi
echo "PASS: a container without CUBEJS_API_SECRET exits $exit_code"

echo "Cube image smoke test passed: $image"
