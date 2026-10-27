#!/usr/bin/env bash
# Only isolated disposable databases are used. Never accepts a customer database URL.
set -euo pipefail
image="${1:?image digest required}"
identity="${2:?build identity required}"
variant="${3:?build variant required}"
platform="${4:-linux/amd64}"
prefix="fb-image-smoke-$$"
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker logs --tail 100 "$prefix-web" 2>/dev/null || true; fi
  docker rm -fv "$prefix-web" "$prefix-pg" "$prefix-redis" >/dev/null 2>&1 || true
  docker network rm "$prefix" >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

case "$image" in
  *@sha256:*) docker pull --platform "$platform" "$image" >/dev/null ;;
esac
docker run --rm --platform "$platform" --network none --entrypoint node "$image" \
  verify-next-runtime.mjs "$identity" "$variant"
# Node is compiled per architecture, so each one needs its own proof that it trusts the OS CA bundle.
DOCKER_DEFAULT_PLATFORM="$platform" bash "$(dirname "${BASH_SOURCE[0]}")/../apps/web/scripts/docker/verify-tls-image.sh" "$image"
docker network create "$prefix" >/dev/null
docker run -d --name "$prefix-pg" --network "$prefix" --network-alias postgres \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=formbricks \
  pgvector/pgvector@sha256:9ae02a756ba16a2d69dd78058e25915e36e189bb36ddf01ceae86390d7ed786a >/dev/null
docker run -d --name "$prefix-redis" --network "$prefix" --network-alias redis \
  valkey/valkey@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84 >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$prefix-pg" pg_isready -U test -d formbricks >/dev/null 2>&1; then break; fi
  if [ "$attempt" -eq 60 ]; then echo "Database did not start" >&2; exit 1; fi
  sleep 1
done
key=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
docker run -d --name "$prefix-web" --platform "$platform" --network "$prefix" -p 127.0.0.1::3000 \
  -e DATABASE_URL=postgresql://test:test@postgres:5432/formbricks \
  -e REDIS_URL=redis://redis:6379 -e ENCRYPTION_KEY="$key" -e BETTER_AUTH_SECRET="$key" \
  -e HUB_API_URL=http://127.0.0.1:4000 -e HUB_API_KEY=build-time-placeholder \
  -e CUBEJS_API_URL=http://127.0.0.1:4000 -e CUBEJS_API_SECRET=build-time-placeholder \
  -e AUTHZED_ENABLED=true -e AUTHZED_ENDPOINT=127.0.0.1:50051 \
  -e AUTHZED_TOKEN=startup-test-placeholder -e AUTHZED_SYSTEM_KEY=formbricks \
  -e AUTHZED_CONSISTENCY=fully_consistent "$image" >/dev/null
port="$(docker port "$prefix-web" 3000/tcp | sed 's/.*://')"
origin="http://127.0.0.1:$port"
for attempt in $(seq 1 180); do
  if curl --fail --silent --max-time 5 "$origin/health" >/dev/null; then break; fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$prefix-web")" != true ] || [ "$attempt" -eq 180 ]; then
    echo "Image failed to start" >&2
    exit 1
  fi
  sleep 2
done
docker exec -i "$prefix-pg" psql -U test -d formbricks -v ON_ERROR_STOP=1 < docker/fixtures/image-smoke.sql
node docker/smoke-next-browser.mjs "$origin"
