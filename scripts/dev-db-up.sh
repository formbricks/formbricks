#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly ENV_PATH="${FORMBRICKS_ENV_PATH:-${REPO_ROOT}/.env}"
readonly DEV_COMPOSE_FILE="${FORMBRICKS_DEV_COMPOSE_FILE:-${REPO_ROOT}/docker-compose.dev.yml}"

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

read_env_value() {
  local key="$1"

  awk -F= -v key="${key}" '
    $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      value = substr($0, index($0, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)

      if ((value ~ /^".*"$/) || (value ~ /^'\''.*'\''$/)) {
        value = substr(value, 2, length(value) - 2)
      }

      print value
      exit
    }
  ' "${ENV_PATH}"
}

resolve_dev_authzed_mode() {
  local configured_mode="${FORMBRICKS_DEV_AUTHZED_MODE:-}"

  if [[ -z "${configured_mode}" ]]; then
    configured_mode="$(read_env_value "FORMBRICKS_DEV_AUTHZED_MODE")"
  fi

  case "${configured_mode}" in
    bundled | external)
      printf '%s\n' "${configured_mode}"
      ;;
    *)
      fail "FORMBRICKS_DEV_AUTHZED_MODE must be either bundled or external."
      ;;
  esac
}

configure_compose_profiles() {
  local authzed_mode="$1"
  local configured_profiles="${COMPOSE_PROFILES:-}"
  local profile=""
  local normalized_profiles=""

  if [[ -z "${configured_profiles}" ]]; then
    configured_profiles="$(read_env_value "COMPOSE_PROFILES")"
  fi

  IFS=',' read -r -a profiles <<<"${configured_profiles}"
  for profile in "${profiles[@]}"; do
    profile="${profile#"${profile%%[![:space:]]*}"}"
    profile="${profile%"${profile##*[![:space:]]}"}"

    if [[ -z "${profile}" || "${profile}" == "authzed-bundled" ]]; then
      continue
    fi

    if [[ ",${normalized_profiles}," != *",${profile},"* ]]; then
      normalized_profiles="${normalized_profiles:+${normalized_profiles},}${profile}"
    fi
  done

  if [[ "${authzed_mode}" == "bundled" ]]; then
    normalized_profiles="${normalized_profiles:+${normalized_profiles},}authzed-bundled"
  fi

  export COMPOSE_PROFILES="${normalized_profiles}"
}

main() {
  local authzed_mode=""

  bash "${SCRIPT_DIR}/setup-dev-env.sh"
  [[ -f "${ENV_PATH}" ]] || fail "Development environment file was not created at ${ENV_PATH}."

  authzed_mode="$(resolve_dev_authzed_mode)"
  configure_compose_profiles "${authzed_mode}"

  docker compose \
    --env-file "${ENV_PATH}" \
    --file "${DEV_COMPOSE_FILE}" \
    --project-directory "${REPO_ROOT}" \
    up --detach

  # A development database is application-ready only after both the source schema and the durable
  # AuthZed activation receipt exist. Keep these steps outside Compose so external AuthZed mode uses
  # the exact same release-matched application code and no local service has to mount node_modules.
  (
    cd "${REPO_ROOT}"
    pnpm db:migrate:dev
    pnpm authzed:activation:bootstrap
  )
}

main "$@"
