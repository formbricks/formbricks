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

printf '%s\n' "AuthZed Helm operations contracts are valid."
