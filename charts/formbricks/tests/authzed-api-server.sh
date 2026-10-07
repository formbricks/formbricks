#!/usr/bin/env bash
# Validate the default bundled operator against an isolated API server, not only YAML rendering.
set -euo pipefail

readonly CHART_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly KIND_VERSION=v0.33.0
readonly NODE_IMAGE='kindest/node:v1.34.11@sha256:44e222ee2132dab25ff87301682f89eb82c7880ea3a1bf543bfe9708fd08d67d'
readonly CLUSTER_NAME="formbricks-chart-test-$$-${RANDOM}"
temp_dir="$(mktemp -d)"
# Never read or modify the operator's kubeconfig/current cluster.
export KUBECONFIG="${temp_dir}/kubeconfig"

cleanup() {
  if [[ -x "${temp_dir}/kind" ]]; then
    "${temp_dir}/kind" delete cluster --name "${CLUSTER_NAME}" >/dev/null 2>&1 || true
  fi
  rm -rf "${temp_dir}"
}
trap cleanup EXIT

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)
    platform=linux-amd64
    checksum=aee6151561422756b764a4ae28e7f44cda5af5a9eead3cc9985112b1de8d8e0d
    ;;
  Darwin-arm64)
    platform=darwin-arm64
    checksum=0c8c7dbe5e23594a198b786c4bc13dacc101fa6196b0cb0b23a1ca44e61f4b4f
    ;;
  *) printf '%s\n' 'This pinned API-server check supports Linux x64 and macOS arm64.' >&2; exit 1 ;;
esac
curl --fail --silent --show-error --location --retry 3 \
  "https://github.com/kubernetes-sigs/kind/releases/download/${KIND_VERSION}/kind-${platform}" \
  --output "${temp_dir}/kind"
printf '%s  %s\n' "${checksum}" "${temp_dir}/kind" | shasum -a 256 --check
chmod 700 "${temp_dir}/kind"
"${temp_dir}/kind" create cluster --name "${CLUSTER_NAME}" --image "${NODE_IMAGE}" --wait 120s

render_operator() {
  helm template qa "${CHART_DIR}" --namespace default \
    --set formbricks.webappUrl=https://qa.example.com \
    --show-only charts/spicedbOperator/templates/configmap.yaml \
    --show-only charts/spicedbOperator/templates/serviceaccount.yaml \
    --show-only charts/spicedbOperator/templates/rbac.yaml \
    --show-only charts/spicedbOperator/templates/service.yaml \
    --show-only charts/spicedbOperator/templates/deployment.yaml "$@"
}

# Positive baseline: the defaults must emit all six objects, without a name override in the test.
render_operator >"${temp_dir}/operator.yaml"
test "$(grep -c '^kind:' "${temp_dir}/operator.yaml")" -eq 6
kubectl --context "kind-${CLUSTER_NAME}" create --dry-run=server --validate=strict \
  -f "${temp_dir}/operator.yaml"

# Prove the API server catches the original bug, so this cannot pass on an empty render.
render_operator --set-string spicedbOperator.nameOverride= >"${temp_dir}/invalid.yaml"
if kubectl --context "kind-${CLUSTER_NAME}" create --dry-run=server --validate=strict \
  -f "${temp_dir}/invalid.yaml" >"${temp_dir}/rejected.log" 2>&1; then
  printf '%s\n' 'Expected the original camelCase operator names to be rejected.' >&2
  exit 1
fi
grep -Eq 'RFC 1123|RFC 1035' "${temp_dir}/rejected.log"
printf '%s\n' 'Default operator resources passed API-server validation; original invalid names were rejected.'
