#!/usr/bin/env bash

# Older migration runners remove and recreate their staging directory. Keep the
# migration Job writable even when the web container uses a read-only root.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR CHART_DIR

render() {
  helm template qa "${CHART_DIR}" \
    --set formbricks.webappUrl=https://qa.example.com \
    --show-only templates/migration-job.yaml \
    "$@"
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

expect_writable_job() {
  if grep -qE '^          securityContext:|^ +(volumes|volumeMounts):$' <<<"$1"; then
    fail "Migration containers must not inherit the web security context or staging mounts"
  fi
  grep -q 'packages/database/dist/scripts/apply-migrations.js' <<<"$1" \
    || fail "Expected the application migration command"
}

default_render="$(render)"
expect_writable_job "${default_render}"
grep -q 'packages/database/dist/scripts/wait-for-database.js' <<<"${default_render}" \
  || fail "Expected database readiness to run before migrations"

# Web-only settings and mounts must not change the migration Job.
override_render="$(render \
  --set deployment.containerSecurityContext.runAsUser=2000 \
  --set deployment.containerSecurityContext.readOnlyRootFilesystem=true \
  --set 'deployment.extraVolumes[0].name=scratch' \
  --set 'deployment.extraVolumes[0].emptyDir.medium=Memory' \
  --set 'deployment.extraVolumeMounts[0].name=scratch' \
  --set 'deployment.extraVolumeMounts[0].mountPath=/tmp')"
[[ "${default_render}" == "${override_render}" ]] \
  || fail "Web container settings must leave the migration Job unchanged"

# The Job still honors an explicitly configured image-compatible Pod identity.
# This checks rendering only; it does not establish arbitrary-UID runtime support.
pod_context_render="$(render --set deployment.securityContext.runAsUser=1001)"
expect_writable_job "${pod_context_render}"
grep -q '^        runAsUser: 1001$' <<<"${pod_context_render}" \
  || fail "Expected the migration Job to retain its Pod security context"

without_wait="$(render --set migration.waitForDatabase.enabled=false)"
expect_writable_job "${without_wait}"
if grep -q 'name: wait-for-database' <<<"${without_wait}"; then
  fail "Expected no readiness init container when disabled"
fi

if render --set migration.enabled=false >/dev/null 2>&1; then
  fail "Expected no migration Job when disabled"
fi

printf '%s\n' 'Migration Job compatibility checks passed'
