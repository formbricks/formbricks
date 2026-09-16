#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly ENV_TEMPLATE_PATH="${FORMBRICKS_ENV_TEMPLATE_PATH:-${REPO_ROOT}/.env.example}"
readonly ENV_PATH="${FORMBRICKS_ENV_PATH:-${REPO_ROOT}/.env}"
source "${SCRIPT_DIR}/dev-env.sh"
readonly REQUIRED_GENERATED_KEYS=(
  "ENCRYPTION_KEY"
  "NEXTAUTH_SECRET"
  "CRON_SECRET"
  "CUBEJS_API_SECRET"
  "AUTHZED_TOKEN"
  "AUTHZED_DATABASE_PASSWORD"
)

TEMP_FILE=""

cleanup() {
  if [[ -n "${TEMP_FILE}" && -f "${TEMP_FILE}" ]]; then
    rm -f "${TEMP_FILE}"
  fi
}

trap cleanup EXIT

log() {
  printf '%s\n' "$1"
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

ensure_prerequisites() {
  require_command "awk"
  require_command "mktemp"
  require_command "openssl"
}

ensure_env_template_exists() {
  if [[ ! -f "${ENV_TEMPLATE_PATH}" ]]; then
    fail "Could not find template file at ${ENV_TEMPLATE_PATH}"
  fi
}

copy_env_template_if_missing() {
  if [[ -f "${ENV_PATH}" ]]; then
    return 1
  fi

  cp "${ENV_TEMPLATE_PATH}" "${ENV_PATH}"
  return 0
}

is_valid_encryption_key() {
  local value="${1-}"
  [[ ${#value} -eq 32 || "${value}" =~ ^[[:xdigit:]]{64}$ ]]
}

should_generate_secret() {
  local key="$1"
  local value="${2-}"

  if [[ -z "${value}" ]]; then
    return 0
  fi

  if [[ "${key}" == "ENCRYPTION_KEY" ]] && ! is_valid_encryption_key "${value}"; then
    return 0
  fi

  return 1
}

upsert_env_value() {
  local key="$1"
  local value="$2"

  TEMP_FILE="$(mktemp "${ENV_PATH}.tmp.XXXXXX")"

  awk -v key="${key}" -v value="${value}" '
    BEGIN {
      replaced = 0
    }

    $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      print key "=" value
      replaced = 1
      next
    }

    {
      print
    }

    END {
      if (!replaced) {
        print key "=" value
      }
    }
  ' "${ENV_PATH}" > "${TEMP_FILE}"

  mv "${TEMP_FILE}" "${ENV_PATH}"
  TEMP_FILE=""
}

main() {
  local env_created="false"
  local updated_keys=()
  local key=""
  local current_value=""
  local spicedb_port=""
  local bundled_endpoint=""

  ensure_prerequisites
  ensure_env_template_exists

  if copy_env_template_if_missing; then
    env_created="true"
  fi
  chmod 600 "${ENV_PATH}"
  spicedb_port="$(read_env_value SPICEDB_GRPC_PORT)"
  spicedb_port="${spicedb_port:-50051}"
  bundled_endpoint="localhost:${spicedb_port}"

  # Older .env files predate SpiceDB. Fill only absent defaults, never replace a
  # custom endpoint or credential. Explicitly disabled/weaker configurations must
  # be corrected by the developer before starting the v6 application.
  for key in AUTHZED_ENABLED AUTHZED_ENDPOINT AUTHZED_SYSTEM_KEY AUTHZED_INSECURE AUTHZED_CONSISTENCY; do
    if [[ -z "$(read_env_value "${key}")" ]]; then
      case "${key}" in
        AUTHZED_ENABLED) upsert_env_value "${key}" "true" ;;
        AUTHZED_INSECURE)
          if [[ "$(read_env_value AUTHZED_ENDPOINT)" == "${bundled_endpoint}" ]]; then
            upsert_env_value "${key}" "true"
          else
            upsert_env_value "${key}" "false"
          fi
          ;;
        AUTHZED_ENDPOINT) upsert_env_value "${key}" "${bundled_endpoint}" ;;
        AUTHZED_SYSTEM_KEY) upsert_env_value "${key}" "formbricks" ;;
        AUTHZED_CONSISTENCY) upsert_env_value "${key}" "fully_consistent" ;;
      esac
    fi
  done

  case "$(read_env_value AUTHZED_ENABLED)" in
    true | 1) ;;
    *) fail "v6 requires AUTHZED_ENABLED=true. Update .env and restart development." ;;
  esac
  if [[ "$(read_env_value AUTHZED_CONSISTENCY)" != "fully_consistent" ]]; then
    fail "v6 requires AUTHZED_CONSISTENCY=fully_consistent. Update .env and restart development."
  fi
  if [[ "$(read_env_value AUTHZED_ENDPOINT)" != "${bundled_endpoint}" && -z "$(read_env_value AUTHZED_TOKEN)" ]]; then
    fail "Custom AUTHZED_ENDPOINT requires its existing AUTHZED_TOKEN; no replacement token was generated."
  fi

  for key in "${REQUIRED_GENERATED_KEYS[@]}"; do
    current_value="$(read_env_value "${key}")"

    if should_generate_secret "${key}" "${current_value}"; then
      upsert_env_value "${key}" "$(openssl rand -hex 32)"
      updated_keys+=("${key}")
    fi
  done

  if [[ "${env_created}" == "true" ]]; then
    log "Created .env from .env.example."
  else
    log "Using existing .env."
  fi

  if [[ ${#updated_keys[@]} -gt 0 ]]; then
    log "Updated generated secrets: ${updated_keys[*]}."
  else
    log ".env already contains all required generated secrets."
  fi

  log "Development environment file is ready."
}

main "$@"
