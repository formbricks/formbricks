#!/usr/bin/env bash

# The migration Job runs the web image, so both of its containers must render
# deployment.containerSecurityContext (ENG-3480), and a read-only root filesystem must come with writable
# mounts for the paths the migration runner writes.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly SCRIPT_DIR CHART_DIR
readonly STAGING_PATH=/home/nextjs/packages/database/.prisma-migrations

render() {
  helm template qa "${CHART_DIR}" \
    --set formbricks.webappUrl=https://qa.example.com \
    --show-only templates/migration-job.yaml \
    "$@"
}

# Prints one container, from its `- name:` line up to the next container or Pod-level field.
container_block() {
  awk -v start="        - name: $2" '
    $0 == start { inside = 1; print; next }
    inside && /^          / { print; next }
    inside { exit }
  ' <<<"$1"
}

# Prints the container-level securityContext block (12-space indented fields under the container).
container_security_context() {
  awk '
    /^          securityContext:$/ { inside = 1; next }
    inside && /^            / { print; next }
    inside { exit }
  ' <<<"$1"
}

# Prints each of a container's volume mounts as "<name> <mountPath>", sorted. Keys are read in any order,
# since toYaml sorts them (`- mountPath:` comes before `name:`).
container_mounts() {
  awk '
    function flush() { if (started) print name, path; started = 1; name = ""; path = "" }
    /^          volumeMounts:$/ { inside = 1; next }
    inside && /^            - / { flush(); sub(/^            - /, "              ") }
    inside && /^              name: / { name = $2; next }
    inside && /^              mountPath: / { path = $2; next }
    inside && /^             / { next }
    inside { exit }
    END { if (started) print name, path }
  ' <<<"$1" | sort
}

