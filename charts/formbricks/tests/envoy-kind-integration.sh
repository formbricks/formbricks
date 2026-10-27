#!/usr/bin/env bash
# Full-stack Helm lifecycle against externally owned Gateway API Standard CRDs.
set -euo pipefail

readonly CHART_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly KIND_VERSION=v0.33.0
readonly NODE_IMAGE='kindest/node:v1.34.11@sha256:44e222ee2132dab25ff87301682f89eb82c7880ea3a1bf543bfe9708fd08d67d'
readonly CLUSTER_NAME="formbricks-envoy-$$-${RANDOM}"
readonly NAMESPACE=formbricks
readonly VALUES="${CHART_DIR}/tests/fixtures/envoy-full-stack.yaml"
temp_dir="$(mktemp -d)"
export KUBECONFIG="${temp_dir}/kubeconfig"
kind_bin="${temp_dir}/kind"
context="kind-${CLUSTER_NAME}"

kubectl_test() { kubectl --context "$context" "$@"; }

diagnostics() {
  printf '\nHelm releases:\n' >&2
  helm list -A >&2 || true
  printf '\nPod state:\n' >&2
  kubectl_test get pods -A -o wide >&2 || true
  printf '\nJobs and Gateway state:\n' >&2
  kubectl_test get jobs,gateways,httproutes,backendtrafficpolicies,securitypolicies -A >&2 || true
  kubectl_test get gatewayclasses,gateways,httproutes,backendtrafficpolicies,securitypolicies -A -o yaml >&2 || true
  printf '\nPod and job details:\n' >&2
  kubectl_test -n "$NAMESPACE" describe pods,jobs >&2 || true
  printf '\nRecent events:\n' >&2
  kubectl_test get events -A --sort-by=.lastTimestamp | tail -100 >&2 || true
  printf '\nFormbricks container logs:\n' >&2
  kubectl_test -n "$NAMESPACE" logs deployment/formbricks --all-containers --tail=100 >&2 || true
  kubectl_test -n "$NAMESPACE" logs deployment/envoy-gateway --all-containers --tail=100 >&2 || true
  kubectl_test -n shared-envoy logs deployment/envoy-gateway --all-containers --tail=100 >&2 || true
  for job in formbricks-migration formbricks-authzed-initialize formbricks-spicedb-database-bootstrap formbricks-hub-migration; do
    kubectl_test -n "$NAMESPACE" logs "job/$job" --all-containers --tail=100 >&2 || true
  done
}
cleanup() {
  local code=$?
  if (( code != 0 )); then diagnostics; fi
  if [[ -x "$kind_bin" ]]; then
    "$kind_bin" delete cluster --name "$CLUSTER_NAME" >/dev/null 2>&1 || true
  fi
  rm -rf "$temp_dir"
  exit "$code"
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
  *) printf 'Unsupported kind test platform: %s-%s\n' "$(uname -s)" "$(uname -m)" >&2; exit 1 ;;
esac
curl --fail --silent --show-error --location --retry 3 \
  "https://github.com/kubernetes-sigs/kind/releases/download/${KIND_VERSION}/kind-${platform}" \
  --output "$kind_bin"
printf '%s  %s\n' "$checksum" "$kind_bin" | shasum -a 256 --check
chmod 700 "$kind_bin"
"$kind_bin" create cluster --name "$CLUSTER_NAME" --image "$NODE_IMAGE" --wait 120s

# The platform installs Gateway API Standard and the matching Envoy CRDs as separate ownership units.
curl --fail --silent --show-error --location --retry 3 \
  https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.1/standard-install.yaml \
  --output "${temp_dir}/gateway-standard.yaml"
kubectl_test apply --server-side --field-manager=platform-gateway-api -f "${temp_dir}/gateway-standard.yaml"
helm pull oci://docker.io/envoyproxy/gateway-crds-helm --version v1.8.4 \
  --untar --untardir "$temp_dir"
helm template envoy-crds "${temp_dir}/gateway-crds-helm" \
  --set crds.gatewayAPI.enabled=false --set crds.envoyGateway.enabled=true \
  >"${temp_dir}/envoy-crds.yaml"
