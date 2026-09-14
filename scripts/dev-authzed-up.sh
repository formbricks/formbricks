#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

bash scripts/setup-dev-env.sh

# Automatic initialization is for the bundled development instance only. An
# external endpoint needs an explicit, reviewed `pnpm authzed:upgrade prepare`.
# Never source .env as shell code or print its contents.
read_value() {
  awk -F= -v key="$1" '
    $1 == key {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"|"$/, "", value)
      gsub(/^\047|\047$/, "", value)
      print value
      exit
    }
  ' .env
}
port="$(read_value SPICEDB_GRPC_PORT)"
port="${port:-50051}"
if [[ -n "${AUTHZED_ENDPOINT:-}" || -n "${SPICEDB_GRPC_PORT:-}" || "$(read_value AUTHZED_ENDPOINT)" != "localhost:${port}" ]]; then
  printf '%s\n' 'Automatic SpiceDB preparation requires the bundled endpoint in .env and no shell endpoint/port overrides. For an external instance, use explicit authzed:upgrade commands.' >&2
  exit 1
fi

docker compose --env-file .env -f docker-compose.dev.yml up -d --wait --wait-timeout 180 spicedb
pnpm db:migrate:dev
pnpm authzed:upgrade prepare
pnpm authzed:upgrade check
