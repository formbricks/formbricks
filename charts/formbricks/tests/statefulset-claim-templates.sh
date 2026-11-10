#!/usr/bin/env bash

# Kubernetes rejects any change to a StatefulSet's volumeClaimTemplates, so a chart upgrade fails if the
# rendered claim template changes between chart versions. Package the chart at two versions and assert that
# every claim template the chart itself renders is byte-identical and carries no version label.

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly OLD_VERSION="6.1.4"
readonly NEW_VERSION="9.8.7"
readonly STATEFULSET_TEMPLATES=(
  templates/redis-statefulset.yaml
  templates/hub-embeddings-background-statefulset.yaml
)

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

package_chart() {
  local version="$1"

  mkdir -p "${temp_dir}/${version}"
  helm package "${CHART_DIR}" --version "${version}" --app-version "${version}" \
    --destination "${temp_dir}/${version}" >/dev/null
}

# Prints the volumeClaimTemplates block of every StatefulSet in the render, in render order.
render_claim_templates() {
  local version="$1" template="$2"

  helm template qa "${temp_dir}/${version}/formbricks-${version}.tgz" \
    --set formbricks.webappUrl=https://qa.example.com \
    --set hub.embeddings.enabled=true \
    --set hub.embeddings.background.enabled=true \
    --show-only "${template}" |
    awk '
      /^---$/ { in_claims = 0; next }
      /^  volumeClaimTemplates:$/ { in_claims = 1 }
      in_claims && /^  [^ ]/ && !/^  volumeClaimTemplates:$/ { in_claims = 0 }
      in_claims { print }
    '
}

package_chart "${OLD_VERSION}"
package_chart "${NEW_VERSION}"

for template in "${STATEFULSET_TEMPLATES[@]}"; do
  old_claims="$(render_claim_templates "${OLD_VERSION}" "${template}")"
  new_claims="$(render_claim_templates "${NEW_VERSION}" "${template}")"

  if [[ -z "${old_claims}" ]]; then
    printf '%s rendered no volumeClaimTemplates; the test values no longer enable its persistence.\n' \
      "${template}" >&2
    exit 1
  fi

  if [[ "${old_claims}" != "${new_claims}" ]]; then
    printf '%s renders a different volumeClaimTemplates at chart %s and %s.\n' \
      "${template}" "${OLD_VERSION}" "${NEW_VERSION}" >&2
    printf 'Kubernetes rejects that change on upgrade.\n' >&2
    diff <(printf '%s\n' "${old_claims}") <(printf '%s\n' "${new_claims}") >&2 || true
    exit 1
  fi

  if grep -Eq 'helm\.sh/chart|app\.kubernetes\.io/version' <<<"${new_claims}" ||
    grep -Fq "${NEW_VERSION}" <<<"${new_claims}"; then
    printf '%s volumeClaimTemplates carries a chart or app version:\n%s\n' "${template}" "${new_claims}" >&2
    exit 1
  fi
done

# helm template cannot run lookup, so the upgrade path (reuse the live claim labels) is rendered from a copy of
# the chart whose lookup reads a stubbed live StatefulSet from values instead.
export LIVE_LOOKUP='lookup "apps/v1" "StatefulSet" .Release.Namespace (include "formbricks.redisMasterName" .)'
stub_chart="${temp_dir}/stub/formbricks"
mkdir -p "${temp_dir}/stub"
cp -R "${CHART_DIR}" "${stub_chart}"
if ! grep -Fq "${LIVE_LOOKUP}" "${stub_chart}/templates/redis-statefulset.yaml"; then
  printf '%s\n' 'templates/redis-statefulset.yaml no longer looks up the live StatefulSet as this test expects.' >&2
  exit 1
fi
perl -0pi -e 's/\Q$ENV{LIVE_LOOKUP}\E/(.Values.testLiveStatefulSet | default dict)/' \
  "${stub_chart}/templates/redis-statefulset.yaml"

# Prints the labels of the rendered redis-data claim template, one per line.
render_stubbed_claim_labels() {
  local live_values="$1"

  printf '%s\n' "${live_values}" >"${temp_dir}/live-values.yaml"
  helm template qa "${stub_chart}" \
    --set formbricks.webappUrl=https://qa.example.com \
    -f "${temp_dir}/live-values.yaml" \
    --show-only templates/redis-statefulset.yaml |
    awk '
      /^  volumeClaimTemplates:$/ { in_claims = 1 }
      in_claims && /^      spec:$/ { exit }
      in_claims && /^          [^ ]/ { sub(/^ +/, ""); print }
    '
}

live_labels="$(render_stubbed_claim_labels '
testLiveStatefulSet:
  spec:
    volumeClaimTemplates:
      - metadata:
          name: redis-data
          labels:
            helm.sh/chart: formbricks-6.1.4
            app.kubernetes.io/name: redis
            app.kubernetes.io/instance: qa
            app.kubernetes.io/component: redis')"
expected_live_labels='app.kubernetes.io/component: redis
app.kubernetes.io/instance: qa
app.kubernetes.io/name: redis
helm.sh/chart: formbricks-6.1.4'
if [[ "${live_labels}" != "${expected_live_labels}" ]]; then
  printf 'An upgrade must keep the live claim labels verbatim. Rendered:\n%s\n' "${live_labels}" >&2
  exit 1
fi

unlabelled_live_labels="$(render_stubbed_claim_labels '
testLiveStatefulSet:
  spec:
    volumeClaimTemplates:
      - metadata:
          name: redis-data')"
if [[ -n "${unlabelled_live_labels}" ]]; then
  printf 'A live claim template without labels must render none. Rendered:\n%s\n' "${unlabelled_live_labels}" >&2
  exit 1
fi

printf '%s\n' 'StatefulSet volumeClaimTemplates are stable across chart versions and keep live labels on upgrade.'