# Prints each Pod volume as "<name> <source>", sorted, reading keys in any order like container_mounts.
pod_volumes() {
  awk '
    function flush() { if (started) print name, source; started = 1; name = ""; source = "" }
    /^      volumes:$/ { inside = 1; next }
    inside && /^        - / { flush(); sub(/^        - /, "          ") }
    inside && /^          name: / { name = $2; next }
    inside && /^          [a-zA-Z]+:/ { source = source $1 $2; next }
    inside && /^           / { next }
    inside { exit }
    END { if (started) print name, source }
  ' <<<"$1" | sort
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

expect_line() {
  local haystack="$1" line="$2" message="$3"
  grep -qxF -- "${line}" <<<"${haystack}" || fail "${message}: missing '${line}'"
}

# The advertised default, exactly as toYaml renders it under a container (keys sorted). Compared whole, so an
# added capability or privileged flag fails as surely as a missing field.
readonly EXPECTED_CONTEXT="            allowPrivilegeEscalation: false
            capabilities:
              drop:
              - ALL
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1001"

expect_default_context() {
  local context="$1" message="$2"
  [[ "${context}" == "${EXPECTED_CONTEXT}" ]] && return 0
  fail "${message} differs from the advertised default:
$(diff -u --label expected --label rendered \
    <(printf '%s\n' "${EXPECTED_CONTEXT}") <(printf '%s\n' "${context}"))"
}

expect_no_volumes() {
  if grep -qE '^ +(volumes|volumeMounts):$' <<<"$1"; then
    fail "$2: expected no volumes or volumeMounts"
  fi
}

readonly EXPECTED_MOUNTS="writable-prisma-migrations ${STAGING_PATH}
writable-tmp /tmp"
readonly EXPECTED_VOLUMES="writable-prisma-migrations emptyDir:{}
writable-tmp emptyDir:{}"

# Defaults: both containers carry the advertised hardening, and the migration runner gets writable /tmp and
# staging mounts. wait-for-database only opens a TCP socket, so it gets none.
default_render="$(render)"
default_wait="$(container_block "${default_render}" wait-for-database)"
default_migration="$(container_block "${default_render}" migration)"
[[ -n "${default_wait}" ]] || fail "Expected a wait-for-database init container in the default render"
[[ -n "${default_migration}" ]] || fail "Expected a migration container in the default render"
expect_default_context "$(container_security_context "${default_wait}")" \
  "Default wait-for-database securityContext"
expect_default_context "$(container_security_context "${default_migration}")" \
  "Default migration securityContext"
[[ "$(container_mounts "${default_migration}")" == "${EXPECTED_MOUNTS}" ]] \
  || fail "Expected the migration container to mount exactly /tmp and ${STAGING_PATH}"
[[ -z "$(container_mounts "${default_wait}")" ]] || fail "Expected no mounts on wait-for-database"
[[ "$(pod_volumes "${default_render}")" == "${EXPECTED_VOLUMES}" ]] \
  || fail "Expected exactly the writable-tmp and writable-prisma-migrations emptyDir volumes"

# The Job does not consume the web container's extra volumes, so they add nothing to it.
extra_volumes_render="$(render \
  --set 'deployment.extraVolumes[0].name=custom-ca' \
  --set 'deployment.extraVolumes[0].configMap.name=custom-ca' \
  --set 'deployment.extraVolumeMounts[0].name=custom-ca' \
  --set 'deployment.extraVolumeMounts[0].mountPath=/etc/ssl/custom')"
[[ "$(container_mounts "$(container_block "${extra_volumes_render}" migration)")" == "${EXPECTED_MOUNTS}" ]] \
  || fail "Expected deployment.extraVolumeMounts to leave the migration container's mounts unchanged"
[[ -z "$(container_mounts "$(container_block "${extra_volumes_render}" wait-for-database)")" ]] \
  || fail "Expected deployment.extraVolumeMounts to add no mounts to wait-for-database"
[[ "$(pod_volumes "${extra_volumes_render}")" == "${EXPECTED_VOLUMES}" ]] \
  || fail "Expected deployment.extraVolumes to leave the Job's volumes unchanged"

# Explicit overrides survive on both containers, independently of the Pod-level context.
override_render="$(render \
  --set deployment.containerSecurityContext.runAsUser=2000 \
  --set deployment.securityContext.runAsUser=1234)"
for name in wait-for-database migration; do
  expect_line "$(container_security_context "$(container_block "${override_render}" "${name}")")" \
    '            runAsUser: 2000' "Overridden ${name} securityContext"
done
expect_line "${override_render}" '        runAsUser: 1234' "Pod securityContext"

# A writable root filesystem keeps the context but needs no extra mounts.
writable_root_render="$(render --set deployment.containerSecurityContext.readOnlyRootFilesystem=false)"
for name in wait-for-database migration; do
  expect_line "$(container_security_context "$(container_block "${writable_root_render}" "${name}")")" \
    '            readOnlyRootFilesystem: false' "Writable-root ${name} securityContext"
done
expect_no_volumes "${writable_root_render}" "Writable root"

# A nulled context renders no container securityContext and no mounts.
empty_context_render="$(render --set deployment.containerSecurityContext=null)"
if grep -qxF '          securityContext:' <<<"${empty_context_render}"; then
  fail "Expected no container securityContext when deployment.containerSecurityContext is null"
fi
expect_no_volumes "${empty_context_render}" "Null container securityContext"

# Without the readiness check, the migration container is still hardened and mounted.
no_wait_render="$(render --set migration.waitForDatabase.enabled=false)"
if grep -qE '^ +initContainers:$' <<<"${no_wait_render}"; then
  fail "Expected no init container when migration.waitForDatabase.enabled=false"
fi
no_wait_migration="$(container_block "${no_wait_render}" migration)"
expect_default_context "$(container_security_context "${no_wait_migration}")" \
  "No-wait migration securityContext"
[[ "$(container_mounts "${no_wait_migration}")" == "${EXPECTED_MOUNTS}" ]] \
  || fail "Expected the migration container to keep its mounts without the readiness check"
[[ "$(pod_volumes "${no_wait_render}")" == "${EXPECTED_VOLUMES}" ]] \
  || fail "Expected the writable volumes without the readiness check"

# Startup migrations replace the Job entirely. The whole chart is rendered, since --show-only errors on a
# template that renders nothing.
renders_migration_job() {
  local full_render
  full_render="$(helm template qa "${CHART_DIR}" --set formbricks.webappUrl=https://qa.example.com "$@")" \
    || fail "Rendering the chart failed"
  grep -qx '  name: formbricks-migration' <<<"${full_render}"
}
renders_migration_job || fail "Expected the full chart to render the migration Job by default"
if renders_migration_job --set migration.enabled=false; then
  fail "Expected no migration Job when migration.enabled=false"
fi
