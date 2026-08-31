#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMPOSE_FILE="${REPO_ROOT}/docker-compose.dev.yml"
readonly PROJECT_NAME="formbricks-authzed-smoke-${$}"
readonly AUTHZED_TOKEN="0000000000000000000000000000000000000000000000000000000000000001"
readonly AUTHZED_DATABASE_PASSWORD="0000000000000000000000000000000000000000000000000000000000000002"
readonly WRONG_AUTHZED_TOKEN="0000000000000000000000000000000000000000000000000000000000000003"
readonly SCHEMA_LOG_SENTINEL="Canonical Formbricks authorization schema."
readonly RELATIONSHIP_USER_SENTINEL="application-graph-alice"
readonly RELATIONSHIP_API_KEY_SENTINEL="application-api-key-writer"
readonly RELATIONSHIP_RESOURCE_SENTINEL="application-graph-smoke"
readonly RELATIONSHIP_FEEDBACK_SENTINEL="application-feedback-directory"
SMOKE_TEMP_DIR="$(mktemp -d)" || exit 1
readonly SMOKE_TEMP_DIR
readonly DRIFT_SCHEMA_FILE="${SMOKE_TEMP_DIR}/schema-with-drift.zed"

compose() {
  docker compose --project-name "${PROJECT_NAME}" --file "${COMPOSE_FILE}" "$@"
}

wait_for_spicedb() {
  for _ in $(seq 1 30); do
    if [[ "$(compose ps --format json spicedb | tr -d '\n')" == *'"Health":"healthy"'* ]]; then
      return 0
    fi
    sleep 2
  done

  printf '%s\n' "SpiceDB did not become healthy." >&2
  return 1
}

refresh_spicedb_port() {
  spicedb_binding="$(compose port spicedb 50051)"
  spicedb_port="${spicedb_binding##*:}"
}

authzed_health() {
  local token="$1"

  authzed_cli "${token}" ./scripts/authzed-health.ts
}

authzed_schema() {
  local token="$1"
  shift

  authzed_cli "${token}" ./scripts/authzed-schema.ts "$@"
}

authzed_relationships() {
  local token="$1"
  shift

  authzed_cli "${token}" ./scripts/authzed-relationships-smoke.ts "$@"
}

authzed_backfill() {
  local token="$1"
  shift

  authzed_cli "${token}" ./scripts/authzed-backfill-smoke.ts "$@"
}

authzed_cli() {
  local token="$1"
  local script="$2"
  shift 2

  env \
    AUTHZED_CONSISTENCY="${AUTHZED_SMOKE_CONSISTENCY:-minimize_latency}" \
    AUTHZED_ENABLED=true \
    AUTHZED_ENDPOINT="localhost:${spicedb_port}" \
    AUTHZED_INSECURE=true \
    AUTHZED_MINIMUM_SNAPSHOT="${AUTHZED_SMOKE_MINIMUM_SNAPSHOT:-}" \
    AUTHZED_SYSTEM_KEY=formbricks \
    AUTHZED_TOKEN="${token}" \
    CUBEJS_API_SECRET=authzed-smoke-cube-secret \
    CUBEJS_API_URL=https://cube.formbricks.local \
    DATABASE_URL=https://database.formbricks.local/formbricks \
    ENCRYPTION_KEY=authzed-smoke-encryption-key \
    HUB_API_KEY=authzed-smoke-hub-key \
    HUB_API_URL=https://hub.formbricks.local \
    LOG_LEVEL=fatal \
    NODE_ENV="${AUTHZED_SMOKE_NODE_ENV:-test}" \
    NODE_OPTIONS=--conditions=react-server \
    pnpm --dir "${REPO_ROOT}/apps/web" exec tsx "${script}" "$@"
}

assert_health_result() {
  local output="$1"
  local expected_status="$2"
  local expected_code="${3:-}"

  if [[ -n "${expected_code}" ]]; then
    if jq --exit-status \
      --arg status "${expected_status}" \
      --arg code "${expected_code}" \
      '.status == $status and .code == $code and (.latencyMs | type == "number")' \
      <<<"${output}" >/dev/null; then
      return
    fi
  elif jq --exit-status \
    --arg status "${expected_status}" \
    '.status == $status and (.latencyMs | type == "number")' \
    <<<"${output}" >/dev/null; then
    return
  fi

  printf '%s\n' "Application health CLI returned an invalid or unexpected result:" >&2
  printf '%s\n' "${output}" | sanitize_logs >&2
  return 1
}

