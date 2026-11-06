#!/usr/bin/env bash
# Starts Cube for the v3 contract job, the way the bundled docker/docker-compose.yml does: the Hub image
# applies its schema (Cube's FeedbackRecords model reads the Hub's `feedback_records` table), then the
# pinned Cube image serves docker/cube/cube.js and docker/cube/schema against the same database.
#
# Run from the repository root after the Prisma migrations, with the app's .env in place: Cube signs
# nothing itself, it verifies the JWTs the app mints, so it must share the app's CUBEJS_API_SECRET,
# issuer and audience. Without Cube the chart query operations can only answer their 502.

set -euo pipefail

readonly CUBE_CONTAINER="formbricks-cube-ci"
# The app's CUBEJS_API_URL must point here; 4000 is what .env.example ships.
readonly CUBE_PORT="${CUBE_PORT:-4000}"
# Same Hub release and digest the Helm chart deploys (charts/formbricks/values.yaml, hub.image).
readonly HUB_IMAGE="${HUB_IMAGE_REF:-ghcr.io/formbricks/hub:0.14.1@sha256:3407fff46303c3c24091f2d0d0a3dbc94b8539ebd84a258575bcbf52bedda745}"
# Same Cube release the bundled install and the Helm chart run (cube.image.tag), pinned to its index.
readonly CUBE_IMAGE="${CUBE_IMAGE_REF:-ghcr.io/formbricks/cube:1.8.8-2@sha256:4f5e46d3af9ae3e48e51419b9e2da4597ef7966b30823b05af71f77c0aa65540}"

read_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "${value}" && -f .env ]]; then
    value="$(sed -n "s/^${name}=//p" .env | tail -n 1)"
    value="${value%\'}"
    value="${value#\'}"
    value="${value%\"}"
    value="${value#\"}"
  fi
  printf '%s' "${value}"
}

CUBEJS_API_SECRET="$(read_env CUBEJS_API_SECRET)"
if [[ -z "${CUBEJS_API_SECRET}" ]]; then
  printf '%s\n' "CUBEJS_API_SECRET is missing from the environment and repository .env file." >&2
  exit 1
fi
CUBEJS_JWT_ISSUER="$(read_env CUBEJS_JWT_ISSUER)"
CUBEJS_JWT_AUDIENCE="$(read_env CUBEJS_JWT_AUDIENCE)"
DATABASE_URL="$(read_env DATABASE_URL)"
if [[ -z "${DATABASE_URL}" ]]; then
  printf '%s\n' "DATABASE_URL is missing from the environment and repository .env file." >&2
  exit 1
fi

# The app's Prisma URL carries `?schema=public`, which neither goose nor Cube understands, so take its
# parts and build each consumer's own form.
{
  read -r DB_HOST
  read -r DB_PORT
  read -r DB_NAME
  read -r DB_USER
  read -r DB_PASS
  read -r HUB_DATABASE_URL
} < <(node -e '
  const url = new URL(process.argv[1]);
  const name = decodeURIComponent(url.pathname.slice(1));
  const hub = new URL(`postgresql://${url.host}/${encodeURIComponent(name)}?sslmode=disable`);
  hub.username = url.username;
  hub.password = url.password;
  for (const part of [url.hostname, url.port || "5432", name, decodeURIComponent(url.username),
    decodeURIComponent(url.password), hub.href]) console.log(part);
' "${DATABASE_URL}")
readonly DB_HOST DB_PORT DB_NAME DB_USER DB_PASS HUB_DATABASE_URL

# The same migration command as the compose `hub-migrate` service.
docker run --rm \
  --network host \
  --env DATABASE_URL="${HUB_DATABASE_URL}" \
  --entrypoint sh \
  "${HUB_IMAGE}" \
  -c '/usr/local/bin/goose -dir /app/migrations postgres "$DATABASE_URL" up && /usr/local/bin/river migrate-up --database-url "$DATABASE_URL"' \
  >/dev/null
printf '%s\n' "Hub schema applied."

docker rm --force "${CUBE_CONTAINER}" >/dev/null 2>&1 || true

# With host networking a server already on the port (a local dev Cube, say) would answer the readiness
# probe while this container dies on EADDRINUSE, and the app would query the wrong Cube.
if curl -o /dev/null -s --max-time 2 "http://127.0.0.1:${CUBE_PORT}/"; then
  printf '%s\n' "Port ${CUBE_PORT} is already in use; stop that server or set CUBE_PORT." >&2
  exit 1
fi

# Environment and mounts as in docker/docker-compose.yml's `cube` service.
docker run --detach \
  --name "${CUBE_CONTAINER}" \
  --network host \
  --memory 1g \
  --env CUBEJS_DB_TYPE=postgres \
  --env CUBEJS_DB_HOST="${DB_HOST}" \
  --env CUBEJS_DB_PORT="${DB_PORT}" \
  --env CUBEJS_DB_NAME="${DB_NAME}" \
  --env CUBEJS_DB_USER="${DB_USER}" \
  --env CUBEJS_DB_PASS="${DB_PASS}" \
  --env CUBEJS_API_SECRET="${CUBEJS_API_SECRET}" \
  --env CUBEJS_JWT_ISSUER="${CUBEJS_JWT_ISSUER:-formbricks-web}" \
  --env CUBEJS_JWT_AUDIENCE="${CUBEJS_JWT_AUDIENCE:-formbricks-cube}" \
  --env CUBEJS_DEFAULT_API_SCOPES=meta,data \
  --env CUBEJS_EXTERNAL_DEFAULT=false \
  --env CUBEJS_CACHE_AND_QUEUE_DRIVER=memory \
  --env PORT="${CUBE_PORT}" \
  --volume "${PWD}/docker/cube/cube.js:/cube/conf/cube.js:ro" \
  --volume "${PWD}/docker/cube/schema:/cube/conf/model:ro" \
  "${CUBE_IMAGE}" >/dev/null

cube_running() {
  [[ "$(docker inspect --format '{{.State.Running}}' "${CUBE_CONTAINER}" 2>/dev/null)" == "true" ]]
}

# The compose healthcheck, run inside the container.
for _ in $(seq 1 60); do
  cube_running || break
  if docker exec "${CUBE_CONTAINER}" node -e "require('http').get('http://127.0.0.1:${CUBE_PORT}/readyz', (res) => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));" >/dev/null 2>&1; then
    printf '%s\n' "Cube is ready on http://localhost:${CUBE_PORT}."
    exit 0
  fi
  sleep 2
done

printf '%s\n' "Cube did not become ready." >&2
docker logs "${CUBE_CONTAINER}" >&2 || true
exit 1