if grep -q 'name: gateways.gateway.networking.k8s.io' "${temp_dir}/envoy-crds.yaml"; then
  echo 'Envoy-only CRD chart unexpectedly rendered Gateway API CRDs' >&2
  exit 1
fi
kubectl_test apply --server-side --field-manager=platform-envoy-crds -f "${temp_dir}/envoy-crds.yaml"
kubectl_test wait --for=condition=Established --timeout=3m crd --all
"${CHART_DIR}/scripts/preflight-envoy-crds.sh" --context "$context"

snapshot_external_crds() {
  kubectl_test get crd -o json | jq -r '.items[] |
    select(.metadata.name | endswith(".gateway.networking.k8s.io") or
      endswith(".gateway.envoyproxy.io")) |
    [.metadata.name, .metadata.uid, .metadata.generation] | @tsv' | sort
}
snapshot_external_crds >"${temp_dir}/crds-before.tsv"

# A negative control proves the admission fixture is active before testing the chart.
cat >"${temp_dir}/protect-gateway.yaml" <<'POLICY'
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: protect-gateway-api-crds
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: ["apiextensions.k8s.io"]
        apiVersions: ["v1"]
        operations: ["UPDATE"]
        resources: ["customresourcedefinitions"]
  validations:
    - expression: "!object.metadata.name.endsWith('.gateway.networking.k8s.io')"
      message: "Gateway API CRDs are platform owned"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: protect-gateway-api-crds
spec:
  policyName: protect-gateway-api-crds
  validationActions: [Deny]
POLICY
kubectl_test apply -f "${temp_dir}/protect-gateway.yaml"
protected=false
for attempt in {1..30}; do
  if ! kubectl_test annotate crd gateways.gateway.networking.k8s.io \
    formbricks.io/admission-probe=true --overwrite --dry-run=server \
    >"${temp_dir}/admission.log" 2>&1; then
    if grep -q 'protect-gateway-api-crds' "${temp_dir}/admission.log"; then
      protected=true
      break
    fi
  fi
  sleep 2
done
if [[ "$protected" != true ]]; then
  cat "${temp_dir}/admission.log" >&2
  echo 'Gateway API CRD mutation policy did not reject the negative control' >&2
  exit 1
fi