assert_lookup_result() {
  local output="$1"
  local expected_count="$2"

  if jq --exit-status \
    --argjson expected_count "${expected_count}" \
    '.status == "looked_up" and .resourceCount == $expected_count' \
    <<<"${output}" >/dev/null; then
    return
  fi

  printf '%s\n' "Application workspace lookup returned an unexpected result:" >&2
  printf '%s\n' "${output}" | sanitize_logs >&2
  return 1
}

sanitize_logs() {
  sed \
    -e "s/${AUTHZED_TOKEN}/[REDACTED_AUTHZED_TOKEN]/g" \
    -e "s/${WRONG_AUTHZED_TOKEN}/[REDACTED_WRONG_AUTHZED_TOKEN]/g" \
    -e "s/${AUTHZED_DATABASE_PASSWORD}/[REDACTED_AUTHZED_DATABASE_PASSWORD]/g"
}

cleanup() {
  local exit_code=$?

  if [[ ${exit_code} -ne 0 ]]; then
    compose ps --all || true
    compose logs --no-color postgres authzed-db-bootstrap spicedb-migrate spicedb 2>&1 | sanitize_logs || true
  fi

  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "${SMOKE_TEMP_DIR}"
  exit "${exit_code}"
}

on_error() {
  local line_number="$1"

  printf '%s\n' "AuthZed smoke assertion failed at line ${line_number}." >&2
}

trap 'on_error "${LINENO}"' ERR
trap cleanup EXIT

export AUTHZED_DATABASE_PASSWORD
export AUTHZED_TOKEN
export POSTGRES_PORT=0
export SPICEDB_GRPC_PORT=0

compose config --quiet
compose up --detach postgres
compose up authzed-db-bootstrap spicedb-migrate

# Prove both initialization stages are safe to repeat before starting the server.
compose run --rm authzed-db-bootstrap
compose run --rm spicedb-migrate

compose up --detach spicedb
wait_for_spicedb

refresh_spicedb_port

if ! empty_schema_health="$(authzed_health "${AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI failed before schema installation." >&2
  printf '%s\n' "${empty_schema_health}" | sanitize_logs >&2
  exit 1
fi
assert_health_result "${empty_schema_health}" "healthy"

if wrong_token_health="$(authzed_health "${WRONG_AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI unexpectedly accepted an incorrect token." >&2
  exit 1
fi
assert_health_result "${wrong_token_health}" "unhealthy" "authzed_permission_denied"
jq --exit-status '.retryable == false' <<<"${wrong_token_health}" >/dev/null

if empty_schema_check="$(authzed_schema "${AUTHZED_TOKEN}" check 2>&1)"; then
  printf '%s\n' "Schema check unexpectedly matched before schema installation." >&2
  exit 1
else
  empty_schema_check_exit_code=$?
fi
[[ "${empty_schema_check_exit_code}" -eq 2 ]]
jq --exit-status \
  '.status == "drifted" and .remoteState == "empty" and .remoteDigest == null and .differenceCount > 0' \
  <<<"${empty_schema_check}" >/dev/null

initial_apply="$(authzed_schema "${AUTHZED_TOKEN}" apply)"
jq --exit-status \
  '.status == "applied" and .remoteState == "present" and .differenceCount == 0 and (.sourceDigest | startswith("sha256:"))' \
  <<<"${initial_apply}" >/dev/null

matched_schema_check="$(authzed_schema "${AUTHZED_TOKEN}" check)"
jq --exit-status \
  '.status == "matched" and .differenceCount == 0 and (.remoteDigest | startswith("sha256:"))' \
  <<<"${matched_schema_check}" >/dev/null

unchanged_apply="$(authzed_schema "${AUTHZED_TOKEN}" apply)"
jq --exit-status '.status == "unchanged" and .differenceCount == 0' <<<"${unchanged_apply}" >/dev/null

zed() {
  compose run --rm --no-deps authzed-cli "$@" \
    --endpoint spicedb:50051 \
    --token "${AUTHZED_TOKEN}" \
    --insecure \
    --skip-version-check
}

cp "${REPO_ROOT}/authzed/schema.zed" "${DRIFT_SCHEMA_FILE}"
printf '\n/** Disposable smoke-test drift. */\ndefinition smoke_test_drift {}\n' >>"${DRIFT_SCHEMA_FILE}"
drift_schema_write="$(
  compose run --rm --no-deps --volume "${DRIFT_SCHEMA_FILE}:/drift-schema.zed:ro" authzed-cli \
    schema write /drift-schema.zed \
    --endpoint spicedb:50051 \
    --token "${AUTHZED_TOKEN}" \
    --insecure \
    --skip-version-check 2>&1
)"

if drifted_schema_check="$(authzed_schema "${AUTHZED_TOKEN}" check 2>&1)"; then
  printf '%s\n' "Schema check unexpectedly matched a deliberately drifted schema." >&2
  exit 1
else
  drifted_schema_check_exit_code=$?
fi
[[ "${drifted_schema_check_exit_code}" -eq 2 ]]
jq --exit-status \
  '.status == "drifted" and .remoteState == "present" and .differenceCount > 0 and (.remoteDigest | startswith("sha256:"))' \
  <<<"${drifted_schema_check}" >/dev/null
drifted_schema_digest="$(jq --raw-output '.remoteDigest' <<<"${drifted_schema_check}")"

restored_apply="$(
  authzed_schema "${AUTHZED_TOKEN}" apply --expected-current-digest "${drifted_schema_digest}"
)"
jq --exit-status '.status == "applied" and .differenceCount == 0' <<<"${restored_apply}" >/dev/null

