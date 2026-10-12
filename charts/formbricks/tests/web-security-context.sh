#!/usr/bin/env bash

# The web container must render deployment.containerSecurityContext (ENG-2922), and a read-only root
# filesystem must come with writable mounts for the paths the app writes at runtime.

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

render() {
  helm template qa "${CHART_DIR}" \
    --set formbricks.webappUrl=https://qa.example.com \
    --show-only templates/deployment.yaml \
    "$@"
}

# Prints the container-level securityContext block (12-space indented fields under the web container).
container_security_context() {
  awk '
    /^          securityContext:$/ { inside = 1; next }
    inside && /^            / { print; next }
    inside { exit }
  ' <<<"$1"
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

expect_line() {
  local haystack="$1" line="$2" message="$3"
  grep -qxF -- "${line}" <<<"${haystack}" || fail "${message}: missing '${line}'"
}

# Defaults: the advertised hardening reaches the container, with writable /tmp and Next.js cache mounts.
default_render="$(render)"
default_context="$(container_security_context "${default_render}")"
[[ -n "${default_context}" ]] || fail "Expected a container securityContext in the default render"
for line in \
  '            readOnlyRootFilesystem: true' \
  '            runAsNonRoot: true' \
  '            runAsUser: 1001' \
  '            allowPrivilegeEscalation: false' \
  '              - ALL'; do
  expect_line "${default_context}" "${line}" "Default container securityContext"
done
for path in /tmp /home/nextjs/apps/web/.next/cache; do
  expect_line "${default_render}" "              mountPath: ${path}" "Default writable mounts"
done
if grep -q 'mountPath: /home/nextjs/packages/database/.prisma-migrations' <<<"${default_render}"; then
  fail "The migration staging mount is only needed when startup migrations run"
fi
test "$(grep -c 'emptyDir: {}' <<<"${default_render}")" -eq 2 || fail "Expected exactly two default emptyDir volumes"

# Explicit overrides survive, independently of the Pod-level context.
override_render="$(render \
  --set deployment.containerSecurityContext.allowPrivilegeEscalation=true \
  --set 'deployment.containerSecurityContext.capabilities.drop[0]=NET_RAW' \
  --set deployment.containerSecurityContext.runAsUser=2000 \
  --set deployment.securityContext.runAsUser=1234)"
override_context="$(container_security_context "${override_render}")"
expect_line "${override_context}" '            allowPrivilegeEscalation: true' "Overridden container securityContext"
expect_line "${override_context}" '              - NET_RAW' "Overridden container securityContext"
expect_line "${override_context}" '            runAsUser: 2000' "Overridden container securityContext"
expect_line "${override_render}" '        runAsUser: 1234' "Pod securityContext"

# Startup migrations stage files under packages/database, so that path needs a writable mount too.
startup_migration_render="$(render --set migration.enabled=false)"
expect_line "${startup_migration_render}" \
  '              mountPath: /home/nextjs/packages/database/.prisma-migrations' "Startup migration mounts"

# An operator mount on the same path replaces the chart's, instead of producing a duplicate mountPath.
operator_tmp_render="$(render \
  --set 'deployment.extraVolumes[0].name=scratch' \
  --set 'deployment.extraVolumes[0].emptyDir.medium=Memory' \
  --set 'deployment.extraVolumeMounts[0].name=scratch' \
  --set 'deployment.extraVolumeMounts[0].mountPath=/tmp')"
test "$(grep -c 'mountPath: /tmp$' <<<"${operator_tmp_render}")" -eq 1 || fail "Expected a single /tmp mount"
if grep -q 'name: writable-tmp' <<<"${operator_tmp_render}"; then
  fail "The chart must not mount /tmp when the operator already does"
fi

# An extraVolumes entry that already uses a generated name keeps it; the chart's volume is renamed.
name_clash_render="$(render \
  --set 'deployment.extraVolumes[0].name=writable-tmp' \
  --set 'deployment.extraVolumes[0].emptyDir.medium=Memory' \
  --set 'deployment.extraVolumeMounts[0].name=writable-tmp' \
  --set 'deployment.extraVolumeMounts[0].mountPath=/scratch')"
test "$(grep -cE -- '(- | )name: writable-tmp$' <<<"${name_clash_render}")" -eq 2 \
  || fail "Expected the operator's writable-tmp volume and mount only"
test "$(grep -c -- '- name: formbricks-writable-tmp$' <<<"${name_clash_render}")" -eq 2 \
  || fail "Expected the chart's /tmp volume and mount under a non-clashing name"
grep -A1 -- '- name: formbricks-writable-tmp$' <<<"${name_clash_render}" | grep -q 'mountPath: /tmp$' \
  || fail "Expected the renamed chart volume to mount /tmp"

# A writable root filesystem needs no extra mounts, and a nulled context renders no block at all.
writable_root_render="$(render --set deployment.containerSecurityContext.readOnlyRootFilesystem=false)"
if grep -qE '^ +(volumes|volumeMounts):$' <<<"${writable_root_render}"; then
  fail "Expected no volumes when the root filesystem is writable"
fi
empty_context_render="$(render --set deployment.containerSecurityContext=null)"
[[ -z "$(container_security_context "${empty_context_render}")" ]] || fail "Expected no container securityContext"
