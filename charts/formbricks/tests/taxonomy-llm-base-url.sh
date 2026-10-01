#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

render_dir="$(mktemp -d)"
trap 'rm -rf "${render_dir}"' EXIT

helm template taxonomy-explicit-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set taxonomy.enabled=true \
  --set-string taxonomy.llm.baseUrl=https://llm.example.com/v1 \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/explicit.yaml"

test "$(grep -c 'name: TAXONOMY_LLM_BASE_URL' "${render_dir}/explicit.yaml")" -eq 1
grep -A1 'name: TAXONOMY_LLM_BASE_URL' "${render_dir}/explicit.yaml" \
  | grep -q 'value: "https://llm.example.com/v1"'
grep -A1 'name: TAXONOMY_MAX_RECORDS' "${render_dir}/explicit.yaml" | grep -q 'value: "10000"'

helm template taxonomy-templated-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set taxonomy.enabled=true \
  --set-json 'taxonomy.llm.baseUrl="http://{{ .Release.Name }}-llm:8000/v1"' \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/templated.yaml"

grep -A1 'name: TAXONOMY_LLM_BASE_URL' "${render_dir}/templated.yaml" \
  | grep -q 'value: "http://taxonomy-templated-url-llm:8000/v1"'

helm template taxonomy-bundled "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set llm.enabled=true \
  --set taxonomy.enabled=true \
  --set-string taxonomy.llm.contextWindowTokens=8192 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/bundled.yaml"

grep -A1 'name: TAXONOMY_LLM_BASE_URL' "${render_dir}/bundled.yaml" \
  | grep -q 'value: "http://taxonomy-bundled-router-service:8000/v1"'

# An explicit baseUrl wins over the bundled router, and the bundled maxModelLen guard (8192 by
# default) does not apply to it.
helm template taxonomy-explicit-over-bundled "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set llm.enabled=true \
  --set taxonomy.enabled=true \
  --set-string taxonomy.llm.baseUrl=https://llm.example.com/v1 \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/explicit-over-bundled.yaml"

test "$(grep -c 'name: TAXONOMY_LLM_BASE_URL' "${render_dir}/explicit-over-bundled.yaml")" -eq 1
grep -A1 'name: TAXONOMY_LLM_BASE_URL' "${render_dir}/explicit-over-bundled.yaml" \
  | grep -q 'value: "https://llm.example.com/v1"'
if grep -q 'router-service' "${render_dir}/explicit-over-bundled.yaml"; then
  printf '%s\n' 'An explicit taxonomy.llm.baseUrl must take precedence over the bundled router.' >&2
  exit 1
fi

if helm template taxonomy-missing-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set taxonomy.enabled=true \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/missing-url.yaml" 2>&1; then
  printf '%s\n' 'Expected openai-compatible taxonomy without baseUrl or llm.enabled to fail.' >&2
  exit 1
fi
grep -q "taxonomy.llm.baseUrl or llm.enabled=true is required when taxonomy.llm.provider is 'openai-compatible'" \
  "${render_dir}/missing-url.yaml"

if helm template taxonomy-empty-templated-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set taxonomy.enabled=true \
  --set-json 'taxonomy.llm.baseUrl="{{ .Values.taxonomy.llm.missingBaseUrl }}"' \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/empty-templated-url.yaml" 2>&1; then
  printf '%s\n' 'Expected a taxonomy.llm.baseUrl template that renders empty to fail.' >&2
  exit 1
fi
grep -q "taxonomy.llm.baseUrl must render to a non-empty URL when taxonomy.llm.provider is 'openai-compatible'" \
  "${render_dir}/empty-templated-url.yaml"

if helm template taxonomy-blank-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set taxonomy.enabled=true \
  --set-string 'taxonomy.llm.baseUrl=  ' \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/blank-url.yaml" 2>&1; then
  printf '%s\n' 'Expected a whitespace-only taxonomy.llm.baseUrl to fail.' >&2
  exit 1
fi
grep -q "taxonomy.llm.baseUrl must render to a non-empty URL when taxonomy.llm.provider is 'openai-compatible'" \
  "${render_dir}/blank-url.yaml"

if helm template taxonomy-empty-bundled-url "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set llm.enabled=true \
  --set-json 'llm.formbricks.baseUrl="{{ .Values.llm.formbricks.missingBaseUrl }}"' \
  --set taxonomy.enabled=true \
  --set-string taxonomy.llm.contextWindowTokens=8192 \
  --show-only templates/taxonomy-deployment.yaml \
  >"${render_dir}/empty-bundled-url.yaml" 2>&1; then
  printf '%s\n' 'Expected an llm.formbricks.baseUrl template that renders empty to fail.' >&2
  exit 1
fi
grep -q 'llm.formbricks.baseUrl must render to a non-empty URL when taxonomy uses the bundled vLLM router' \
  "${render_dir}/empty-bundled-url.yaml"

printf '%s\n' 'Taxonomy LLM base URL contracts are valid.'