if refused_relationship_driver="$(
  AUTHZED_SMOKE_NODE_ENV=production authzed_relationships "${AUTHZED_TOKEN}" set-owner 2>&1
)"; then
  printf '%s\n' "The application relationship smoke driver unexpectedly ran outside test mode." >&2
  exit 1
fi
jq --exit-status \
  '.status == "failed" and .code == "authzed_smoke_refused" and .retryable == false' \
  <<<"${refused_relationship_driver}" >/dev/null

owner_projection="$(authzed_relationships "${AUTHZED_TOKEN}" set-owner)"
jq --exit-status '.status == "projected"' <<<"${owner_projection}" >/dev/null
[[ "$(
  zed permission check organization:application-relationship-smoke write \
    user:application-relationship-smoke --consistency-full
)" == *"true"* ]]

billing_projection="$(authzed_relationships "${AUTHZED_TOKEN}" set-billing)"
jq --exit-status '.status == "projected"' <<<"${billing_projection}" >/dev/null
[[ "$(
  zed permission check organization:application-relationship-smoke manage_billing \
    user:application-relationship-smoke --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check organization:application-relationship-smoke write \
    user:application-relationship-smoke --consistency-full
)" == *"false"* ]]

idempotent_billing_projection="$(authzed_relationships "${AUTHZED_TOKEN}" set-billing)"
jq --exit-status '.status == "projected"' <<<"${idempotent_billing_projection}" >/dev/null

deleted_projection="$(authzed_relationships "${AUTHZED_TOKEN}" delete)"
idempotent_deleted_projection="$(authzed_relationships "${AUTHZED_TOKEN}" delete)"
jq --exit-status '.status == "projected"' <<<"${deleted_projection}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${idempotent_deleted_projection}" >/dev/null
[[ "$(
  zed permission check organization:application-relationship-smoke read \
    user:application-relationship-smoke --consistency-full
)" == *"false"* ]]

api_key_seed="$(authzed_relationships "${AUTHZED_TOKEN}" seed-api-key)"
jq --exit-status '.status == "projected"' <<<"${api_key_seed}" >/dev/null
api_key_workspace_lookup="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent \
    authzed_relationships "${AUTHZED_TOKEN}" lookup-api-key-workspaces
)"
assert_lookup_result "${api_key_workspace_lookup}" 2
api_key_allow_check="$( (AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-api-key-allow) )"
api_key_deny_check="$( (AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-api-key-deny) )"
jq --exit-status '.status == "checked" and .allowed == true' <<<"${api_key_allow_check}" >/dev/null
jq --exit-status '.status == "checked" and .allowed == false' <<<"${api_key_deny_check}" >/dev/null
if wrong_token_check="$( (AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${WRONG_AUTHZED_TOKEN}" check-api-key-allow) 2>&1)"; then
  printf '%s\n' "Application permission check unexpectedly accepted an incorrect token." >&2
  exit 1
