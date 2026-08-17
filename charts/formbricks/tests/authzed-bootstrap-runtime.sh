#!/usr/bin/env bash
# Runs the AuthZed bootstrap Job's *rendered* script against real PostgreSQL servers.
#
# The render tests in authzed-operations.sh prove the manifest says what we mean. They cannot prove
# the SQL works, and the SQL is where this feature actually broke: a role with CREATEROLE and CREATEDB
# — the privileges values.yaml tells operators to grant — could not run `CREATE DATABASE ... OWNER`,
# because PostgreSQL 16+ grants a role's creator ADMIN but SET FALSE, and 15 and older grant nothing.
# Both fail, with different messages, and no amount of template testing sees it.
#
# So this extracts the script from the rendered Job and runs it verbatim. Nothing here restates the
# SQL: a fix that lands in the template but not in reality fails here, and a test that drifts from
# the template is impossible by construction.
#
# Skipped when Docker is unavailable so the render suite still runs anywhere.
set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker info >/dev/null 2>&1; then
  printf '%s\n' "Docker unavailable — skipping the AuthZed bootstrap runtime tests."
  exit 0
fi

# PostgreSQL 16 changed how a creator is granted its new role, and the bootstrap has to work either
# way, so both sides of that change are covered.
postgres_versions=("15" "17")
admin_password="admin-pw"
spicedb_password="spicedb-pw"
containers=()
container=""

cleanup() {
  for container in "${containers[@]:-}"; do
    [ -n "${container}" ] && docker rm --force "${container}" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

# Pull the `args:` block scalar out of the rendered Job. Reading the shipped script rather than a
# copy is the whole point: this test cannot pass against SQL the chart does not actually ship.
extract_bootstrap_script() {
  awk '
    /^[[:space:]]*args:[[:space:]]*$/ { in_args = 1; next }
    in_args && /^[[:space:]]*-[[:space:]]*\|[[:space:]]*$/ { in_block = 1; next }
    in_block {
      if (block_indent == 0 && $0 !~ /^[[:space:]]*$/) {
        match($0, /^[[:space:]]*/)
        block_indent = RLENGTH
      }
      if ($0 !~ /^[[:space:]]*$/) {
        match($0, /^[[:space:]]*/)
        if (RLENGTH < block_indent) { exit }
      }
      print substr($0, block_indent + 1)
    }
  '
}

bootstrap_script="$(helm template runtime "${chart_dir}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --show-only templates/authzed-postgresql-bootstrap.yaml | extract_bootstrap_script)"

if ! grep --quiet 'CREATE DATABASE' <<<"${bootstrap_script}"; then
  printf '%s\n' "Could not extract the bootstrap script from the rendered Job." >&2
  exit 1
fi

# Sets the global `container` rather than echoing it: a `$(start_postgres …)` call would run this in a
# subshell, so the name would never reach the cleanup list in the parent and a failing assertion
# would leak the server.
start_postgres() {
  local version="$1"
  container="authzed-bootstrap-runtime-${version}"
  docker rm --force "${container}" >/dev/null 2>&1 || true
  docker run --detach --name "${container}" \
    --env POSTGRES_PASSWORD=superuser-pw "postgres:${version}-alpine" >/dev/null
  containers+=("${container}")
  # Probe over TCP, not the Unix socket. The postgres entrypoint runs a temporary socket-only server
  # while it initialises the data directory, so a socket probe reports ready, the entrypoint then
  # stops that server, and the next command fails with "No such file or directory" — which is exactly
  # how this first went red in CI while passing locally. The real server is the one listening on TCP.
  local attempt=1
  until docker exec "${container}" pg_isready --host 127.0.0.1 --username postgres >/dev/null 2>&1; do
    if [ "${attempt}" -ge 90 ]; then
      printf '%s\n' "PostgreSQL ${version} did not become ready." >&2
      exit 1
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
}

# Runs the rendered script exactly as the Job does: same shell, same env contract.
run_bootstrap() {
  local container="$1" admin_user="$2" admin_pass="$3"
  docker exec --interactive \
    --env PGHOST=127.0.0.1 \
    --env PGUSER="${admin_user}" \
    --env PGPASSWORD="${admin_pass}" \
    --env ADMIN_DATABASE_NAME=postgres \
    --env SPICEDB_DATABASE_NAME=spicedb \
    --env SPICEDB_DATABASE_USERNAME=spicedb \
    --env SPICEDB_DATABASE_PASSWORD="${spicedb_password}" \
    "${container}" /bin/sh -ec "${bootstrap_script}" 2>&1
}

