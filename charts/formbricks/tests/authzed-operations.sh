#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMMON_ARGS=(--set formbricks.webappUrl=https://qa.example.com)

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

# `helm template` deliberately omits NOTES.txt, while Helm 3.15 still contacts Kubernetes during a dry-run
# install. Evaluate the real notes through `tpl` in a minimal ConfigMap chart so this contract remains
# clusterless and release-accurate across supported Helm versions.
notes_chart="${temp_dir}/notes-chart"
mkdir -p "${notes_chart}/templates"
cp "${CHART_DIR}/values.yaml" "${notes_chart}/values.yaml"
cp "${CHART_DIR}/templates/_helpers.tpl" "${notes_chart}/templates/_helpers.tpl"
cp "${CHART_DIR}/templates/NOTES.txt" "${notes_chart}/notes.txt"
printf '%s\n' \
  'apiVersion: v2' \
  'name: formbricks-notes-contract' \
  'version: 0.0.0' \
  'appVersion: 0.0.0' >"${notes_chart}/Chart.yaml"
printf '%s\n' \
  'apiVersion: v1' \
  'kind: ConfigMap' \
  'metadata:' \
  '  name: notes-contract' \
  'data:' \
  '  notes: |' \
  '{{ tpl (.Files.Get "notes.txt") . | nindent 4 }}' >"${notes_chart}/templates/notes.yaml"

render_notes() {
  local release_name="$1"
  shift

  helm template "${release_name}" "${notes_chart}" --namespace qa "${COMMON_ARGS[@]}" "$@" \
    --show-only templates/notes.yaml \
    | sed -n '/^  notes: |/,$p' \
    | sed '1d; s/^    //'
}

authzed_operations_notes() {
  sed -n '/AuthZed \/ SpiceDB Operations:/,/^---$/p' <<<"$1"
}

assert_safe_authzed_notes() {
  local release_name="$1"
  local notes="$2"

  if grep --extended-regexp --ignore-case 'preshared|datastore_uri|token|ingress' <<<"${notes}" >/dev/null; then
    printf '%s\n' "AuthZed operations notes for ${release_name} must not expose secrets or suggest an Ingress." >&2
    exit 1
  fi
}

disabled_notes="$(render_notes authzed-disabled)"
if grep --fixed-strings "AuthZed / SpiceDB Operations:" <<<"${disabled_notes}" >/dev/null; then
  printf '%s\n' "AuthZed operations notes must be hidden when AuthZed is disabled." >&2
  exit 1
fi

external_notes="$(render_notes authzed-external \
  --set authzed.enabled=true \
  --set authzed.mode=external \
  --set authzed.endpoint=grpc.authzed.com:443 \
  --set authzed.insecure=false \
  --set authzed.auth.existingSecret=formbricks-authzed)"

authzed_notes="$(authzed_operations_notes "${external_notes}")"
grep --fixed-strings 'SpiceDB is configured in `external` mode.' <<<"${authzed_notes}" >/dev/null
grep --fixed-strings 'formbricks-authzed health' <<<"${authzed_notes}" >/dev/null
grep --fixed-strings 'formbricks-authzed schema check' <<<"${authzed_notes}" >/dev/null
grep --fixed-strings 'self-hosting/advanced/authzed-operations' <<<"${authzed_notes}" >/dev/null
assert_safe_authzed_notes authzed-external "${authzed_notes}"

# Render each supported ownership and datastore shape. These are intentionally render-only checks: none
# of the operational commands are Helm hooks or automatically created Jobs.
helm template authzed-bundled "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=true >/dev/null

bundled_notes="$(render_notes authzed-bundled \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=true)"
assert_safe_authzed_notes authzed-bundled "$(authzed_operations_notes "${bundled_notes}")"

helm template authzed-existing-operator "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=false \
  --set authzed.auth.existingSecret=formbricks-authzed \
  --set authzed.datastore.existingSecret=formbricks-authzed >/dev/null

existing_operator_notes="$(render_notes authzed-existing-operator \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=false \
  --set authzed.auth.existingSecret=formbricks-authzed \
  --set authzed.datastore.existingSecret=formbricks-authzed)"
assert_safe_authzed_notes authzed-existing-operator "$(authzed_operations_notes "${existing_operator_notes}")"

managed_postgresql_notes="$(render_notes authzed-managed-postgresql \
  --set postgresql.enabled=false \
  --set-string postgresql.externalDatabaseUrl=postgresql://formbricks:notes-secret@postgres.example:5432/formbricks?sslmode=require \
  --set authzed.enabled=true \
  --set authzed.mode=selfHosted \
  --set authzed.operator.install=false \
  --set authzed.auth.existingSecret=formbricks-authzed \
  --set authzed.datastore.existingSecret=formbricks-authzed)"

