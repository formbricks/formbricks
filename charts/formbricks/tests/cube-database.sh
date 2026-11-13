#!/usr/bin/env bash
# ENG-7044: Cube must reach the bundled PostgreSQL without extra values, and values the operator sets
# in cube.env must replace the chart's defaults rather than render a second env entry.
# postgresql-overrides.sh checks the defaults follow the PostgreSQL overrides; this checks precedence.

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMMON_ARGS=(--set formbricks.webappUrl=https://qa.example.com)
readonly DB_VARIABLES=(CUBEJS_DB_HOST CUBEJS_DB_PORT CUBEJS_DB_NAME CUBEJS_DB_USER CUBEJS_DB_PASS)

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

render_cube() {
  local name="$1"
  shift

  helm template "cube-${name}" "${CHART_DIR}" "${COMMON_ARGS[@]}" "$@" \
    --show-only templates/cube-deployment.yaml >"${temp_dir}/${name}.yaml"
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

env_count() {
  grep -c -E "^[[:space:]]*- name: $1$" "$2" || true
}

env_value() {
  awk -v target="$1" '
    $0 ~ "^[[:space:]]*-[[:space:]]+name:[[:space:]]+" target "$" {
      getline
      if ($1 == "value:") {
        gsub(/^"|"$/, "", $2)
        print $2
      }
      exit
    }
  ' "$2"
}

env_secret_ref() {
  awk -v target="$1" '
    $0 ~ "^[[:space:]]*-[[:space:]]+name:[[:space:]]+" target "$" { in_target = 1; next }
    in_target && $0 ~ "^[[:space:]]*-[[:space:]]+name:" { exit }
    in_target && $1 == "name:" { gsub(/"/, "", $2); name = $2 }
    in_target && $1 == "key:" { gsub(/"/, "", $2); key = $2 }
    in_target && name != "" && key != "" { print name "/" key; exit }
  ' "$2"
}

assert_no_duplicate_env() {
  local name="$1" duplicates
  duplicates="$(grep -E '^[[:space:]]*- name: [A-Z_]+$' "${temp_dir}/${name}.yaml" | awk '{ print $3 }' | sort | uniq -d)"
  [ -z "${duplicates}" ] || fail "${name}: Cube env names render more than once: ${duplicates}"
}

# 1. Bundled defaults: every connection variable once, the password by reference to the server's Secret.
render_cube default
assert_no_duplicate_env default
for variable in "${DB_VARIABLES[@]}"; do
  [ "$(env_count "${variable}" "${temp_dir}/default.yaml")" = 1 ] || fail "default: ${variable} must render once."
done
[ "$(env_value CUBEJS_DB_HOST "${temp_dir}/default.yaml")" = formbricks-postgresql ] ||
  fail "default: Cube must connect to the bundled PostgreSQL Service."
[ "$(env_value CUBEJS_DB_USER "${temp_dir}/default.yaml")" = formbricks ] ||
  fail "default: Cube must log in as the bundled PostgreSQL user."
[ "$(env_secret_ref CUBEJS_DB_PASS "${temp_dir}/default.yaml")" = formbricks-app-secrets/POSTGRES_USER_PASSWORD ] ||
  fail "default: CUBEJS_DB_PASS must reference formbricks-app-secrets/POSTGRES_USER_PASSWORD."
[ "$(grep -A1 -E '^[[:space:]]*- name: CUBEJS_DB_PASS$' "${temp_dir}/default.yaml" | tail -n 1 | awk '{ print $1 }')" = "valueFrom:" ] ||
  fail "default: CUBEJS_DB_PASS must be supplied by reference, never as a literal value."

# 2. A name set in cube.env replaces that default only.
render_cube database-override --set cube.env.CUBEJS_DB_NAME=analytics
assert_no_duplicate_env database-override
[ "$(env_value CUBEJS_DB_NAME "${temp_dir}/database-override.yaml")" = analytics ] ||
  fail "database-override: cube.env.CUBEJS_DB_NAME must win."
[ "$(env_value CUBEJS_DB_USER "${temp_dir}/database-override.yaml")" = formbricks ] ||
  fail "database-override: the bundled credentials must still render."

# 3. Credentials the operator chose replace both bundled credentials, so the bundled password is never
#    paired with another user.
render_cube credential-override \
  --set cube.env.CUBEJS_DB_USER=cube_reader \
  --set cube.env.CUBEJS_DB_PASS.valueFrom.secretKeyRef.name=cube-db \
  --set cube.env.CUBEJS_DB_PASS.valueFrom.secretKeyRef.key=password
assert_no_duplicate_env credential-override
[ "$(env_value CUBEJS_DB_USER "${temp_dir}/credential-override.yaml")" = cube_reader ] ||
  fail "credential-override: cube.env.CUBEJS_DB_USER must win."
[ "$(env_secret_ref CUBEJS_DB_PASS "${temp_dir}/credential-override.yaml")" = cube-db/password ] ||
  fail "credential-override: cube.env.CUBEJS_DB_PASS must win."
[ "$(env_value CUBEJS_DB_HOST "${temp_dir}/credential-override.yaml")" = formbricks-postgresql ] ||
  fail "credential-override: the bundled host must still render."

render_cube password-only-override \
  --set cube.env.CUBEJS_DB_PASS.valueFrom.secretKeyRef.name=cube-db \
  --set cube.env.CUBEJS_DB_PASS.valueFrom.secretKeyRef.key=password
[ "$(env_count CUBEJS_DB_USER "${temp_dir}/password-only-override.yaml")" = 0 ] ||
  fail "password-only-override: the bundled user must not be paired with another password."

render_cube user-only-override --set cube.env.CUBEJS_DB_USER=cube_reader
assert_no_duplicate_env user-only-override
[ "$(env_value CUBEJS_DB_USER "${temp_dir}/user-only-override.yaml")" = cube_reader ] ||
  fail "user-only-override: cube.env.CUBEJS_DB_USER must win."
[ "$(env_count CUBEJS_DB_PASS "${temp_dir}/user-only-override.yaml")" = 0 ] ||
  fail "user-only-override: the bundled password must not be paired with another user."

render_cube port-override --set-string cube.env.CUBEJS_DB_PORT=6543
assert_no_duplicate_env port-override
[ "$(env_value CUBEJS_DB_PORT "${temp_dir}/port-override.yaml")" = 6543 ] ||
  fail "port-override: cube.env.CUBEJS_DB_PORT must win."
[ "$(env_count CUBEJS_DB_PASS "${temp_dir}/port-override.yaml")" = 1 ] ||
  fail "port-override: the bundled credentials must still render."

# 4. Another host never receives the bundled credentials.
render_cube host-override --set cube.env.CUBEJS_DB_HOST=analytics-db.example.com
assert_no_duplicate_env host-override
[ "$(env_value CUBEJS_DB_HOST "${temp_dir}/host-override.yaml")" = analytics-db.example.com ] ||
  fail "host-override: cube.env.CUBEJS_DB_HOST must win."
[ "$(env_count CUBEJS_DB_PASS "${temp_dir}/host-override.yaml")" = 0 ] ||
  fail "host-override: the bundled password must not be sent to another host."
[ "$(env_count CUBEJS_DB_USER "${temp_dir}/host-override.yaml")" = 0 ] ||
  fail "host-override: the bundled user must not be sent to another host."

# 5. External PostgreSQL: the chart has no host to guess, so it renders none of them.
external_args=(
  --set postgresql.enabled=false
  --set postgresql.externalDatabaseUrl=postgresql://app:secret@db.example.com:5432/formbricks
  --set authzed.datastore.existingSecret=formbricks-authzed
)
render_cube external "${external_args[@]}"
for variable in "${DB_VARIABLES[@]}"; do
  [ "$(env_count "${variable}" "${temp_dir}/external.yaml")" = 0 ] ||
    fail "external: ${variable} must not be rendered for an external database."
done

render_cube external-configured "${external_args[@]}" \
  --set cube.env.CUBEJS_DB_HOST=db.example.com \
  --set cube.env.CUBEJS_DB_USER=app
assert_no_duplicate_env external-configured
[ "$(env_value CUBEJS_DB_HOST "${temp_dir}/external-configured.yaml")" = db.example.com ] ||
  fail "external-configured: cube.env.CUBEJS_DB_HOST must render."

printf '%s\n' "Cube database contracts are valid."