as_superuser() {
  docker exec --env PGPASSWORD=superuser-pw "$1" \
    psql --host 127.0.0.1 --username postgres --dbname postgres --tuples-only --no-align --command "$2"
}

for version in "${postgres_versions[@]}"; do
  start_postgres "${version}"
  printf 'PostgreSQL %s\n' "$(as_superuser "${container}" 'SHOW server_version')"

  # The privileges values.yaml documents, and nothing more.
  as_superuser "${container}" \
    "CREATE ROLE fbadmin LOGIN CREATEROLE CREATEDB PASSWORD '${admin_password}'" >/dev/null

  # 1. A fresh server with only a CREATEROLE/CREATEDB administrator: the path this feature exists for.
  if ! output="$(run_bootstrap "${container}" fbadmin "${admin_password}")"; then
    printf '%s\n%s\n' "Bootstrap failed for a CREATEROLE/CREATEDB administrator on ${version}:" "${output}" >&2
    exit 1
  fi
  [ "$(as_superuser "${container}" "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'spicedb'")" = "spicedb" ] || {
    printf '%s\n' "The spicedb database must exist and be owned by the spicedb role on ${version}." >&2
    exit 1
  }
  # Proves ALTER ROLE actually applied the password, not merely that the statement ran.
  docker exec --env PGPASSWORD="${spicedb_password}" "${container}" \
    psql --host 127.0.0.1 --username spicedb --dbname spicedb --command 'SELECT 1' >/dev/null || {
    printf '%s\n' "The spicedb role must be able to log in with the configured password on ${version}." >&2
    exit 1
  }

  # 2. Rerunning is safe: the Job is a post-install *and* post-upgrade hook, so it reruns every upgrade.
  if ! output="$(run_bootstrap "${container}" fbadmin "${admin_password}")"; then
    printf '%s\n%s\n' "Rerunning the bootstrap must succeed on ${version}:" "${output}" >&2
    exit 1
  fi

  # 3. The bundled superuser path must be unchanged — and must not collect a role membership it has
  #    no use for, which is why the GRANT is skipped for superusers rather than run unconditionally.
  as_superuser "${container}" "DROP DATABASE spicedb" >/dev/null
  as_superuser "${container}" "DROP ROLE spicedb" >/dev/null
  if ! output="$(run_bootstrap "${container}" postgres superuser-pw)"; then
    printf '%s\n%s\n' "Bootstrap failed for the bundled superuser on ${version}:" "${output}" >&2
    exit 1
  fi
  [ "$(as_superuser "${container}" "SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles u ON u.oid = m.member WHERE r.rolname = 'spicedb' AND u.rolname = 'postgres'")" = "0" ] || {
    printf '%s\n' "A superuser administrator must not be granted the spicedb role on ${version}." >&2
    exit 1
  }

  # 4. A spicedb role created by someone else. PostgreSQL 16 narrowed CREATEROLE: before it, the
  #    privilege carried authority over every non-superuser role, so the bootstrap simply works;
  #    from 16 on it only covers roles the administrator has ADMIN OPTION for, so this is the
  #    documented limitation and must fail loudly rather than appear to succeed. Asserting one
  #    outcome for both would either miss the failure or demand a fix the older server does not need.
  as_superuser "${container}" "DROP DATABASE spicedb" >/dev/null
  server_version_num="$(as_superuser "${container}" 'SHOW server_version_num')"
  if output="$(run_bootstrap "${container}" fbadmin "${admin_password}")"; then
    if [ "${server_version_num}" -ge 160000 ]; then
      printf '%s\n' "Bootstrap must fail without ADMIN OPTION on a pre-existing spicedb role (${version})." >&2
      exit 1
    fi
  else
    if [ "${server_version_num}" -lt 160000 ]; then
      printf '%s\n%s\n' "CREATEROLE alone must still adopt a pre-existing spicedb role on ${version}:" "${output}" >&2
      exit 1
    fi
    grep --quiet --extended-regexp 'must have admin option|permission denied|must be able to SET ROLE|must be member of role' <<<"${output}" || {
      printf '%s\n%s\n' "Expected a privilege error for a pre-existing foreign-owned spicedb role on ${version}, got:" "${output}" >&2
      exit 1
    }
  fi

  docker rm --force "${container}" >/dev/null 2>&1 || true
done

printf '%s\n' "AuthZed bootstrap runtime contracts are valid."
