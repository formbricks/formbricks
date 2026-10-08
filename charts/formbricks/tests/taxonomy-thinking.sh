#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
render_dir="$(mktemp -d)"
trap 'rm -rf "${render_dir}"' EXIT

render() {
  helm template qa "${CHART_DIR}" \
    --set formbricks.webappUrl=https://qa.example.com \
    --set taxonomy.enabled=true \
    --set taxonomy.llm.provider=vertex-gemini \
    --set taxonomy.llm.model=gemini-3.5-flash \
    --set taxonomy.llm.vertex.project=test-project \
    --set taxonomy.llm.vertex.existingSecret=test-credentials \
    --set taxonomy.llm.vertex.location=eu \
    --set-string taxonomy.llm.contextWindowTokens=1048576 \
    --show-only templates/taxonomy-deployment.yaml "$@"
}

render >"${render_dir}/legacy.yaml"
grep -A1 'name: TAXONOMY_VERTEX_THINKING_BUDGET' "${render_dir}/legacy.yaml" | grep -q 'value: "0"'
! grep -q 'name: TAXONOMY_VERTEX_THINKING_LEVEL' "${render_dir}/legacy.yaml"

for level in minimal low medium high; do
  render --set "taxonomy.llm.vertex.thinkingLevel=${level}" >"${render_dir}/level.yaml"
  grep -A1 'name: TAXONOMY_VERTEX_THINKING_LEVEL' "${render_dir}/level.yaml" | grep -q "value: \"${level}\""
  ! grep -q 'name: TAXONOMY_VERTEX_THINKING_BUDGET' "${render_dir}/level.yaml"
done

if render --set taxonomy.llm.vertex.thinkingLevel=automatic >"${render_dir}/invalid.yaml" 2>&1; then
  echo 'Expected an invalid thinking level to fail.' >&2
  exit 1
fi
grep -q 'thinkingLevel must be' "${render_dir}/invalid.yaml"

if render --set taxonomy.env.TAXONOMY_VERTEX_THINKING_LEVEL=medium >"${render_dir}/override.yaml" 2>&1; then
  echo 'Expected a managed thinking-level env override to fail.' >&2
  exit 1
fi
grep -q 'set taxonomy.llm.vertex.thinkingLevel instead' "${render_dir}/override.yaml"
