#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

render() {
  helm template qa "${CHART_DIR}" \
    --set formbricks.webappUrl=https://qa.example.com \
    --set taxonomy.enabled=true \
    --set taxonomy.llm.baseUrl=https://llm.example.com/v1 \
    --set-string taxonomy.llm.contextWindowTokens=65536 \
    --show-only templates/taxonomy-deployment.yaml \
    "$@"
}

expect_line() {
  grep -qxF -- "$2" <<<"$1" || {
    printf 'Missing %s: %s\n' "$3" "$2" >&2
    exit 1
  }
}

default_render="$(render)"
for line in \
  '        fsGroup: 65532' \
  '        seccompProfile:' \
  '          type: RuntimeDefault' \
  '            allowPrivilegeEscalation: false' \
  '            capabilities:' \
  '              - ALL' \
  '            readOnlyRootFilesystem: true' \
  '            runAsGroup: 65532' \
  '            runAsNonRoot: true' \
  '            runAsUser: 65532' \
  '              mountPath: /tmp' \
  '          emptyDir: {}' \
  '            - name: UV_CACHE_DIR' \
  '              value: "/tmp/uv-cache"'; do
  expect_line "${default_render}" "${line}" 'default taxonomy hardening'
done
test "$(grep -c 'name: taxonomy-tmp$' <<<"${default_render}")" -eq 2
test "$(grep -c 'mountPath: /tmp$' <<<"${default_render}")" -eq 1

legacy_render="$(render --set taxonomy.image.tag=v0.1.0)"
expect_line "${legacy_render}" '          image: "ghcr.io/formbricks/taxonomy:v0.1.0"' 'legacy image override'
expect_line "${legacy_render}" '              value: "/tmp/uv-cache"' 'legacy uv cache'

override_render="$(render \
  --set taxonomy.podSecurityContext.fsGroup=2000 \
  --set taxonomy.securityContext.runAsUser=2000 \
  --set taxonomy.securityContext.runAsGroup=2000 \
  --set taxonomy.securityContext.readOnlyRootFilesystem=false \
  --set taxonomy.env.UV_CACHE_DIR=/custom/uv-cache)"
for line in \
  '        fsGroup: 2000' \
  '            runAsUser: 2000' \
  '            runAsGroup: 2000' \
  '            readOnlyRootFilesystem: false' \
  '              value: "/custom/uv-cache"'; do
  expect_line "${override_render}" "${line}" 'operator override'
done
if grep -qE 'name: taxonomy-tmp$|mountPath: /tmp$|emptyDir: \{\}' <<<"${override_render}"; then
  printf 'Writable taxonomy root should not receive a /tmp volume\n' >&2
  exit 1
fi

null_context_render="$(render --set taxonomy.securityContext=null)"
if grep -qE '^          securityContext:|name: taxonomy-tmp$|mountPath: /tmp$' <<<"${null_context_render}"; then
  printf 'Null taxonomy container context should render no context or /tmp volume\n' >&2
  exit 1
fi
