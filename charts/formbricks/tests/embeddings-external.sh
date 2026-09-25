#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

render_dir="$(mktemp -d)"
trap 'rm -rf "${render_dir}"' EXIT

helm template bundled-embeddings "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set hub.embeddings.enabled=true \
  --set hub.embeddings.auth.existingSecret=formbricks-embeddings \
  --set hub.embeddings.background.enabled=true \
  >"${render_dir}/bundled.yaml"

test "$(grep -c 'name: RUST_LOG' "${render_dir}/bundled.yaml")" -eq 2
test "$(grep -A1 'name: RUST_LOG' "${render_dir}/bundled.yaml" | grep -Ec 'value: "?warn"?$')" -eq 2

helm template bundled-embeddings-debug "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set hub.embeddings.enabled=true \
  --set-string hub.embeddings.env.RUST_LOG=debug \
  >"${render_dir}/bundled-debug.yaml"

grep -A1 'name: RUST_LOG' "${render_dir}/bundled-debug.yaml" | grep -Eq 'value: "?debug"?$'

helm template external-embeddings "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set hub.worker.enabled=true \
  --set hub.embeddings.enabled=true \
  --set hub.embeddings.deployRuntime=false \
  --set-string hub.embeddings.baseUrl=https://embeddings.example.com/v1 \
  --set hub.embeddings.auth.existingSecret=formbricks-embeddings \
  --set hub.embeddings.background.enabled=true \
  --set-string hub.embeddings.background.baseUrl=https://embeddings-worker.example.com/v1 \
  >"${render_dir}/external.yaml"

test "$(grep -c 'name: EMBEDDING_BASE_URL' "${render_dir}/external.yaml")" -eq 2
grep -A1 'name: EMBEDDING_BASE_URL' "${render_dir}/external.yaml" \
  | grep -q 'value: "https://embeddings.example.com/v1"'
grep -A1 'name: EMBEDDING_BASE_URL' "${render_dir}/external.yaml" \
  | grep -q 'value: "https://embeddings-worker.example.com/v1"'
test "$(grep -c 'name: formbricks-embeddings' "${render_dir}/external.yaml")" -eq 2

if grep -Eq 'app.kubernetes.io/component: hub-embeddings(-background)?$' "${render_dir}/external.yaml"; then
  printf '%s\n' 'External embeddings must not render bundled TEI resources.' >&2
  exit 1
fi

if helm template external-missing-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set hub.embeddings.enabled=true \
  --set hub.embeddings.deployRuntime=false \
  >"${render_dir}/missing-url.yaml" 2>&1; then
  printf '%s\n' 'Expected external embeddings without baseUrl to fail.' >&2
  exit 1
fi
grep -q 'hub.embeddings.baseUrl is required' "${render_dir}/missing-url.yaml"

if helm template external-missing-background-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set hub.embeddings.enabled=true \
  --set hub.embeddings.deployRuntime=false \
  --set-string hub.embeddings.baseUrl=https://embeddings.example.com/v1 \
  --set hub.embeddings.background.enabled=true \
  >"${render_dir}/missing-background-url.yaml" 2>&1; then
  printf '%s\n' 'Expected external background embeddings without background.baseUrl to fail.' >&2
  exit 1
fi
grep -q 'hub.embeddings.background.baseUrl is required' "${render_dir}/missing-background-url.yaml"

printf '%s\n' 'External embeddings contracts are valid.'