wait_condition() {
  local namespace="$1" resource="$2" name="$3" condition="$4" response
  for attempt in {1..60}; do
    if [[ "$namespace" == cluster ]]; then
      response="$(kubectl_test get "$resource" "$name" -o json 2>/dev/null || true)"
    else
      response="$(kubectl_test -n "$namespace" get "$resource" "$name" -o json 2>/dev/null || true)"
    fi
    if jq -e --arg condition "$condition" '. as $object |
      [(.status.conditions[]?, .status.parents[]?.conditions[]?, .status.ancestors[]?.conditions[]?) |
       select(.type == $condition and .status == "True" and
         ((.observedGeneration // $object.metadata.generation) >= $object.metadata.generation))] |
      length > 0' <<<"$response" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  printf '%s/%s did not report %s=True\n' "$resource" "$name" "$condition" >&2
  printf '%s\n' "$response" >&2
  return 1
}

check_application() {
  kubectl_test -n "$NAMESPACE" rollout status deployment/formbricks --timeout=10m
  kubectl_test -n "$NAMESPACE" rollout status deployment/formbricks-hub --timeout=10m
  kubectl_test -n "$NAMESPACE" rollout status deployment/formbricks-hub-worker --timeout=10m
  kubectl_test -n "$NAMESPACE" rollout status deployment/formbricks-cube --timeout=10m
  kubectl_test -n "$NAMESPACE" rollout status statefulset/formbricks-postgresql --timeout=10m
  kubectl_test -n "$NAMESPACE" rollout status statefulset/formbricks-redis-master --timeout=10m
  kubectl_test -n "$NAMESPACE" rollout status statefulset/formbricks-envoy-redis-master --timeout=10m
  kubectl_test -n "$NAMESPACE" rollout status deployment/formbricks-spicedb-spicedb --timeout=10m
  kubectl_test -n "$NAMESPACE" wait --for=condition=complete --timeout=10m job/formbricks-migration
  for attempt in {1..60}; do
    if kubectl_test -n "$NAMESPACE" exec deployment/formbricks -- formbricks-authzed upgrade check \
      >"${temp_dir}/authzed-check.log" 2>&1; then
      break
    fi
    if (( attempt == 60 )); then
      cat "${temp_dir}/authzed-check.log" >&2
      echo 'AuthZed upgrade check never became ready' >&2
      return 1
    fi
    sleep 5
  done
}

check_envoy() {
  local gateway_class="$1"
  local proxy_namespace="$NAMESPACE" proxy_deployment proxy_service gateway_address proxy_address
  if [[ "$gateway_class" == shared-envoy ]]; then proxy_namespace=shared-envoy; fi
  wait_condition cluster gatewayclass "$gateway_class" Accepted
  wait_condition "$NAMESPACE" gateway formbricks-envoy-gateway Accepted
  wait_condition "$NAMESPACE" gateway formbricks-envoy-gateway Programmed
  local resource name names
  for resource in httproute backendtrafficpolicy clienttrafficpolicy securitypolicy; do
    names="$(kubectl_test -n "$NAMESPACE" get "$resource" -o json | jq -r '.items[].metadata.name')"
    while IFS= read -r name; do
      [[ -n "$name" ]] || continue
      wait_condition "$NAMESPACE" "$resource" "$name" Accepted
      if [[ "$resource" == httproute ]]; then
        wait_condition "$NAMESPACE" "$resource" "$name" ResolvedRefs
      fi
    done <<<"$names"
  done
  proxy_deployment="$(kubectl_test -n "$proxy_namespace" get deployment \
    -l gateway.envoyproxy.io/owning-gateway-name=formbricks-envoy-gateway -o json |
    jq -r '.items[].metadata.name')"
  if [[ -z "$proxy_deployment" || "$proxy_deployment" == *$'\n'* ]]; then
    printf 'Expected one proxy Deployment in %s; found: %s\n' "$proxy_namespace" "$proxy_deployment" >&2
    return 1
  fi
  kubectl_test -n "$proxy_namespace" rollout status "deployment/$proxy_deployment" --timeout=5m
  proxy_service="$(kubectl_test -n "$proxy_namespace" get service \
    -l gateway.envoyproxy.io/owning-gateway-name=formbricks-envoy-gateway -o json |
    jq -r '.items[].metadata.name')"
  if [[ -z "$proxy_service" || "$proxy_service" == *$'\n'* ]]; then
    printf 'Expected one proxy Service in %s; found: %s\n' "$proxy_namespace" "$proxy_service" >&2
    return 1
  fi
  gateway_address="$(kubectl_test -n "$NAMESPACE" get gateway/formbricks-envoy-gateway -o jsonpath='{.status.addresses[0].value}')"
  proxy_address="$(kubectl_test -n "$proxy_namespace" get "svc/$proxy_service" -o jsonpath='{.spec.clusterIP}')"
  if [[ "$gateway_address" != "$proxy_address" ]]; then
    printf 'Gateway address %s does not identify the active %s proxy service %s\n' \
      "$gateway_address" "$proxy_namespace" "$proxy_address" >&2
    return 1
  fi
  kubectl_test -n "$proxy_namespace" port-forward "svc/$proxy_service" 18080:80 \
    >"${temp_dir}/port-forward.log" 2>&1 &
  local forward_pid=$!
  local success=false
  for attempt in {1..60}; do
    if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:18080/health \
      >"${temp_dir}/gateway-health.log" 2>/dev/null; then
      success=true
      break
    fi
    sleep 2
  done
  kill "$forward_pid" >/dev/null 2>&1 || true
  wait "$forward_pid" 2>/dev/null || true
  if [[ "$success" != true ]]; then
    cat "${temp_dir}/port-forward.log" >&2
    echo 'No successful /health response through the Envoy proxy' >&2
    return 1
  fi
}

# The local chart installs every core service. Envoy CRDs stay outside its release.
helm install formbricks "$CHART_DIR" --namespace "$NAMESPACE" --create-namespace \
  -f "$VALUES" --wait --wait-for-jobs --timeout 25m
check_application
check_envoy formbricks-formbricks-envoy

# A values-only upgrade runs the chart's real migration/authorization hooks and rolls web and Hub.
helm upgrade formbricks "$CHART_DIR" --namespace "$NAMESPACE" -f "$VALUES" \
  --set authzed.migrationAcknowledged=true \
  --set envoy.formbricks.routes.feedbackRecords=true \
  --set-string deployment.additionalPodAnnotations.eng-3532-revision=upgrade \
  --set hub.resources.requests.cpu=120m \
  --set hub.worker.resources.requests.cpu=120m \
  --wait --wait-for-jobs --timeout 25m
check_application
check_envoy formbricks-formbricks-envoy
snapshot_external_crds >"${temp_dir}/crds-after-upgrade.tsv"
diff -u "${temp_dir}/crds-before.tsv" "${temp_dir}/crds-after-upgrade.tsv"

# The shared controller's Redis backend is platform-owned and remains after Formbricks uninstall.
kubectl_test create namespace shared-envoy
cat >"${temp_dir}/shared-redis.yaml" <<'REDIS'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shared-redis
  namespace: shared-envoy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shared-redis
  template:
    metadata:
      labels:
        app: shared-redis
    spec:
      containers:
        - name: redis
          image: valkey/valkey@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84
          ports:
            - containerPort: 6379
          readinessProbe:
            tcpSocket:
              port: 6379
            periodSeconds: 2
---
apiVersion: v1
kind: Service
metadata:
  name: shared-redis
  namespace: shared-envoy
spec:
  selector:
    app: shared-redis
  ports:
    - port: 6379
      targetPort: 6379
REDIS
kubectl_test apply -f "${temp_dir}/shared-redis.yaml"
kubectl_test -n shared-envoy rollout status deployment/shared-redis --timeout=5m

# A separate Helm release owns the shared controller. Formbricks switches to its GatewayClass.
helm install shared-envoy oci://docker.io/envoyproxy/gateway-helm --version v1.8.4 \
  --namespace shared-envoy \
  --set crds.enabled=false \
  --set config.envoyGateway.gateway.controllerName=gateway.envoyproxy.io/shared-controller \
  --set config.envoyGateway.rateLimit.backend.type=Redis \
  --set config.envoyGateway.rateLimit.backend.redis.url=shared-redis.shared-envoy.svc.cluster.local:6379 \
  --wait --timeout 10m
cat >"${temp_dir}/shared-class.yaml" <<'CLASS'
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: EnvoyProxy
metadata:
  name: shared-proxy-config
  namespace: shared-envoy
spec:
  provider:
    type: Kubernetes
    kubernetes:
      envoyService:
        type: ClusterIP
  preserveRouteOrder: true
---
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: shared-envoy
spec:
  controllerName: gateway.envoyproxy.io/shared-controller
  parametersRef:
    group: gateway.envoyproxy.io
    kind: EnvoyProxy
    name: shared-proxy-config
    namespace: shared-envoy
CLASS
kubectl_test apply -f "${temp_dir}/shared-class.yaml"
shared_uid="$(kubectl_test -n shared-envoy get deployment/envoy-gateway -o jsonpath='{.metadata.uid}')"
shared_service_uid="$(kubectl_test -n shared-envoy get service/envoy-gateway -o jsonpath='{.metadata.uid}')"
shared_sa_uid="$(kubectl_test -n shared-envoy get serviceaccount/envoy-gateway -o jsonpath='{.metadata.uid}')"
class_uid="$(kubectl_test get gatewayclass/shared-envoy -o jsonpath='{.metadata.uid}')"
proxy_config_uid="$(kubectl_test -n shared-envoy get envoyproxy/shared-proxy-config -o jsonpath='{.metadata.uid}')"
shared_redis_uid="$(kubectl_test -n shared-envoy get deployment/shared-redis -o jsonpath='{.metadata.uid}')"
shared_redis_service_uid="$(kubectl_test -n shared-envoy get service/shared-redis -o jsonpath='{.metadata.uid}')"

# A second Helm release uses the same shared class. Its Gateway and route must survive Formbricks uninstall.
mkdir -p "${temp_dir}/peer-chart/templates"
cat >"${temp_dir}/peer-chart/Chart.yaml" <<'CHART'
apiVersion: v2
name: envoy-peer-fixture
version: 0.1.0
CHART
cat >"${temp_dir}/peer-chart/templates/resources.yaml" <<'PEER'
apiVersion: v1
kind: Service
metadata:
  name: peer-backend
spec:
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: peer-gateway
spec:
  gatewayClassName: shared-envoy
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: peer-route
spec:
  parentRefs:
    - name: peer-gateway
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /peer
      backendRefs:
        - name: peer-backend
          port: 80
PEER
helm install peer "${temp_dir}/peer-chart" --namespace peer --create-namespace --wait --timeout 10m
wait_condition peer gateway peer-gateway Accepted
wait_condition peer gateway peer-gateway Programmed
wait_condition peer httproute peer-route Accepted
wait_condition peer httproute peer-route ResolvedRefs
peer_gateway_uid="$(kubectl_test -n peer get gateway/peer-gateway -o jsonpath='{.metadata.uid}')"
peer_route_uid="$(kubectl_test -n peer get httproute/peer-route -o jsonpath='{.metadata.uid}')"
peer_service_uid="$(kubectl_test -n peer get service/peer-backend -o jsonpath='{.metadata.uid}')"

helm upgrade formbricks "$CHART_DIR" --namespace "$NAMESPACE" -f "$VALUES" \
  --set authzed.migrationAcknowledged=true \
  --set envoy.controller.enabled=false \
  --set envoy.formbricks.gatewayClass.create=false \
  --set envoy.formbricks.gatewayClass.name=shared-envoy \
  --set envoy.formbricks.routes.feedbackRecords=true \
  --set-string deployment.additionalPodAnnotations.eng-3532-revision=shared \
  --set hub.resources.requests.cpu=130m \
  --set hub.worker.resources.requests.cpu=130m \
  --wait --wait-for-jobs --timeout 25m
if kubectl_test -n "$NAMESPACE" get deployment/envoy-gateway >/dev/null 2>&1; then
  echo 'The Formbricks release kept a duplicate Envoy controller' >&2
  exit 1
fi
check_application
check_envoy shared-envoy

helm uninstall formbricks --namespace "$NAMESPACE" --wait --timeout 10m
snapshot_external_crds >"${temp_dir}/crds-after-uninstall.tsv"
diff -u "${temp_dir}/crds-before.tsv" "${temp_dir}/crds-after-uninstall.tsv"
"${CHART_DIR}/scripts/preflight-envoy-crds.sh" --context "$context"
test "$(kubectl_test -n shared-envoy get deployment/envoy-gateway -o jsonpath='{.metadata.uid}')" = "$shared_uid"
test "$(kubectl_test -n shared-envoy get service/envoy-gateway -o jsonpath='{.metadata.uid}')" = "$shared_service_uid"
test "$(kubectl_test -n shared-envoy get serviceaccount/envoy-gateway -o jsonpath='{.metadata.uid}')" = "$shared_sa_uid"
test "$(kubectl_test get gatewayclass/shared-envoy -o jsonpath='{.metadata.uid}')" = "$class_uid"
test "$(kubectl_test -n shared-envoy get envoyproxy/shared-proxy-config -o jsonpath='{.metadata.uid}')" = "$proxy_config_uid"
test "$(kubectl_test -n shared-envoy get deployment/shared-redis -o jsonpath='{.metadata.uid}')" = "$shared_redis_uid"
test "$(kubectl_test -n shared-envoy get service/shared-redis -o jsonpath='{.metadata.uid}')" = "$shared_redis_service_uid"
kubectl_test -n shared-envoy rollout status deployment/shared-redis --timeout=5m
test "$(kubectl_test -n peer get gateway/peer-gateway -o jsonpath='{.metadata.uid}')" = "$peer_gateway_uid"
test "$(kubectl_test -n peer get httproute/peer-route -o jsonpath='{.metadata.uid}')" = "$peer_route_uid"
test "$(kubectl_test -n peer get service/peer-backend -o jsonpath='{.metadata.uid}')" = "$peer_service_uid"
wait_condition peer gateway peer-gateway Accepted
wait_condition peer gateway peer-gateway Programmed
wait_condition peer httproute peer-route Accepted
wait_condition peer httproute peer-route ResolvedRefs
helm status shared-envoy --namespace shared-envoy >/dev/null
helm status peer --namespace peer >/dev/null

echo 'Full-stack Envoy CRD ownership, Helm upgrade, shared controller, and uninstall integration passed'
