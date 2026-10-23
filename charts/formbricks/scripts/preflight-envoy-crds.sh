#!/usr/bin/env bash
# Read-only prerequisite check for the Envoy Gateway v1.8.4 dependency.
set -euo pipefail

usage() {
  printf 'Usage: %s --context KUBECTL_CONTEXT\n' "${0##*/}" >&2
}

if [[ "${1:-}" == "--help" && "$#" -eq 1 ]]; then
  usage
  exit 0
fi
if [[ "$#" -ne 2 || "$1" != "--context" || -z "$2" || "$2" == -* ]]; then
  usage
  exit 2
fi
context="$2"

for binary in kubectl jq; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$binary" >&2
    exit 2
  fi
done

if ! crds_json="$(kubectl --context "$context" get customresourcedefinitions -o json 2>&1)"; then
  printf 'Cannot read CRDs in context %s (check connectivity and get/list CRD permission):\n%s\n' \
    "$context" "$crds_json" >&2
  exit 1
fi
if ! jq -e '.items | type == "array"' <<<"$crds_json" >/dev/null 2>&1; then
  printf 'The Kubernetes API returned an invalid CRD list for context %s.\n' "$context" >&2
  exit 1
fi

failures=0
gateway_channel=""
check_crd() {
  local name="$1" version="$2" family="$3" annotations channel bundle
  if ! jq -e --arg name "$name" '.items | any(.metadata.name == $name)' <<<"$crds_json" >/dev/null; then
    printf 'Missing %s CRD: %s\n' "$family" "$name" >&2
    failures=$((failures + 1))
    return
  fi
  if ! jq -e --arg name "$name" '.items[] | select(.metadata.name == $name) |
    any(.status.conditions[]?; .type == "Established" and .status == "True")' \
    <<<"$crds_json" >/dev/null; then
    printf 'CRD is not Established: %s\n' "$name" >&2
    failures=$((failures + 1))
  fi
  if ! jq -e --arg name "$name" --arg version "$version" '.items[] |
    select(.metadata.name == $name) | any(.spec.versions[]?; .name == $version and .served == true)' \
    <<<"$crds_json" >/dev/null; then
    printf 'CRD %s does not serve %s.\n' "$name" "$version" >&2
    failures=$((failures + 1))
  fi
  if [[ "$family" == "Gateway API" ]]; then
    bundle="$(jq -r --arg name "$name" '.items[] | select(.metadata.name == $name) |
      .metadata.annotations["gateway.networking.k8s.io/bundle-version"] // ""' <<<"$crds_json")"
    channel="$(jq -r --arg name "$name" '.items[] | select(.metadata.name == $name) |
      .metadata.annotations["gateway.networking.k8s.io/channel"] // ""' <<<"$crds_json")"
    if [[ "$bundle" != "v1.5.1" ]]; then
      printf 'Gateway API CRD %s has unverified bundle version %s; only v1.5.1 is verified with bundled Envoy Gateway v1.8.4.\n' \
        "$name" "${bundle:-<missing>}" >&2
      failures=$((failures + 1))
    fi
    if [[ "$channel" != "standard" && "$channel" != "experimental" ]]; then
      printf 'Gateway API CRD %s has invalid or missing channel %s.\n' "$name" "${channel:-<missing>}" >&2
      failures=$((failures + 1))
    elif [[ -n "$gateway_channel" && "$channel" != "$gateway_channel" ]]; then
      printf 'Gateway API CRD %s uses channel %s, but the other CRDs use %s.\n' \
        "$name" "$channel" "$gateway_channel" >&2
      failures=$((failures + 1))
    else
      gateway_channel="$channel"
    fi
  fi
}

# Envoy Gateway v1.8.4 watches these Gateway API types even when Formbricks uses only a subset.
gateway_crds=(
  backendtlspolicies gatewayclasses gateways grpcroutes httproutes listenersets referencegrants tlsroutes
)
for plural in "${gateway_crds[@]}"; do
  check_crd "${plural}.gateway.networking.k8s.io" v1 "Gateway API"
done

envoy_crds=(
  backends backendtrafficpolicies clienttrafficpolicies envoyextensionpolicies
  envoypatchpolicies envoyproxies httproutefilters securitypolicies
)
for plural in "${envoy_crds[@]}"; do
  check_crd "${plural}.gateway.envoyproxy.io" v1alpha1 "Envoy Gateway"
done

if (( failures > 0 )); then
  printf '%d prerequisite check(s) failed. Ask the CRD owner to provision a compatible Gateway API v1.5.1 bundle and Envoy Gateway v1.8.4 CRDs before installing or upgrading Formbricks.\n' \
    "$failures" >&2
  exit 1
fi
printf 'Envoy CRD preflight passed in context %s: Gateway API v1.5.1 (%s) and Envoy Gateway v1.8.4 CRDs are Established and serve the required APIs.\n' \
  "$context" "$gateway_channel"
