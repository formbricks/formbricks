#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
readonly ENV_PATH="${FORMBRICKS_ENV_PATH:-${ROOT}/.env}"
source "${ROOT}/scripts/dev-env.sh"

bash scripts/setup-dev-env.sh

# Automatic initialization is for the bundled development instance only. An
# external endpoint needs an explicit, reviewed `pnpm authzed:upgrade prepare`.
# Never source .env as shell code or print its contents.
port="$(read_env_value SPICEDB_GRPC_PORT)"
port="${port:-50051}"
if [[ -n "${AUTHZED_ENDPOINT:-}" || -n "${SPICEDB_GRPC_PORT:-}" || "$(read_env_value AUTHZED_ENDPOINT)" != "localhost:${port}" ]]; then
  printf '%s\n' 'Automatic SpiceDB preparation requires the bundled endpoint in the selected environment file and no shell endpoint/port overrides. For an external instance, use explicit authzed:upgrade commands.' >&2
  exit 1
fi

docker compose --env-file "${ENV_PATH}" -f docker-compose.dev.yml up -d --wait --wait-timeout 180 spicedb
# Load the same file for Prisma and the CLI, including a custom FORMBRICKS_ENV_PATH.
# The nested repository commands preserve this environment over their .env defaults.
pnpm exec dotenv -e "${ENV_PATH}" -- pnpm db:migrate:dev
pnpm exec dotenv -e "${ENV_PATH}" -- pnpm authzed:upgrade prepare
pnpm exec dotenv -e "${ENV_PATH}" -- pnpm authzed:upgrade check
