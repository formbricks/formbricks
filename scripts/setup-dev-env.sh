#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly ENV_TEMPLATE_PATH="${FORMBRICKS_ENV_TEMPLATE_PATH:-${REPO_ROOT}/.env.example}"
readonly ENV_PATH="${FORMBRICKS_ENV_PATH:-${REPO_ROOT}/.env}"
readonly BASE_REQUIRED_GENERATED_KEYS=(
  "ENCRYPTION_KEY"
  "NEXTAUTH_SECRET"
  "CRON_SECRET"
  "CUBEJS_API_SECRET"
)
readonly BUNDLED_AUTHZED_GENERATED_KEYS=(
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

url_encode() {
  local LC_ALL=C
  local value="$1"
  local encoded=""
  local char
  local byte
  local i

  for ((i = 0; i < ${#value}; i++)); do
    char=${value:i:1}
    case "$char" in
      [a-zA-Z0-9.~_-]) encoded+="$char" ;;
      *)
        printf -v byte '%d' "'$char"
        printf -v encoded '%s%%%02X' "$encoded" "$((byte & 255))"
        ;;
    esac
  done

  printf '%s' "$encoded"
}

resolve_dev_authzed_mode() {
  local configured_mode="${FORMBRICKS_DEV_AUTHZED_MODE:-}"

  if [[ -z "${configured_mode}" ]]; then
    configured_mode="$(read_env_value "FORMBRICKS_DEV_AUTHZED_MODE")"
  fi

  configured_mode="${configured_mode:-bundled}"
  case "${configured_mode}" in
    bundled | external)
      printf '%s\n' "${configured_mode}"
      ;;
    *)
      fail "FORMBRICKS_DEV_AUTHZED_MODE must be either bundled or external."
      ;;
  esac
}

generate_missing_secrets() {
  local key=""
  local current_value=""

  for key in "$@"; do
    current_value="$(read_env_value "${key}")"

    if should_generate_secret "${key}" "${current_value}"; then
      upsert_env_value "${key}" "$(openssl rand -hex 32)"
      UPDATED_KEYS+=("${key}")
    fi
  done
}

validate_enabled_authzed() {
  local enabled="$(read_env_value "AUTHZED_ENABLED")"

  case "${enabled}" in
    true | 1)
      ;;
    false | 0)
      fail "AUTHZED_ENABLED cannot be disabled while using a development AuthZed mode."
      ;;
    "")
      return 1
      ;;
    *)
      fail "AUTHZED_ENABLED must be true or 1 for local development."
      ;;
  esac
}

configure_bundled_authzed() {
  local spicedb_port="${SPICEDB_GRPC_PORT:-}"
  local authzed_database_password

  if ! validate_enabled_authzed; then
    upsert_env_value "AUTHZED_ENABLED" "true"
  fi

  if [[ -z "${spicedb_port}" ]]; then
    spicedb_port="$(read_env_value "SPICEDB_GRPC_PORT")"
  fi
  spicedb_port="${spicedb_port:-50051}"

  if [[ ! "${spicedb_port}" =~ ^[0-9]+$ ]]; then
    fail "SPICEDB_GRPC_PORT must be an integer from 1 through 65535."
  fi
  if ((10#${spicedb_port} < 1 || 10#${spicedb_port} > 65535)); then
    fail "SPICEDB_GRPC_PORT must be an integer from 1 through 65535."
  fi

  generate_missing_secrets "${BUNDLED_AUTHZED_GENERATED_KEYS[@]}"
  authzed_database_password="$(read_env_value "AUTHZED_DATABASE_PASSWORD")"
  upsert_env_value "AUTHZED_DATABASE_PASSWORD_URL_ENCODED" "$(url_encode "${authzed_database_password}")"
  upsert_env_value "AUTHZED_ENDPOINT" "localhost:${spicedb_port}"
  upsert_env_value "AUTHZED_SYSTEM_KEY" "formbricks"
  upsert_env_value "AUTHZED_INSECURE" "true"
  upsert_env_value "AUTHZED_CONSISTENCY" "fully_consistent"
}

validate_external_authzed() {
  local key=""
  local value=""
  local insecure=""

  validate_enabled_authzed || fail "AUTHZED_ENABLED must be true for external AuthZed development."

  for key in AUTHZED_ENDPOINT AUTHZED_TOKEN AUTHZED_SYSTEM_KEY; do
    value="$(read_env_value "${key}")"
    if [[ -z "${value}" ]]; then
      fail "${key} is required when FORMBRICKS_DEV_AUTHZED_MODE=external."
    fi
  done

  insecure="$(read_env_value "AUTHZED_INSECURE")"
  case "${insecure}" in
    "" | true | false | 1 | 0)
      ;;
    *)
      fail "AUTHZED_INSECURE must be true, false, 1, or 0."
      ;;
  esac

  if [[ "$(read_env_value "AUTHZED_CONSISTENCY")" != "fully_consistent" ]]; then
    fail "AUTHZED_CONSISTENCY must be fully_consistent for external AuthZed development."
  fi
}

main() {
  local env_created="false"
  local authzed_mode=""

  UPDATED_KEYS=()

  ensure_prerequisites
  ensure_env_template_exists

  if copy_env_template_if_missing; then
    env_created="true"
  fi

  authzed_mode="$(resolve_dev_authzed_mode)"
  upsert_env_value "FORMBRICKS_DEV_AUTHZED_MODE" "${authzed_mode}"

  generate_missing_secrets "${BASE_REQUIRED_GENERATED_KEYS[@]}"
  if [[ "${authzed_mode}" == "bundled" ]]; then
    configure_bundled_authzed
  else
    validate_external_authzed
  fi

  if [[ "${env_created}" == "true" ]]; then
    log "Created .env from .env.example."
  else
    log "Using existing .env."
  fi

  if [[ ${#UPDATED_KEYS[@]} -gt 0 ]]; then
    log "Updated generated secrets: ${UPDATED_KEYS[*]}."
  else
    log ".env already contains all required generated secrets."
  fi

  log "AuthZed development mode: ${authzed_mode}."
  log "Development environment file is ready."
}

main "$@"
