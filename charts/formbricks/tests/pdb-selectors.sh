#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

rendered_pdbs="$(helm template qa "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set hub.pdb.enabled=true \
  --set hub.worker.pdb.enabled=true \
  --set hub.embeddings.enabled=true \
  --set hub.embeddings.pdb.enabled=true \
  --set taxonomy.enabled=true \
  --set taxonomy.pdb.enabled=true \
  --set taxonomy.llm.model=test-model \
  --set taxonomy.llm.baseUrl=https://llm.example.com/v1 \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/hub-pdb.yaml)"

assert_pdb_component() {
  local component="$1"
  local count

  count="$(grep -Ec "^[[:space:]]+app.kubernetes.io/component: ${component}$" <<<"${rendered_pdbs}" || true)"
  if [[ "${count}" -ne 2 ]]; then
    printf 'Expected PDB metadata and selector to identify component %s; found %s matches\n' \
      "${component}" "${count}" >&2
    exit 1
  fi
}

for component in hub hub-worker hub-embeddings taxonomy; do
  assert_pdb_component "${component}"
done

if grep -q 'app.kubernetes.io/component: hub-migration' <<<"${rendered_pdbs}"; then
  printf '%s\n' 'Hub migration pods must not be selected by a PodDisruptionBudget.' >&2
  exit 1
fi

rendered_workloads="$(helm template qa "${CHART_DIR}" \
  --set formbricks.webappUrl=https://qa.example.com \
  --set hub.embeddings.enabled=true \
  --set taxonomy.enabled=true \
  --set taxonomy.llm.model=test-model \
  --set taxonomy.llm.baseUrl=https://llm.example.com/v1 \
  --set-string taxonomy.llm.contextWindowTokens=65536 \
  --show-only templates/hub-deployment.yaml \
  --show-only templates/hub-worker-deployment.yaml \
  --show-only templates/hub-embeddings-deployment.yaml \
  --show-only templates/taxonomy-deployment.yaml \
  --show-only templates/hub-migration-job.yaml)"

for component in hub hub-worker hub-embeddings taxonomy hub-migration; do
  if ! grep -q "app.kubernetes.io/component: ${component}$" <<<"${rendered_workloads}"; then
    printf 'Expected rendered workload component label %s\n' "${component}" >&2
    exit 1
  fi
done
