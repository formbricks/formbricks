#!/usr/bin/env bash

# Verify the effective identity of the AuthZed hook, independently of the web container.
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="${CHART_DIR:-$(cd -- "${SCRIPT_DIR}/.." && pwd)}"

render() {
  helm template qa "${CHART_DIR}" \
    --set formbricks.webappUrl=https://qa.example.com \
    --set global.postgresql.auth.password=test-password \
    --set global.postgresql.auth.postgresPassword=test-password \
    --show-only templates/authzed-initialize-job.yaml "$@"
}

container_context() {
  awk '
    /^          securityContext:$/ { inside = 1; next }
    inside && /^            / { print; next }
    inside { exit }
  ' <<<"$1"
}

expect_line() {
  grep -qxF -- "$2" <<<"$1" || {
    printf '%s\n' "$3: missing '$2'" >&2
    exit 1
  }
}

# The image declares USER nextjs, so the kubelet needs a numeric UID for both hook paths.
for mode in install upgrade; do
  args=(--set authzed.enabled=true)
  if [[ "${mode}" == upgrade ]]; then
    args+=(--is-upgrade --set authzed.migrationAcknowledged=true)
  fi
  context="$(container_context "$(render "${args[@]}")")"
  for line in \
    '            runAsUser: 1001' \
    '            runAsNonRoot: true' \
    '            allowPrivilegeEscalation: false' \
    '            readOnlyRootFilesystem: true' \
    '              - ALL'; do
    expect_line "${context}" "${line}" "Default ${mode} hook security context"
  done
done

# Existing custom-image Pod UIDs must remain effective, not be shadowed by the new fallback.
pod_override="$(render --set deployment.securityContext.runAsUser=2000)"
expect_line "${pod_override}" '        runAsUser: 2000' 'Existing Pod UID'
if grep -q 'runAsUser:' <<<"$(container_context "${pod_override}")"; then
  printf '%s\n' 'The hook must inherit an explicitly configured Pod UID.' >&2
  exit 1
fi

# A hook-specific override wins over the Pod UID without inheriting web-only settings.
hook_override="$(render \
  --set authzed.initialization.securityContext.runAsUser=3000 \
  --set authzed.initialization.securityContext.runAsGroup=3000 \
  --set authzed.initialization.securityContext.readOnlyRootFilesystem=false \
  --set deployment.securityContext.runAsUser=2000 \
  --set deployment.containerSecurityContext.runAsUser=4000)"
hook_context="$(container_context "${hook_override}")"
for line in \
  '            runAsUser: 3000' \
  '            runAsGroup: 3000' \
  '            readOnlyRootFilesystem: false' \
  '            runAsNonRoot: true' \
  '            allowPrivilegeEscalation: false'; do
  expect_line "${hook_context}" "${line}" 'Hook-specific override'
done

# Null/partial Pod settings must not suppress the numeric fallback. External SpiceDB uses the same hook.
external_context="$(container_context "$(render \
  --set authzed.mode=external \
  --set authzed.operator.install=false \
  --set authzed.endpoint=spicedb.example.com:50051 \
  --set authzed.auth.existingSecret=existing-authzed \
  --set deployment.securityContext=null \
  --set authzed.initialization.securityContext=null)")"
expect_line "${external_context}" '            runAsUser: 1001' 'External SpiceDB with null contexts'
partial_context="$(container_context "$(render --set deployment.securityContext.fsGroup=2000)")"
expect_line "${partial_context}" '            runAsUser: 1001' 'Pod context without a UID'
null_uid_context="$(container_context "$(render --set deployment.securityContext.runAsUser=null)")"
expect_line "${null_uid_context}" '            runAsUser: 1001' 'Null Pod UID'
web_override_context="$(container_context "$(render --set deployment.containerSecurityContext.runAsUser=4000)")"
expect_line "${web_override_context}" '            runAsUser: 1001' 'Independent web container UID'

printf '%s\n' 'AuthZed hook security context checks passed.'
