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

printf '%s\n' 'StatefulSet volumeClaimTemplates are stable across chart versions.'
