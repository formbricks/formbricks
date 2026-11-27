#!/usr/bin/env bash
# Rolling-deploy check for contact directories (ENG-7492). Delete this script, its two fixtures and the
# workflow step that calls it in the release that drops the `contact_directory_from_workspace` trigger.
#
# A 6.2 pod keeps writing while the new migrations run and knows nothing of directories. This runs the
# 6.2 image, migrates its database with the PR image, lets the still-running 6.2 image write a contact and
# an attribute key (SDK identify) and a segment (its own Prisma client), and checks that the trigger gave
# each row its workspace's directory.
#
# Usage: contact-directory-compat-smoke.sh <pr-image>
# DROP_DIRECTORY_TRIGGER=1 drops the trigger after the migrations, to show the check fails without it.
# Only isolated disposable databases are used. Never accepts a customer database URL.
set -euo pipefail
pr_image="${1:?PR image required}"
# Latest 6.2.x. Pinned by digest like every other image in the workflow; bump it when a 6.2 patch ships.
old_image="ghcr.io/formbricks/formbricks:6.2.2@sha256:b35e7b1fa7d001379282b5c0ed37daf740da6ca4d170593d52052b9aaed8ed04"
fixtures="$(dirname "${BASH_SOURCE[0]}")/fixtures"
prefix="fb-directory-compat-$$"
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker logs --tail 100 "$prefix-old" 2>/dev/null || true; fi
  docker rm -fv "$prefix-old" "$prefix-pg" "$prefix-redis" >/dev/null 2>&1 || true
  docker network rm "$prefix" >/dev/null 2>&1 || true
  # The persistent Blacksmith runner keeps pulled images, like the PR image the workflow removes.
  docker image rm "$old_image" >/dev/null 2>&1 || true
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

psql() { docker exec -i "$prefix-pg" psql -U test -d formbricks -v ON_ERROR_STOP=1 -q "$@"; }

docker pull "$old_image" >/dev/null
docker network create "$prefix" >/dev/null
docker run -d --name "$prefix-pg" --network "$prefix" --network-alias postgres \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=formbricks \
  pgvector/pgvector@sha256:9ae02a756ba16a2d69dd78058e25915e36e189bb36ddf01ceae86390d7ed786a >/dev/null
docker run -d --name "$prefix-redis" --network "$prefix" --network-alias redis \
  valkey/valkey@sha256:418652cfb58ef879d4978c33553735d7147016032d5aefaa14c828e611eb9dfd >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "$prefix-pg" pg_isready -U test -d formbricks >/dev/null 2>&1; then break; fi
  if [ "$attempt" -eq 60 ]; then echo "Database did not start" >&2; exit 1; fi
  sleep 1
done

database_url=postgresql://test:test@postgres:5432/formbricks
key=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# Cloud mode: the seeded billing row grants contacts, so 6.2 identify needs no license and calls no Stripe.
docker run -d --name "$prefix-old" --network "$prefix" -p 127.0.0.1::3000 \
  -e DATABASE_URL="$database_url" -e IS_FORMBRICKS_CLOUD=1 \
  -e REDIS_URL=redis://redis:6379 -e ENCRYPTION_KEY="$key" -e BETTER_AUTH_SECRET="$key" \
  -e HUB_API_URL=http://127.0.0.1:4000 -e HUB_API_KEY=build-time-placeholder \
  -e CUBEJS_API_URL=http://127.0.0.1:4000 -e CUBEJS_API_SECRET=build-time-placeholder \
  -e AUTHZED_ENABLED=true -e AUTHZED_ENDPOINT=127.0.0.1:50051 \
  -e AUTHZED_TOKEN=startup-test-placeholder -e AUTHZED_SYSTEM_KEY=formbricks \
  -e AUTHZED_CONSISTENCY=fully_consistent "$old_image" >/dev/null
origin="http://127.0.0.1:$(docker port "$prefix-old" 3000/tcp | sed 's/.*://')"
echo "Starting 6.2 on an empty database"
for attempt in $(seq 1 180); do
  if curl --fail --silent --max-time 5 "$origin/health" >/dev/null; then break; fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$prefix-old")" != true ] || [ "$attempt" -eq 180 ]; then
    echo "The 6.2 image failed to start" >&2
    exit 1
  fi
  sleep 2
done
psql < "$fixtures/contact-directory-compat.sql"

echo "Running the PR image's migrations while 6.2 keeps running"
docker run --rm --network "$prefix" -e DATABASE_URL="$database_url" --entrypoint node "$pr_image" \
  packages/database/dist/scripts/apply-migrations.js
if [ "${DROP_DIRECTORY_TRIGGER:-}" = 1 ]; then
  echo "DROP_DIRECTORY_TRIGGER=1: dropping the directory trigger, so the check below must fail"
  psql -c 'DROP TRIGGER contact_directory_from_workspace ON "Contact";
    DROP TRIGGER contact_directory_from_workspace ON "ContactAttributeKey";
    DROP TRIGGER contact_directory_from_workspace ON "Segment";'
fi

echo "Writing a contact, an attribute key and a segment with 6.2"
curl --fail-with-body --silent --show-error --max-time 30 -H 'Content-Type: application/json' \
  -d '{"userId":"directory-compat-user","attributes":{"ci_plan":"pro"}}' \
  "$origin/api/v1/client/dircompatworkspace/user"
echo
docker exec "$prefix-old" node -e '
  const { prisma } = require("/home/nextjs/packages/database/dist/index.cjs");
  prisma.segment
    .create({ data: { title: "directory-compat", isPrivate: false, filters: [], workspaceId: "dircompatworkspace" } })
    .then(() => prisma.$disconnect())
    .catch((error) => { console.error(error); process.exit(1); });
'

psql < "$fixtures/contact-directory-compat-check.sql"
echo "Every row 6.2 wrote after the migration got its directory"
