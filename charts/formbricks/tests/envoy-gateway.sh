#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chart_dir="$(cd "${script_dir}/.." && pwd)"
render_dir="$(mktemp -d)"
trap 'rm -rf "${render_dir}"' EXIT

common_args=(
  --set formbricks.webappUrl=https://qa.example.com
  --set envoy.enabled=true
  --set envoy.controller.enabled=true
  --set envoyRedis.enabled=true
  --set envoy.formbricks.routes.feedbackRecords=true
)

grep -A2 'name: gateway-helm' "${chart_dir}/Chart.lock" | grep -q 'version: v1.8.4'
test -f "${chart_dir}/charts/gateway-helm-v1.8.4.tgz"
test ! -f "${chart_dir}/charts/gateway-helm-v1.7.1.tgz"

if ! helm lint "${chart_dir}" "${common_args[@]}" > "${render_dir}/lint.log" 2>&1; then
  cat "${render_dir}/lint.log" >&2
  exit 1
fi

helm template qa "${chart_dir}" --include-crds "${common_args[@]}" > "${render_dir}/bundled.yaml"

grep -q 'gateway.networking.k8s.io/bundle-version: v1.5.1' "${render_dir}/bundled.yaml"
grep -q 'name: backendtlspolicies.gateway.networking.k8s.io' "${render_dir}/bundled.yaml"
grep -q 'name: envoyproxies.gateway.envoyproxy.io' "${render_dir}/bundled.yaml"
if grep -q '^kind: ValidatingAdmissionPolicy' "${render_dir}/bundled.yaml"; then
  echo "Cluster-wide safe-upgrade policies must be opt-in" >&2
  exit 1
fi
grep -q 'image: docker.io/envoyproxy/gateway:v1.8.4' "${render_dir}/bundled.yaml"
grep -q '^kind: EnvoyProxy$' "${render_dir}/bundled.yaml"
grep -q '^kind: SecurityPolicy$' "${render_dir}/bundled.yaml"
grep -q 'statusOnError: 503' "${render_dir}/bundled.yaml"

helm template qa "${chart_dir}" --include-crds "${common_args[@]}" \
  --set envoy.crds.gatewayAPI.safeUpgradePolicy.enabled=true > "${render_dir}/safe-policy.yaml"

grep -B1 '^kind: ValidatingAdmissionPolicy$' "${render_dir}/safe-policy.yaml" \
  | grep -q '^apiVersion: admissionregistration.k8s.io/v1$'
grep -B1 '^kind: ValidatingAdmissionPolicyBinding$' "${render_dir}/safe-policy.yaml" \
  | grep -q '^apiVersion: admissionregistration.k8s.io/v1$'

helm template qa "${chart_dir}" "${common_args[@]}" \
  --set envoy.deployment.pod.nodeSelector.formbricks-test=scheduling-path \
  --set 'envoy.deployment.ports[0].name=grpc-custom' \
  --set 'envoy.deployment.ports[0].port=28000' \
  --set 'envoy.deployment.ports[0].targetPort=18000' > "${render_dir}/controller-overrides.yaml"

grep -q 'formbricks-test: scheduling-path' "${render_dir}/controller-overrides.yaml"
grep -A2 'name: grpc-custom' "${render_dir}/controller-overrides.yaml" | grep -q 'port: 28000'
grep -A2 'name: grpc-custom' "${render_dir}/controller-overrides.yaml" | grep -q 'targetPort: 18000'

helm template qa "${chart_dir}" --include-crds "${common_args[@]}" \
  --set envoy.crds.enabled=false > "${render_dir}/platform-crds.yaml"

if grep -q 'name: backendtlspolicies.gateway.networking.k8s.io' "${render_dir}/platform-crds.yaml"; then
  echo "Platform-managed Gateway API CRDs must not be rendered" >&2
  exit 1
fi
if grep -q 'name: envoyproxies.gateway.envoyproxy.io' "${render_dir}/platform-crds.yaml"; then
  echo "Platform-managed Envoy Gateway CRDs must not be rendered" >&2
  exit 1
fi
if grep -q '^kind: ValidatingAdmissionPolicy' "${render_dir}/platform-crds.yaml"; then
  echo "Platform-managed safe-upgrade policies must not be rendered" >&2
  exit 1
fi
grep -q 'image: docker.io/envoyproxy/gateway:v1.8.4' "${render_dir}/platform-crds.yaml"
grep -q '^kind: Gateway$' "${render_dir}/platform-crds.yaml"
grep -q '^kind: SecurityPolicy$' "${render_dir}/platform-crds.yaml"
grep -q 'statusOnError: 503' "${render_dir}/platform-crds.yaml"

helm template qa "${chart_dir}" --include-crds \
  --set formbricks.webappUrl=https://qa.example.com \
  --set envoy.enabled=true \
  --set envoy.controller.enabled=false \
  --set envoy.crds.enabled=false \
  --set envoy.formbricks.gatewayClass.create=false \
  --set envoy.formbricks.gatewayClass.name=platform-envoy \
  --set envoy.formbricks.routes.feedbackRecords=true > "${render_dir}/external-controller.yaml"

if grep -q 'image: docker.io/envoyproxy/gateway:v1.8.4' "${render_dir}/external-controller.yaml"; then
  echo "External-controller mode must not render the bundled controller" >&2
  exit 1
fi
grep -q 'gatewayClassName: platform-envoy' "${render_dir}/external-controller.yaml"
grep -q '^kind: EnvoyProxy$' "${render_dir}/external-controller.yaml"
grep -q '^kind: SecurityPolicy$' "${render_dir}/external-controller.yaml"

echo "Envoy Gateway Helm validation passed"