if grep --fixed-strings 'notes-secret' <<<"${managed_postgresql_notes}" >/dev/null; then
  printf '%s\n' "Helm notes must not render PostgreSQL credentials." >&2
  exit 1
fi
assert_safe_authzed_notes authzed-managed-postgresql \
  "$(authzed_operations_notes "${managed_postgresql_notes}")"

helm template authzed-external "${CHART_DIR}" "${COMMON_ARGS[@]}" \
  --set authzed.enabled=true \
  --set authzed.mode=external \
  --set authzed.endpoint=grpc.authzed.com:443 \
  --set authzed.insecure=false \
  --set authzed.auth.existingSecret=formbricks-authzed >/dev/null

# ENG-2390: the bundled database bootstrap must not hard-require a role named `postgres`.
# An existing PostgreSQL installed without one previously had no option but to disable bootstrap
# entirely, which left the SpiceDB role and database uncreated.

render_bootstrap() {
  helm template "$1" "${CHART_DIR}" "${COMMON_ARGS[@]}" \
    --set authzed.enabled=true \
    --set authzed.mode=selfHosted \
    "${@:2}" \
    --show-only templates/authzed-postgresql-bootstrap.yaml
}

# The default is unchanged: the bundled `postgres` superuser on the `postgres` database.
default_bootstrap="$(render_bootstrap authzed-bootstrap-default)"
grep --quiet 'value: "postgres"' <<<"${default_bootstrap}"

# The regression itself. Without an override this still refuses, but it must name the way out
# rather than simply asserting that enablePostgresUser is required.
if bootstrap_refusal="$(render_bootstrap authzed-bootstrap-no-superuser \
  --set postgresql.auth.enablePostgresUser=false 2>&1)"; then
  printf '%s\n' "Bootstrap must refuse a missing postgres superuser when no admin role is configured." >&2
  exit 1
fi
grep --quiet 'adminUsername' <<<"${bootstrap_refusal}"

# ...and configuring an existing administrative role is what unblocks it.
existing_admin_bootstrap="$(render_bootstrap authzed-bootstrap-existing-admin \
  --set postgresql.auth.enablePostgresUser=false \
  --set authzed.bundledPostgresqlBootstrap.adminUsername=fbadmin \
  --set authzed.bundledPostgresqlBootstrap.adminDatabase=formbricks \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordSecretName=existing-pg-admin \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordKey=password)"
grep --quiet 'value: "fbadmin"' <<<"${existing_admin_bootstrap}"
grep --quiet 'value: "formbricks"' <<<"${existing_admin_bootstrap}"
grep --quiet 'name: existing-pg-admin' <<<"${existing_admin_bootstrap}"

# Matti's finding on #8875: the key needs its own guard. `$bundledAdminKey` falls back to the
# subchart's non-empty default, so "is it set at all" can never fail for a custom role, and forgetting
# the key silently looks up the subchart's key name inside the operator's own Secret.
if render_bootstrap authzed-bootstrap-admin-without-key \
  --set authzed.bundledPostgresqlBootstrap.adminUsername=fbadmin \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordSecretName=existing-pg-admin >/dev/null 2>&1; then
  printf '%s\n' "Bootstrap must require adminPasswordKey when adminUsername is overridden." >&2
  exit 1
fi

# An existing server whose privileged role is called `postgres` is a configured administrator, not the
# bundled superuser — supplying its Secret explicitly must be accepted even with enablePostgresUser=false.
explicit_postgres_bootstrap="$(render_bootstrap authzed-bootstrap-explicit-postgres \
  --set postgresql.auth.enablePostgresUser=false \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordSecretName=existing-pg-admin \
  --set authzed.bundledPostgresqlBootstrap.adminPasswordKey=password)"
grep --quiet 'value: "postgres"' <<<"${explicit_postgres_bootstrap}"
grep --quiet 'name: existing-pg-admin' <<<"${explicit_postgres_bootstrap}"

# A custom admin role with no Secret would silently fall back to the bundled superuser's password.
if render_bootstrap authzed-bootstrap-admin-without-secret \
  --set authzed.bundledPostgresqlBootstrap.adminUsername=fbadmin >/dev/null 2>&1; then
  printf '%s\n' "Bootstrap must require adminPasswordSecretName when adminUsername is overridden." >&2
  exit 1
fi

# Credentials reach the Job only by reference, in every mode.
if grep --extended-regexp 'PGPASSWORD: |password: [^{]' <<<"${existing_admin_bootstrap}" >/dev/null; then
  printf '%s\n' "Bootstrap manifests must not contain credential values." >&2
  exit 1
fi

printf '%s\n' "AuthZed Helm operations contracts are valid."
