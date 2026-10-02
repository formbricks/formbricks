#!/usr/bin/env bash
# Runs once when the dev container is created (postCreateCommand). `pnpm go` then runs on every attach.
set -euo pipefail

cd "$(dirname -- "${BASH_SOURCE[0]}")/.."

# The image ships its own global pnpm, which shadows corepack and fails to switch to the pinned
# version, so install exactly what package.json's packageManager names. Fail closed on anything
# that is not a plain pnpm@x.y.z.
package_manager="$(node -p "require('./package.json').packageManager")"
if [[ ! "${package_manager}" =~ ^pnpm@[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  printf 'Error: unexpected packageManager "%s" in package.json\n' "${package_manager}" >&2
  exit 1
fi
npm install -g "${package_manager}"
hash -r

pnpm install
# db:up runs `pnpm dev:setup` (creates .env and generates its secrets) and starts the compose services.
pnpm db:up
# db:up already blocks on Postgres's healthcheck today, but only because other services depend on it
# with `service_healthy`. Wait explicitly so migrating doesn't hinge on those dependents staying put.
docker compose -f docker-compose.dev.yml up -d --wait postgres
pnpm db:migrate:dev