fi
jq --exit-status \
  '.status == "failed" and .code == "authzed_permission_denied" and .retryable == false' \
  <<<"${wrong_token_check}" >/dev/null
[[ "$(
  zed permission check organization:application-api-key-organization read_access \
    api_key:application-api-key-reader --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check organization:application-api-key-organization manage_access \
    api_key:application-api-key-reader --consistency-full
)" == *"false"* ]]
[[ "$(
  zed permission check organization:application-api-key-organization manage_access \
    api_key:application-api-key-writer --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check organization:application-api-key-organization read_access \
    api_key:application-api-key-combined-access --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check organization:application-api-key-organization manage_access \
    api_key:application-api-key-combined-access --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary read \
    api_key:application-api-key-reader --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary write \
    api_key:application-api-key-reader --consistency-full
)" == *"false"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary write \
    api_key:application-api-key-writer --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary manage \
    api_key:application-api-key-writer --consistency-full
)" == *"false"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary manage \
    api_key:application-api-key-manager --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-api-key-secondary read \
    api_key:application-api-key-manager --consistency-full
)" == *"true"* ]]

downgraded_api_key="$(
  authzed_relationships "${AUTHZED_TOKEN}" downgrade-api-key-manager
)"
jq --exit-status '.status == "projected"' <<<"${downgraded_api_key}" >/dev/null
[[ "$(
  zed permission check workspace:application-api-key-primary manage \
    api_key:application-api-key-manager --consistency-full
)" == *"false"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary write \
    api_key:application-api-key-manager --consistency-full
)" == *"true"* ]]

removed_api_key_scope="$(
  authzed_relationships "${AUTHZED_TOKEN}" remove-api-key-scope
)"
jq --exit-status '.status == "projected"' <<<"${removed_api_key_scope}" >/dev/null
[[ "$(
  zed permission check workspace:application-api-key-secondary read \
    api_key:application-api-key-manager --consistency-full
)" == *"false"* ]]

deleted_api_key="$(authzed_relationships "${AUTHZED_TOKEN}" delete-api-key)"
idempotent_deleted_api_key="$(
  authzed_relationships "${AUTHZED_TOKEN}" delete-api-key
)"
jq --exit-status '.status == "projected"' <<<"${deleted_api_key}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${idempotent_deleted_api_key}" >/dev/null
[[ "$(
  zed permission check organization:application-api-key-organization read_access \
    api_key:application-api-key-writer --consistency-full
)" == *"false"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary read \
    api_key:application-api-key-writer --consistency-full
)" == *"false"* ]]

team_workspace_seed="$(authzed_relationships "${AUTHZED_TOKEN}" seed-team-workspace)"
jq --exit-status '.status == "projected"' <<<"${team_workspace_seed}" >/dev/null
user_workspace_lookup="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent \
    authzed_relationships "${AUTHZED_TOKEN}" lookup-user-workspaces
)"
empty_workspace_lookup="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent \
    authzed_relationships "${AUTHZED_TOKEN}" lookup-empty-workspaces
)"
assert_lookup_result "${user_workspace_lookup}" 2
assert_lookup_result "${empty_workspace_lookup}" 0
user_allow_check="$( (AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-user-allow) )"
user_deny_check="$( (AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-user-deny) )"
jq --exit-status '.status == "checked" and .allowed == true' <<<"${user_allow_check}" >/dev/null
jq --exit-status '.status == "checked" and .allowed == false' <<<"${user_deny_check}" >/dev/null
[[ "$(
  zed permission check workspace:application-graph-smoke manage \
    user:application-graph-alice --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-bob --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-graph-smoke manage \
    user:application-graph-bob --consistency-full
)" == *"false"* ]]

downgraded_manager_grant="$(
  authzed_relationships "${AUTHZED_TOKEN}" downgrade-manager-grant
)"
jq --exit-status '.status == "projected"' <<<"${downgraded_manager_grant}" >/dev/null
[[ "$(
  zed permission check workspace:application-graph-smoke manage \
    user:application-graph-alice --consistency-full
)" == *"false"* ]]
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-alice --consistency-full
)" == *"true"* ]]

