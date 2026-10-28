#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
preflight="${script_dir}/../scripts/preflight-envoy-crds.sh"
temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT
mkdir -p "${temp_dir}/scripts"
cp "$preflight" "${temp_dir}/scripts/preflight-envoy-crds.sh"
preflight="${temp_dir}/scripts/preflight-envoy-crds.sh"

python3 - "${temp_dir}/valid.json" <<'PY'
import json
import sys

gateway = "backendtlspolicies gatewayclasses gateways grpcroutes httproutes listenersets referencegrants tlsroutes".split()
envoy = "backends backendtrafficpolicies clienttrafficpolicies envoyextensionpolicies envoypatchpolicies envoyproxies httproutefilters securitypolicies".split()
items = []
for family, names, group, version in (
    ("gateway", gateway, "gateway.networking.k8s.io", "v1"),
    ("envoy", envoy, "gateway.envoyproxy.io", "v1alpha1"),
):
    for name in names:
        annotations = (
            {"gateway.networking.k8s.io/bundle-version": "v1.5.1", "gateway.networking.k8s.io/channel": "standard"}
            if family == "gateway" else {}
        )
        envoy_schema = {"type": "object", "description": f"{name} fixture"}
        version_spec = {"name": version, "served": True}
        if family == "envoy":
            version_spec["schema"] = {"openAPIV3Schema": envoy_schema}
        items.append({
            "metadata": {"name": f"{name}.{group}", "annotations": annotations},
            "spec": {"versions": [version_spec]},
            "status": {"conditions": [{"type": "Established", "status": "True"}]},
        })
with open(sys.argv[1], "w", encoding="utf-8") as output:
    json.dump({"items": items}, output)
PY

jq -r '.items[] | select(.metadata.name | endswith(".gateway.envoyproxy.io")) | .metadata.name' \
  "${temp_dir}/valid.json" | while IFS= read -r crd_name; do
    crd_schema="$(jq -cS --arg name "$crd_name" '.items[] | select(.metadata.name == $name) |
      .spec.versions[] | select(.name == "v1alpha1") | .schema.openAPIV3Schema' \
      "${temp_dir}/valid.json")"
    crd_hash="$(printf '%s' "$crd_schema" | shasum -a 256 | awk '{print $1}')"
    printf '%s %s\n' "$crd_name" "$crd_hash"
  done >"${temp_dir}/scripts/envoy-v1.8.4-crd-schemas.sha256"

cat > "${temp_dir}/kubectl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" != "--context fixture get customresourcedefinitions -o json" ]]; then
  printf 'Unexpected or mutating kubectl command: %s\n' "$*" >&2
  exit 20
fi
case "${FAKE_KUBECTL_ERROR:-}" in
  forbidden)
    printf 'Error from server (Forbidden): cannot list customresourcedefinitions\n' >&2
    exit 1
    ;;
  unavailable)
    printf 'The connection to the server was refused\n' >&2
    exit 1
    ;;
esac
cat "$FAKE_CRDS"
STUB
chmod +x "${temp_dir}/kubectl"
export PATH="${temp_dir}:${PATH}"
export FAKE_CRDS="${temp_dir}/valid.json"
"$preflight" --context fixture >"${temp_dir}/positive.log"
grep -q 'Gateway API v1.5.1 (standard)' "${temp_dir}/positive.log"
jq '(.items[] | select(.metadata.name | endswith(".gateway.networking.k8s.io")) |
  .metadata.annotations["gateway.networking.k8s.io/channel"]) = "experimental"' \
  "${temp_dir}/valid.json" >"${temp_dir}/experimental.json"
FAKE_CRDS="${temp_dir}/experimental.json" "$preflight" --context fixture \
  >"${temp_dir}/experimental.log"
grep -q 'Gateway API v1.5.1 (experimental)' "${temp_dir}/experimental.log"

expect_failure() {
  local fixture="$1" expected="$2"
  export FAKE_CRDS="$fixture"
  if "$preflight" --context fixture >"${temp_dir}/result.log" 2>&1; then
    printf 'Expected preflight to reject %s\n' "$fixture" >&2
    exit 1
  fi
  grep -Fq "$expected" "${temp_dir}/result.log"
}

jq 'del(.items[] | select(.metadata.name == "envoyproxies.gateway.envoyproxy.io"))' \
  "${temp_dir}/valid.json" >"${temp_dir}/missing.json"
expect_failure "${temp_dir}/missing.json" 'Missing Envoy Gateway CRD: envoyproxies.gateway.envoyproxy.io'
jq 'del(.items[] | select(.metadata.name == "httproutes.gateway.networking.k8s.io"))' \
  "${temp_dir}/valid.json" >"${temp_dir}/missing-gateway.json"
expect_failure "${temp_dir}/missing-gateway.json" 'Missing Gateway API CRD: httproutes.gateway.networking.k8s.io'

jq '(.items[] | select(.metadata.name == "listenersets.gateway.networking.k8s.io") |
  .spec.versions[0].served) = false' "${temp_dir}/valid.json" >"${temp_dir}/unserved.json"
expect_failure "${temp_dir}/unserved.json" 'does not serve v1'

jq '(.items[] | select(.metadata.name == "securitypolicies.gateway.envoyproxy.io") |
  .spec.versions[0].schema.openAPIV3Schema.description) = "another Envoy release"' \
  "${temp_dir}/valid.json" >"${temp_dir}/envoy-schema.json"
expect_failure "${temp_dir}/envoy-schema.json" \
  'securitypolicies.gateway.envoyproxy.io has an unverified v1.8.4 schema'

jq '(.items[] | select(.metadata.name == "gateways.gateway.networking.k8s.io") |
  .metadata.annotations["gateway.networking.k8s.io/bundle-version"]) = "v1.4.1"' \
  "${temp_dir}/valid.json" >"${temp_dir}/version.json"
expect_failure "${temp_dir}/version.json" 'unverified bundle version v1.4.1'

jq '(.items[] | select(.metadata.name == "httproutes.gateway.networking.k8s.io") |
  .metadata.annotations["gateway.networking.k8s.io/channel"]) = "experimental"' \
  "${temp_dir}/valid.json" >"${temp_dir}/channel.json"
expect_failure "${temp_dir}/channel.json" 'but the other CRDs use standard'

export FAKE_CRDS="${temp_dir}/valid.json"
export FAKE_KUBECTL_ERROR=forbidden
expect_failure "${temp_dir}/valid.json" 'check connectivity and get/list CRD permission'
export FAKE_KUBECTL_ERROR=unavailable
expect_failure "${temp_dir}/valid.json" 'The connection to the server was refused'
unset FAKE_KUBECTL_ERROR

echo 'Envoy CRD preflight fixtures passed'
