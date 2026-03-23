#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly ENV_TEMPLATE_PATH="${REPO_ROOT}/.env.example"
readonly ENV_PATH="${REPO_ROOT}/.env"
readonly REQUIRED_GENERATED_KEYS=("ENCRYPTION_KEY" "NEXTAUTH_SECRET" "CRON_SECRET")

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
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    fail "Required command not found: ${command_name}"
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

  awk -v key="${key}" '
    function ltrim(value) {
      sub(/^[[:space:]]+/, "", value)
      return value
    }

    function rtrim(value) {
      sub(/[[:space:]]+$/, "", value)
      return value
    }

    function trim(value) {
      return rtrim(ltrim(value))
    }

    function parse_value(raw_value,    position, character, normalized_value, trimmed_value, in_single_quotes, in_double_quotes, first_character, last_character) {
      raw_value = ltrim(raw_value)
      normalized_value = ""
      in_single_quotes = 0
      in_double_quotes = 0

      for (position = 1; position <= length(raw_value); position++) {
        character = substr(raw_value, position, 1)

        if (character == "'"'"'" && !in_double_quotes) {
          in_single_quotes = !in_single_quotes
        } else if (character == "\"" && !in_single_quotes) {
          in_double_quotes = !in_double_quotes
        } else if (character == "#" && !in_single_quotes && !in_double_quotes) {
          break
        }

        normalized_value = normalized_value character
      }

      trimmed_value = trim(normalized_value)

      if (length(trimmed_value) >= 2) {
        first_character = substr(trimmed_value, 1, 1)
        last_character = substr(trimmed_value, length(trimmed_value), 1)

        if ((first_character == "\"" && last_character == "\"") || (first_character == "'"'"'" && last_character == "'"'"'")) {
          return substr(trimmed_value, 2, length(trimmed_value) - 2)
        }
      }

      return trimmed_value
    }

    /^[[:space:]]*#/ {
      next
    }

    {
      line = $0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)

      separator_index = index(line, "=")

      if (!separator_index) {
        next
      }

      current_key = trim(substr(line, 1, separator_index - 1))

      if (current_key == key) {
        raw_value = substr(line, separator_index + 1)
        print parse_value(raw_value)
        exit
      }
    }
  ' "${ENV_PATH}"
}

is_valid_encryption_key() {
  local value="${1-}"

  if [[ -z "${value}" ]]; then
    return 1
  fi

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

generate_secret() {
  openssl rand -hex 32
}

upsert_env_value() {
  local key="$1"
  local value="$2"

  TEMP_FILE="$(mktemp "${ENV_PATH}.tmp.XXXXXX")"

  awk -v key="${key}" -v value="${value}" '
    BEGIN {
      replaced = 0
    }

    {
      if ($0 ~ "^[[:space:]]*(export[[:space:]]+)?" key "[[:space:]]*=") {
        print key "=" value
        replaced = 1
      } else {
        print $0
      }
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
  local generated_value=""

  ensure_prerequisites
  ensure_env_template_exists

  if copy_env_template_if_missing; then
    env_created="true"
  fi

  for key in "${REQUIRED_GENERATED_KEYS[@]}"; do
    current_value="$(read_env_value "${key}")"

    if should_generate_secret "${key}" "${current_value}"; then
      generated_value="$(generate_secret)"
      upsert_env_value "${key}" "${generated_value}"
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