removed_reader_grant="$(authzed_relationships "${AUTHZED_TOKEN}" remove-reader-grant)"
jq --exit-status '.status == "projected"' <<<"${removed_reader_grant}" >/dev/null
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-bob --consistency-full
)" == *"false"* ]]
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-alice --consistency-full
)" == *"true"* ]]

removed_alice_memberships="$(
  authzed_relationships "${AUTHZED_TOKEN}" remove-alice-memberships
)"
jq --exit-status '.status == "projected"' <<<"${removed_alice_memberships}" >/dev/null
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-alice --consistency-full
)" == *"false"* ]]

team_workspace_reseed="$(authzed_relationships "${AUTHZED_TOKEN}" seed-team-workspace)"
deleted_manager_team="$(authzed_relationships "${AUTHZED_TOKEN}" delete-manager-team)"
idempotent_deleted_manager_team="$(
  authzed_relationships "${AUTHZED_TOKEN}" delete-manager-team
)"
jq --exit-status '.status == "projected"' <<<"${team_workspace_reseed}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${deleted_manager_team}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${idempotent_deleted_manager_team}" >/dev/null
zed relationship create team:application-graph-manager admin user:application-graph-alice
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-alice --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-graph-smoke manage \
    user:application-graph-alice --consistency-full
)" == *"false"* ]]

team_workspace_reseed_for_delete="$(
  authzed_relationships "${AUTHZED_TOKEN}" seed-team-workspace
)"
deleted_graph_workspace="$(authzed_relationships "${AUTHZED_TOKEN}" delete-workspace)"
idempotent_deleted_graph_workspace="$(
  authzed_relationships "${AUTHZED_TOKEN}" delete-workspace
)"
jq --exit-status '.status == "projected"' <<<"${team_workspace_reseed_for_delete}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${deleted_graph_workspace}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${idempotent_deleted_graph_workspace}" >/dev/null
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-bob --consistency-full
)" == *"false"* ]]

feedback_seed="$(authzed_relationships "${AUTHZED_TOKEN}" seed-feedback-directory)"
jq --exit-status '.status == "projected"' <<<"${feedback_seed}" >/dev/null
feedback_initial="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-feedback
)"
jq --exit-status '
  .status == "checked" and
  .managerManage == true and
  .userRead == true and
  .userWrite == false and
  .userAssignmentARead == true and
  .userAssignmentBRead == false and
  .keyWrite == true and
  .keyAssignmentAWrite == false and
  .keyAssignmentBWrite == true
' <<<"${feedback_initial}" >/dev/null

feedback_downgrade="$(authzed_relationships "${AUTHZED_TOKEN}" downgrade-feedback-api-key)"
jq --exit-status '.status == "projected"' <<<"${feedback_downgrade}" >/dev/null
feedback_after_downgrade="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-feedback
)"
jq --exit-status '.keyWrite == false and .keyAssignmentBWrite == false' \
  <<<"${feedback_after_downgrade}" >/dev/null

feedback_remove_membership="$(
  authzed_relationships "${AUTHZED_TOKEN}" remove-feedback-user-membership
)"
jq --exit-status '.status == "projected"' <<<"${feedback_remove_membership}" >/dev/null
feedback_after_membership_removal="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-feedback
)"
jq --exit-status '.userRead == false and .userAssignmentARead == false' \
  <<<"${feedback_after_membership_removal}" >/dev/null

feedback_reseed_for_assignment_delete="$(
  authzed_relationships "${AUTHZED_TOKEN}" seed-feedback-directory
)"
feedback_delete_assignment="$(
  authzed_relationships "${AUTHZED_TOKEN}" delete-feedback-assignment-a
)"
jq --exit-status '.status == "projected"' <<<"${feedback_reseed_for_assignment_delete}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${feedback_delete_assignment}" >/dev/null
feedback_after_assignment_delete="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-feedback
)"
jq --exit-status '
  .userRead == false and
  .userAssignmentARead == false and
  .keyWrite == true and
  .keyAssignmentBWrite == true
' <<<"${feedback_after_assignment_delete}" >/dev/null

