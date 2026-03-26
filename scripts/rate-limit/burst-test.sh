#!/usr/bin/env bash

set -euo pipefail

SCENARIO="${1:-}"
HOST="${HOST:-https://staging.app.formbricks.com}"
ENVIRONMENT_ID="${ENVIRONMENT_ID:-}"
API_KEY="${API_KEY:-}"
COUNT="${COUNT:-20}"
CONCURRENCY="${CONCURRENCY:-1}"
SLEEP_SECONDS="${SLEEP_SECONDS:-0}"
RESPONSE_ID="${RESPONSE_ID:-envoy-poc-response}"
WEBHOOK_ID="${WEBHOOK_ID:-envoy-poc-webhook}"
FILE_KEY="${FILE_KEY:-envoy-poc-file.txt}"

if [[ -z "$SCENARIO" ]]; then
  echo "usage: scripts/rate-limit/burst-test.sh <scenario>" >&2
  exit 1
fi

require_env_id() {
  if [[ -z "$ENVIRONMENT_ID" ]]; then
    echo "ENVIRONMENT_ID is required for scenario '$SCENARIO'" >&2
    exit 1
  fi
}

require_api_key() {
  if [[ -z "$API_KEY" ]]; then
    echo "API_KEY is required for scenario '$SCENARIO'" >&2
    exit 1
  fi
}

METHOD="GET"
URL=""
BODY=""
CONTENT_TYPE=""
EXTRA_HEADERS=()

case "$SCENARIO" in
  login)
    METHOD="POST"
    URL="$HOST/api/auth/callback/credentials"
    BODY="email=rate-limit%40example.com&password=wrong-password"
    CONTENT_TYPE="application/x-www-form-urlencoded"
    ;;
  verify-token)
    METHOD="POST"
    URL="$HOST/api/auth/callback/token"
    BODY="token=invalid-token"
    CONTENT_TYPE="application/x-www-form-urlencoded"
    ;;
  v1-client-environment)
    require_env_id
    URL="$HOST/api/v1/client/$ENVIRONMENT_ID/environment"
    ;;
  v1-client-storage)
    require_env_id
    METHOD="POST"
    URL="$HOST/api/v1/client/$ENVIRONMENT_ID/storage"
    BODY='{}'
    CONTENT_TYPE="application/json"
    ;;
  v2-responses-post)
    require_env_id
    METHOD="POST"
    URL="$HOST/api/v2/client/$ENVIRONMENT_ID/responses"
    BODY='{}'
    CONTENT_TYPE="application/json"
    ;;
  v2-responses-put)
    require_env_id
    METHOD="PUT"
    URL="$HOST/api/v2/client/$ENVIRONMENT_ID/responses/$RESPONSE_ID"
    BODY='{}'
    CONTENT_TYPE="application/json"
    ;;
  v2-displays-post)
    require_env_id
    METHOD="POST"
    URL="$HOST/api/v2/client/$ENVIRONMENT_ID/displays"
    BODY='{}'
    CONTENT_TYPE="application/json"
    ;;
  v2-client-storage)
    require_env_id
    METHOD="POST"
    URL="$HOST/api/v2/client/$ENVIRONMENT_ID/storage"
    BODY='{}'
    CONTENT_TYPE="application/json"
    ;;
  management-api-key)
    require_api_key
    URL="$HOST/api/v1/management/me"
    EXTRA_HEADERS+=("x-api-key: $API_KEY")
    ;;
  management-storage-api-key)
    require_api_key
    METHOD="POST"
    URL="$HOST/api/v1/management/storage"
    BODY='{}'
    CONTENT_TYPE="application/json"
    EXTRA_HEADERS+=("x-api-key: $API_KEY")
    ;;
  webhooks-api-key)
    require_api_key
    URL="$HOST/api/v1/webhooks/$WEBHOOK_ID"
    EXTRA_HEADERS+=("x-api-key: $API_KEY")
    ;;
  storage-delete-api-key)
    require_env_id
    require_api_key
    METHOD="DELETE"
    URL="$HOST/storage/$ENVIRONMENT_ID/public/$FILE_KEY"
    EXTRA_HEADERS+=("x-api-key: $API_KEY")
    ;;
  *)
    echo "unknown scenario: $SCENARIO" >&2
    exit 1
    ;;
esac

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

run_request() {
  local i="$1"
  local header_file
  local body_file
  local status_code
  local source
  local header_summary
  local has_gateway_headers="false"
  header_file="$TMP_DIR/$i.headers"
  body_file="$TMP_DIR/$i.body"

  curl_args=(
    -sS
    -D "$header_file"
    -o "$body_file"
    -X "$METHOD"
  )

  if [[ -n "$CONTENT_TYPE" ]]; then
    curl_args+=(-H "content-type: $CONTENT_TYPE")
  fi

  # Bash 3.x + `set -u` treats empty arrays as unset during expansion, so guard the loop.
  if [[ ${#EXTRA_HEADERS[@]:-0} -gt 0 ]]; then
    for header in "${EXTRA_HEADERS[@]}"; do
      curl_args+=(-H "$header")
    done
  fi

  if [[ -n "$BODY" ]]; then
    curl_args+=(--data "$BODY")
  fi

  status_code="$(curl "${curl_args[@]}" -w '%{http_code}' "$URL")"

  source="unknown"
  if rg -q '"code":"too_many_requests"' "$body_file"; then
    source="app"
  else
    if rg -qi '^(x-envoy-ratelimited|x-ratelimit-limit|x-ratelimit-remaining|x-ratelimit-reset):' "$header_file"; then
      has_gateway_headers="true"
    fi

    if [[ "$has_gateway_headers" == "true" ]]; then
      source="gateway"
    elif [[ "$status_code" == "429" && ! -s "$body_file" ]]; then
      source="gateway"
    fi
  fi

  printf '%03d scenario=%s status=%s source=%s\n' "$i" "$SCENARIO" "$status_code" "$source"

  if [[ "$status_code" == "429" ]]; then
    header_summary="$(
      {
        tr -d '\r' < "$header_file" |
          rg -i '^(x-envoy-ratelimited|x-ratelimit-limit|x-ratelimit-remaining|x-ratelimit-reset|content-type|retry-after):' |
          paste -sd '; ' -
      } || true
    )"
    printf '  headers: %s\n' "${header_summary:-<none>}"
  fi

  if [[ "$SLEEP_SECONDS" != "0" ]]; then
    sleep "$SLEEP_SECONDS"
  fi
}

if (( CONCURRENCY <= 1 )); then
  for i in $(seq 1 "$COUNT"); do
    run_request "$i"
  done
else
  pids=()

  for i in $(seq 1 "$COUNT"); do
    run_request "$i" &
    pids+=("$!")

    if (( ${#pids[@]} >= CONCURRENCY )); then
      wait "${pids[0]}"
      pids=("${pids[@]:1}")
    fi
  done

  for pid in "${pids[@]}"; do
    wait "$pid"
  done
fi
