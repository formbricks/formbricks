#!/usr/bin/env bash
# ENG-4008: a NodePort or LoadBalancer Service, or hostNetwork, reaches the app without the ingress, so a client
# writes its own X-Forwarded-For. The install notes must warn whenever that topology meets a non-zero
# TRUSTED_PROXY_HOP_COUNT, and stay quiet for the default ClusterIP install and for an operator who set it to 0.

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly CHART_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly COMMON_ARGS=(--set formbricks.webappUrl=https://qa.example.com)
readonly WARNING="Client IP addresses:"

temp_dir="$(mktemp -d)"
trap 'rm -rf "${temp_dir}"' EXIT

# shellcheck source=lib/notes.sh
source "${SCRIPT_DIR}/lib/notes.sh"
build_notes_chart "${temp_dir}"

expect_warning() {
  local case_name="$1"
  shift
  if ! render_notes client-ip "$@" | grep --fixed-strings "${WARNING}" >/dev/null; then
    printf '%s\n' "Install notes must warn about client IP spoofing: ${case_name}." >&2
    exit 1
  fi
}

expect_no_warning() {
  local case_name="$1"
  shift
  if render_notes client-ip "$@" | grep --fixed-strings "${WARNING}" >/dev/null; then
    printf '%s\n' "Install notes must not warn about client IP spoofing: ${case_name}." >&2
    exit 1
  fi
}

expect_no_warning "default ClusterIP Service"
expect_warning "LoadBalancer Service with the default hop count" --set service.type=LoadBalancer
expect_warning "NodePort Service with the default hop count" --set service.type=NodePort
expect_warning "LoadBalancer Service with a longer proxy chain" \
  --set service.type=LoadBalancer --set-string deployment.env.TRUSTED_PROXY_HOP_COUNT=2
# Removing the key leaves the application default, which is 1.
expect_warning "LoadBalancer Service with the hop count unset" \
  --set service.type=LoadBalancer --set deployment.env.TRUSTED_PROXY_HOP_COUNT=null
expect_warning "LoadBalancer Service with the hop count from a secret" \
  --set service.type=LoadBalancer --set deployment.env.TRUSTED_PROXY_HOP_COUNT.valueFrom.secretKeyRef.name=hops \
  --set deployment.env.TRUSTED_PROXY_HOP_COUNT.valueFrom.secretKeyRef.key=count
expect_warning "hostNetwork on a ClusterIP Service" --set deployment.hostNetwork=true
expect_no_warning "LoadBalancer Service with forwarding headers disabled (string)" \
  --set service.type=LoadBalancer --set-string deployment.env.TRUSTED_PROXY_HOP_COUNT=0
# A values file writes `TRUSTED_PROXY_HOP_COUNT: 0` as a number; the app also reads "00" as 0.
expect_no_warning "LoadBalancer Service with forwarding headers disabled (number)" \
  --set service.type=LoadBalancer --set deployment.env.TRUSTED_PROXY_HOP_COUNT=0
expect_no_warning "LoadBalancer Service with forwarding headers disabled (00)" \
  --set service.type=LoadBalancer --set-string deployment.env.TRUSTED_PROXY_HOP_COUNT=00
expect_no_warning "Service disabled" --set service.type=LoadBalancer --set service.enabled=false

printf '%s\n' "Client IP install-notes contracts are valid."