feedback_delete_directory="$(authzed_relationships "${AUTHZED_TOKEN}" delete-feedback-directory)"
feedback_delete_directory_idempotent="$(
  authzed_relationships "${AUTHZED_TOKEN}" delete-feedback-directory
)"
jq --exit-status '.status == "projected"' <<<"${feedback_delete_directory}" >/dev/null
jq --exit-status '.status == "projected"' <<<"${feedback_delete_directory_idempotent}" >/dev/null
feedback_after_directory_delete="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-feedback
)"
jq --exit-status '
  .managerManage == false and
  .userRead == false and
  .keyWrite == false and
  .userAssignmentARead == false and
  .keyAssignmentBWrite == false
' <<<"${feedback_after_directory_delete}" >/dev/null

persisted_team_workspace_seed="$(
  authzed_relationships "${AUTHZED_TOKEN}" seed-team-workspace
)"
jq --exit-status '.status == "projected"' <<<"${persisted_team_workspace_seed}" >/dev/null
persisted_api_key_seed="$(authzed_relationships "${AUTHZED_TOKEN}" seed-api-key)"
jq --exit-status '.status == "projected"' <<<"${persisted_api_key_seed}" >/dev/null
persisted_feedback_seed="$(authzed_relationships "${AUTHZED_TOKEN}" seed-feedback-directory)"
jq --exit-status '.status == "projected"' <<<"${persisted_feedback_seed}" >/dev/null

zed relationship create organization:smoke owner user:alice
zed relationship create workspace:smoke organization organization:smoke
zed relationship create survey:smoke workspace workspace:smoke

alice_result="$(zed permission check survey:smoke read user:alice --consistency-full)"
bob_result="$(zed permission check survey:smoke read user:bob --consistency-full)"

[[ "${alice_result}" == *"true"* ]]
[[ "${bob_result}" == *"false"* ]]

compose stop spicedb

