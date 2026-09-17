#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMMON_ARGS=(--set formbricks.webappUrl=https://qa.example.com)

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

render_case() {
  local name="$1"
  shift

  helm template "postgresql-${name}" "${CHART_DIR}" "${COMMON_ARGS[@]}" "$@" \
    --show-only charts/postgresql/templates/primary/svc.yaml \
    --show-only charts/postgresql/templates/primary/statefulset.yaml \
    --show-only templates/secrets.yaml \
    --show-only templates/authzed-secret.yaml \
    --show-only templates/authzed-postgresql-bootstrap.yaml \
    >"${temp_dir}/${name}.yaml"
}

extract_first_value() {
  local key="$1" manifest="$2"

  awk -v target="${key}:" '$1 == target { print $2; exit }' "${manifest}" | tr -d '"'
}

extract_env_value() {
  local name="$1" manifest="$2"

  awk -v target="${name}" '
    $0 ~ "^[[:space:]]*-[[:space:]]+name:[[:space:]]+" target "$" {
      getline
      if ($1 == "value:") {
        gsub(/^"|"$/, "", $2)
        print $2
      }
      exit
    }
  ' "${manifest}"
}

extract_env_secret_key() {
  local name="$1" manifest="$2"

  awk -v target="${name}" '
    $0 ~ "^[[:space:]]*-[[:space:]]+name:[[:space:]]+" target "$" {
      in_target = 1
      next
    }
    in_target && $1 == "key:" {
      print $2
      exit
    }
    in_target && $0 ~ "^[[:space:]]*-[[:space:]]+name:" {
      exit
    }
  ' "${manifest}"
}

assert_equal() {
  local expected="$1" actual="$2" message="$3"

  if [[ "${actual}" != "${expected}" ]]; then
    printf '%s\n' "${message}" >&2
    exit 1
  fi
}

assert_case() {
  local name="$1" expected_host="$2" expected_port="$3" expected_username="$4"
  local expected_database="$5" password_key="$6" manifest="${temp_dir}/${name}.yaml"
  local service_name service_port database_url database_password datastore_uri datastore_password
  local postgresql_username postgresql_database postgresql_password_key bootstrap_host bootstrap_port
  local expected_database_url

  service_name="$(
    awk '/^kind: Service$/ { in_service = 1; next } in_service && /^  name:/ { print $2; exit }' \
      "${manifest}"
  )"
  service_port="$(
    awk '/^kind: Service$/ { in_service = 1; next } in_service && $1 == "port:" { print $2; exit }' \
      "${manifest}"
  )"
  database_url="$(extract_first_value DATABASE_URL "${manifest}" | base64 --decode)"
  database_password="$(extract_first_value "${password_key}" "${manifest}" | base64 --decode)"
  datastore_uri="$(extract_first_value datastore_uri "${manifest}")"
  datastore_password="$(extract_first_value database_password "${manifest}")"
  postgresql_username="$(extract_env_value POSTGRES_USER "${manifest}")"
  postgresql_username="${postgresql_username:-postgres}"
  postgresql_database="$(extract_env_value POSTGRES_DATABASE "${manifest}")"
  postgresql_password_key="$(extract_env_secret_key POSTGRES_PASSWORD "${manifest}")"
  bootstrap_host="$(extract_env_value PGHOST "${manifest}")"
  bootstrap_port="$(extract_env_value PGPORT "${manifest}")"

  assert_equal "${expected_host}" "${service_name}" "${name}: PostgreSQL Service name is inconsistent."
  assert_equal "${expected_port}" "${service_port}" "${name}: PostgreSQL Service port is inconsistent."
  assert_equal "${expected_username}" "${postgresql_username}" "${name}: PostgreSQL username is inconsistent."
  assert_equal "${expected_database}" "${postgresql_database}" "${name}: PostgreSQL database is inconsistent."
  assert_equal "${password_key}" "${postgresql_password_key}" "${name}: PostgreSQL password key is inconsistent."
  expected_database_url="postgresql://${expected_username}:${database_password}"
  expected_database_url+="@${expected_host}:${expected_port}/${expected_database}"
  assert_equal \
    "${expected_database_url}" \
    "${database_url}" \
    "${name}: generated DATABASE_URL does not match the PostgreSQL Service and credentials."
  assert_equal \
    "postgresql://spicedb:${datastore_password}@${expected_host}:${expected_port}/spicedb?sslmode=disable" \
    "${datastore_uri}" \
    "${name}: generated SpiceDB datastore URI does not match the PostgreSQL Service."
  assert_equal "${expected_host}" "${bootstrap_host}" "${name}: AuthZed bootstrap PGHOST is inconsistent."
  assert_equal "${expected_port}" "${bootstrap_port}" "${name}: AuthZed bootstrap PGPORT is inconsistent."
}

render_case default
assert_case default formbricks-postgresql 5432 formbricks formbricks POSTGRES_USER_PASSWORD

render_case overrides \
  --set postgresql.fullnameOverride=audit-postgresql \
  --set postgresql.primary.service.ports.postgresql=5544 \
  --set postgresql.auth.username=audit_user \
  --set postgresql.auth.database=audit_db
assert_case overrides audit-postgresql 5544 audit_user audit_db POSTGRES_USER_PASSWORD

render_case global-overrides \
  --set postgresql.fullnameOverride=global-postgresql \
  --set global.postgresql.service.ports.postgresql=6543 \
  --set global.postgresql.auth.username=global_user \
  --set global.postgresql.auth.database=global_db
assert_case global-overrides global-postgresql 6543 global_user global_db POSTGRES_USER_PASSWORD

# The Bitnami subchart treats `postgres` as its administrator rather than a custom user, so the
# generated application URL must select the administrator password for this supported username.
render_case postgres-user \
  --set postgresql.auth.username=postgres \
  --set postgresql.auth.database=audit_db
assert_case postgres-user formbricks-postgresql 5432 postgres audit_db POSTGRES_ADMIN_PASSWORD

printf '%s\n' "PostgreSQL override contracts are valid."