if unavailable_health="$(authzed_health "${AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI unexpectedly succeeded while SpiceDB was stopped." >&2
  exit 1
fi
assert_health_result "${unavailable_health}" "unhealthy" "authzed_unavailable"
jq --exit-status '.latencyMs <= 4000' <<<"${unavailable_health}" >/dev/null

if unavailable_projection="$(authzed_relationships "${AUTHZED_TOKEN}" set-owner 2>&1)"; then
  printf '%s\n' "Application relationship projection unexpectedly succeeded while SpiceDB was stopped." >&2
  exit 1
fi
jq --exit-status \
  '.status == "failed" and .code == "authzed_unavailable" and .attempts == 3 and .retryable == true and .latencyMs <= 4000' \
  <<<"${unavailable_projection}" >/dev/null

if unavailable_permission_check="$( (AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-user-allow) 2>&1)"; then
  printf '%s\n' "Application permission check unexpectedly succeeded while SpiceDB was stopped." >&2
  exit 1
fi
jq --exit-status \
  '.status == "failed" and .code == "authzed_unavailable" and .attempts == 3 and .retryable == true and .latencyMs <= 4000' \
  <<<"${unavailable_permission_check}" >/dev/null

compose up --detach --force-recreate spicedb
wait_for_spicedb
refresh_spicedb_port

if ! restored_health="$(authzed_health "${AUTHZED_TOKEN}" 2>&1)"; then
  printf '%s\n' "Application health CLI did not recover after SpiceDB recreation." >&2
  exit 1
fi
assert_health_result "${restored_health}" "healthy"

restored_projection="$(authzed_relationships "${AUTHZED_TOKEN}" set-owner)"
jq --exit-status '.status == "projected"' <<<"${restored_projection}" >/dev/null
[[ "$(
  zed permission check organization:application-relationship-smoke write \
    user:application-relationship-smoke --consistency-full
)" == *"true"* ]]

[[ "$(zed permission check survey:smoke read user:alice --consistency-full)" == *"true"* ]]
[[ "$(zed permission check survey:smoke read user:bob --consistency-full)" == *"false"* ]]
[[ "$(
  zed permission check workspace:application-graph-smoke manage \
    user:application-graph-alice --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-graph-smoke read \
    user:application-graph-bob --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check organization:application-api-key-organization manage_access \
    api_key:application-api-key-writer --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check organization:application-api-key-organization manage_access \
    api_key:application-api-key-combined-access --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-api-key-primary manage \
    api_key:application-api-key-manager --consistency-full
)" == *"true"* ]]
[[ "$(
  zed permission check workspace:application-api-key-secondary read \
    api_key:application-api-key-manager --consistency-full
)" == *"true"* ]]
restored_feedback="$(
  AUTHZED_SMOKE_CONSISTENCY=fully_consistent authzed_relationships "${AUTHZED_TOKEN}" check-feedback
)"
jq --exit-status '
  .managerManage == true and
  .userRead == true and
  .userAssignmentARead == true and
  .userAssignmentBRead == false and
  .keyWrite == true and
  .keyAssignmentAWrite == false and
  .keyAssignmentBWrite == true
' <<<"${restored_feedback}" >/dev/null

persisted_schema_check="$(authzed_schema "${AUTHZED_TOKEN}" check)"
jq --exit-status '.status == "matched" and .differenceCount == 0' <<<"${persisted_schema_check}" >/dev/null

# Backfill and repair. Seeds more relationships than one read page holds, so the drainer has to page
# and hold a single revision across pages — behaviour only a real engine can confirm.
# Subshell: an assignment prefixing a *function* call persists in the calling shell under `set -o
# posix`, which would leave every later driver invocation running as production and refusing to run.
refused_backfill_driver="$( (AUTHZED_SMOKE_NODE_ENV=production authzed_backfill "${AUTHZED_TOKEN}" report) || true)"
jq --exit-status '.status == "failed" and .code == "authzed_backfill_smoke_refused"' \
  <<<"${refused_backfill_driver}" >/dev/null

backfill_seed="$(authzed_backfill "${AUTHZED_TOKEN}" seed 300)"
jq --exit-status '.status == "seeded" and .seeded == 300' <<<"${backfill_seed}" >/dev/null

backfill_observation="$(authzed_backfill "${AUTHZED_TOKEN}" observe)"
# The non-zero count matters as much as the paging: an accidentally empty observation would let every
# assertion below pass while proving nothing.
jq --exit-status '.status == "observed" and .relationshipCount >= 300 and .snapshotPinned == true' \
  <<<"${backfill_observation}" >/dev/null

backfill_report="$(authzed_backfill "${AUTHZED_TOKEN}" report)"
jq --exit-status '.status == "drifted" and .orphaned >= 300 and .pruned == 0 and .handedOverCount == 0' \
  <<<"${backfill_report}" >/dev/null

# The cap exists because a large orphan count is a symptom rather than a big cleanup job. Exceeding it
# must hand over nothing at all, not prune an arbitrary prefix.
backfill_capped="$(authzed_backfill "${AUTHZED_TOKEN}" prune-capped)"
jq --exit-status '.pruned == 0 and .skipped == 1 and .handedOverCount == 0' <<<"${backfill_capped}" >/dev/null

# The cap has to be decided against the whole sweep, not per page. 280 is above one 250-relationship
# page and below the seeded total, so a per-page check would delete the first page and halt on the
# second — revoking a cap's worth of live access on a run aimed at the wrong database, where the guard
# exists to revoke none. This is the multi-page case; the assertion above only exceeds the cap on page
# one, so it cannot distinguish the two.
backfill_page_capped="$(authzed_backfill "${AUTHZED_TOKEN}" prune-page-capped)"
jq --exit-status '.pruned == 0 and .skipped == 1 and .handedOverCount == 0 and .orphaned >= 300' \
  <<<"${backfill_page_capped}" >/dev/null

backfill_prune="$(authzed_backfill "${AUTHZED_TOKEN}" prune)"
jq --exit-status \
  '.status == "reconciled" and .pruned >= 300 and .handedOverCount > 0 and .truncated == false and (.completedAtSnapshot | type == "string")' \
  <<<"${backfill_prune}" >/dev/null
completed_at_snapshot="$(jq --raw-output '.completedAtSnapshot' <<<"${backfill_prune}")"
snapshot_floor_check="$( (AUTHZED_SMOKE_CONSISTENCY=minimize_latency AUTHZED_SMOKE_MINIMUM_SNAPSHOT="${completed_at_snapshot}" authzed_relationships "${AUTHZED_TOKEN}" check-user-allow) )"
jq --exit-status '.status == "checked" and .allowed == true' <<<"${snapshot_floor_check}" >/dev/null

backfill_cleanup="$(authzed_backfill "${AUTHZED_TOKEN}" cleanup)"
jq --exit-status '.status == "cleaned"' <<<"${backfill_cleanup}" >/dev/null

# The store also holds the fixtures the projection assertions above created, so the absolute orphan
# count is not zero here. Asserting the delta is the stronger claim anyway: exactly the 300 seeded
# relationships disappeared and nothing else was touched.
backfill_orphans_before_cleanup="$(jq -r '.orphaned' <<<"${backfill_prune}")"
backfill_after_cleanup="$(authzed_backfill "${AUTHZED_TOKEN}" report)"
jq --exit-status --argjson before "${backfill_orphans_before_cleanup}" \
  '.status == "drifted" and .orphaned == ($before - 300)' <<<"${backfill_after_cleanup}" >/dev/null

# Idempotency, byte for byte: a second pass over unchanged state reports exactly the same thing rather
# than doing a fresh round of work.
backfill_repeated="$(authzed_backfill "${AUTHZED_TOKEN}" report)"
[[ "${backfill_repeated}" == "${backfill_after_cleanup}" ]]

service_logs="$(compose logs --no-color postgres authzed-db-bootstrap spicedb-migrate spicedb)"
application_outputs="${empty_schema_health}${wrong_token_health}${empty_schema_check}${initial_apply}${matched_schema_check}${unchanged_apply}${drift_schema_write}${drifted_schema_check}${restored_apply}${refused_relationship_driver}${owner_projection}${billing_projection}${idempotent_billing_projection}${deleted_projection}${idempotent_deleted_projection}${api_key_seed}${api_key_workspace_lookup}${api_key_allow_check}${api_key_deny_check}${wrong_token_check}${downgraded_api_key}${removed_api_key_scope}${deleted_api_key}${idempotent_deleted_api_key}${team_workspace_seed}${user_workspace_lookup}${empty_workspace_lookup}${user_allow_check}${user_deny_check}${downgraded_manager_grant}${removed_reader_grant}${removed_alice_memberships}${team_workspace_reseed}${deleted_manager_team}${idempotent_deleted_manager_team}${team_workspace_reseed_for_delete}${deleted_graph_workspace}${idempotent_deleted_graph_workspace}${feedback_seed}${feedback_initial}${feedback_downgrade}${feedback_after_downgrade}${feedback_remove_membership}${feedback_after_membership_removal}${feedback_reseed_for_assignment_delete}${feedback_delete_assignment}${feedback_after_assignment_delete}${feedback_delete_directory}${feedback_delete_directory_idempotent}${feedback_after_directory_delete}${persisted_team_workspace_seed}${persisted_api_key_seed}${persisted_feedback_seed}${unavailable_health}${unavailable_projection}${unavailable_permission_check}${restored_health}${restored_projection}${restored_feedback}${persisted_schema_check}${refused_backfill_driver}${backfill_seed}${backfill_observation}${backfill_report}${backfill_capped}${backfill_page_capped}${backfill_prune}${snapshot_floor_check}${backfill_cleanup}${backfill_after_cleanup}${backfill_repeated}"
if [[ "${service_logs}${application_outputs}" == *"${AUTHZED_TOKEN}"* || \
  "${service_logs}${application_outputs}" == *"${WRONG_AUTHZED_TOKEN}"* || \
  "${service_logs}${application_outputs}" == *"${AUTHZED_DATABASE_PASSWORD}"* || \
  "${service_logs}${application_outputs}" == *"${SCHEMA_LOG_SENTINEL}"* || \
  "${service_logs}${application_outputs}" == *"${RELATIONSHIP_USER_SENTINEL}"* || \
  "${service_logs}${application_outputs}" == *"${RELATIONSHIP_API_KEY_SENTINEL}"* || \
  "${service_logs}${application_outputs}" == *"${RELATIONSHIP_RESOURCE_SENTINEL}"* || \
  "${service_logs}${application_outputs}" == *"${RELATIONSHIP_FEEDBACK_SENTINEL}"* ]]; then
  printf '%s\n' "AuthZed logs exposed a configured secret, schema, or relationship identifier." >&2
  exit 1
fi

printf '%s\n' "AuthZed smoke test passed: schema lifecycle, organization/team/workspace/API-key/feedback-dataset projection, exact assignment scoping, application user/API-key permission checks and workspace lookups, fully-consistent and snapshot-floor reads, permission ladders, grant and membership revocation, idempotent cascade cleanup, paginated relationship reads, backfill orphan detection and prune guards, health, authentication failure, bounded outage handling, migrations, and persistence were verified."
