#!/usr/bin/env bash
set -euo pipefail

CHART_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES_FILE="${CHART_DIR}/values.example.yaml"
RECEIPT="123e4567-e89b-42d3-a456-426614174000"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

fail() {
  echo "contract failure: $*" >&2
  exit 1
}

render() {
  local phase="$1"
  local output="$2"
  shift 2
  local args=(
    template formbricks-v6-upgrade-1 "${CHART_DIR}"
    --namespace formbricks
    --values "${VALUES_FILE}"
    --set-string "phase=${phase}"
  )
  case "${phase}" in
    activate|rollback-begin)
      args+=(--set-string "activation.receipt=${RECEIPT}")
      args+=(--set "activation.workloadQuiesced=true")
      ;;
    rollback-complete)
      args+=(--set-string "activation.receipt=${RECEIPT}")
      ;;
  esac
  helm "${args[@]}" "$@" > "${output}"
}

expect_render_failure() {
  local description="$1"
  shift
  if helm template invalid "${CHART_DIR}" --namespace formbricks --values "${VALUES_FILE}" "$@" \
    > "${TMP_DIR}/invalid.out" 2> "${TMP_DIR}/invalid.err"; then
    fail "${description} rendered successfully"
  fi
}

helm lint "${CHART_DIR}" --values "${VALUES_FILE}" > "${TMP_DIR}/lint.out"

phases=(prepare audit activate rollback-begin rollback-complete)
for phase in "${phases[@]}"; do
  manifest="${TMP_DIR}/${phase}.yaml"
  render "${phase}" "${manifest}"

  ruby -ryaml - "${manifest}" "${phase}" <<'RUBY'
path, phase = ARGV
documents = YAML.load_stream(File.read(path)).compact
kinds = documents.map { |document| document.fetch("kind") }
abort "#{phase}: unexpected resources: #{kinds}" unless kinds.sort == %w[ConfigMap Job Lease]
abort "#{phase}: fixed plan ConfigMap is not created before the Job" unless kinds.first == "ConfigMap"

documents.each do |document|
  labels = document.fetch("metadata", {}).fetch("labels", {})
  unless labels["formbricks.com/upgrade-generation"] == "1"
    abort "#{phase}: missing generation label on #{document.fetch("kind")}"
  end
end

job = documents.find { |document| document["kind"] == "Job" }
pod = job.dig("spec", "template", "spec")
container = pod.fetch("containers").first
quiescence_acknowledgment = job.dig("metadata", "annotations", "formbricks.com/workload-quiesced")
expected_quiescence = %w[activate rollback-begin].include?(phase) ? "true" : "false"
unless quiescence_acknowledgment == expected_quiescence
  abort "#{phase}: incorrect workload quiescence acknowledgment"
end
pod_labels = job.dig("spec", "template", "metadata", "labels")
unless pod_labels["formbricks.com/upgrade-generation"] == "1"
  abort "#{phase}: phase pod is missing the generation label"
end
expected_image = "ghcr.io/formbricks/formbricks@sha256:#{"1" * 64}"
abort "#{phase}: Job does not use the exact phase image digest" unless container["image"] == expected_image
abort "#{phase}: mutable Job image" unless container["image"].include?("@sha256:")
candidate_image = "ghcr.io/formbricks/formbricks@sha256:#{"3" * 64}"
abort "#{phase}: temporary chart ran the candidate image" if container["image"] == candidate_image
abort "#{phase}: service-account token mounted" unless pod["automountServiceAccountToken"] == false
abort "#{phase}: service links enabled" unless pod["enableServiceLinks"] == false

security = container.fetch("securityContext", {})
abort "#{phase}: privilege escalation is not disabled" unless security["allowPrivilegeEscalation"] == false
unless security["readOnlyRootFilesystem"] == true && security["runAsNonRoot"] == true
  abort "#{phase}: container is not read-only/non-root"
end
abort "#{phase}: capabilities are not fully dropped" unless security.dig("capabilities", "drop") == ["ALL"]
abort "#{phase}: automatic Job retries are enabled" unless job.dig("spec", "backoffLimit") == 0
unless job.dig("spec", "completions") == 1 && job.dig("spec", "parallelism") == 1
  abort "#{phase}: Job can schedule more than one phase pod"
end
abort "#{phase}: missing Job TTL" unless job.dig("spec", "ttlSecondsAfterFinished").to_i >= 60
abort "#{phase}: missing active deadline" unless job.dig("spec", "activeDeadlineSeconds").to_i >= 60
if job.fetch("metadata", {}).fetch("annotations", {}).key?("helm.sh/hook")
  abort "#{phase}: automatic Helm hook present"
end

environment = container.fetch("env", []).to_h { |entry| [entry["name"], entry] }
expected_references = {
  "DATABASE_URL" => { "name" => "formbricks-app-secrets", "key" => "DATABASE_URL" },
  "AUTHZED_TOKEN" => { "name" => "formbricks-authzed", "key" => "preshared_key" },
}
expected_references.each do |name, expected_reference|
  actual_reference = environment.dig(name, "valueFrom", "secretKeyRef")
  abort "#{phase}: #{name} is not the expected secretKeyRef" unless actual_reference == expected_reference
end
abort "#{phase}: envFrom is forbidden" if container.key?("envFrom")
expected_environment = %w[
  LOG_LEVEL ENCRYPTION_KEY CUBEJS_API_SECRET CUBEJS_API_URL HUB_API_KEY HUB_API_URL REDIS_URL
  DATABASE_URL AUTHZED_ENABLED AUTHZED_ENDPOINT AUTHZED_TOKEN AUTHZED_SYSTEM_KEY AUTHZED_INSECURE
  AUTHZED_CONSISTENCY
]
unexpected_environment = environment.keys - expected_environment
abort "#{phase}: unexpected environment variables: #{unexpected_environment}" unless unexpected_environment.empty?
abort "#{phase}: candidate migration URL reached a bridge phase Job" if environment.key?("MIGRATE_DATABASE_URL")

plan = documents.find { |document| document["kind"] == "ConfigMap" }
abort "#{phase}: fixed plan ConfigMap is mutable" unless plan["immutable"] == true
expected_plan_keys = %w[
  targetRelease generation protocolVersion bridgeImage bridgeManifestDigest candidateImage
  candidateManifestDigest candidateExecutionMode contractMigrationPhase expectedCurrentSchemaDigest
]
unless plan.fetch("data", {}).keys.sort == expected_plan_keys.sort
  abort "#{phase}: unexpected plan ConfigMap fields: #{plan.fetch("data", {}).keys}"
end
unless plan.dig("data", "candidateExecutionMode") == "external" &&
    plan.dig("data", "contractMigrationPhase") == "deferred"
  abort "#{phase}: unsafe candidate execution or contract migration mode"
end
serialized_plan = plan.fetch("data", {}).to_s.downcase
%w[database_url token password cursor snapshot relationship receipt].each do |forbidden|
  if serialized_plan.include?(forbidden)
    abort "#{phase}: private runtime state leaked into ConfigMap: #{forbidden}"
  end
end
%w[formbricks-app-secrets formbricks-authzed preshared_key].each do |secret_reference|
  if serialized_plan.include?(secret_reference)
    abort "#{phase}: Secret reference leaked into ConfigMap: #{secret_reference}"
  end
end
RUBY

  [[ "$(grep -c '^kind: Job$' "${manifest}")" -eq 1 ]] || fail "${phase} did not render one Job"
done

ruby -ryaml - "${TMP_DIR}" <<'RUBY'
directory = ARGV.fetch(0)
expected = {
  "prepare" => [
    "activation", "prepare",
    "--bridge-image-digest", "sha256:#{"1" * 64}",
    "--bridge-manifest-digest", "sha256:#{"2" * 64}",
    "--candidate-image-digest", "sha256:#{"3" * 64}",
    "--candidate-manifest-digest", "sha256:#{"4" * 64}",
    "--expected-current-digest", "sha256:#{"5" * 64}",
  ],
  "audit" => ["backfill", "--scope=all"],
  "activate" => ["activation", "activate", "--receipt", "123e4567-e89b-42d3-a456-426614174000"],
  "rollback-begin" => [
    "activation", "rollback-begin", "--receipt", "123e4567-e89b-42d3-a456-426614174000",
  ],
  "rollback-complete" => [
    "activation", "rollback-complete", "--receipt", "123e4567-e89b-42d3-a456-426614174000",
  ],
}
expected.each do |phase, expected_args|
  documents = YAML.load_stream(File.read(File.join(directory, "#{phase}.yaml"))).compact
  job = documents.find { |document| document["kind"] == "Job" }
  args = job.dig("spec", "template", "spec", "containers").first.fetch("args")
  abort "#{phase}: unexpected args #{args}" unless args == expected_args
end
RUBY

render prepare "${TMP_DIR}/prepare-without-schema-guard.yaml" --set-string schema.expectedCurrentDigest=
if grep -q -- '--expected-current-digest' "${TMP_DIR}/prepare-without-schema-guard.yaml"; then
  fail "prepare rendered an empty schema guard"
fi

for prohibited_kind in Secret Deployment Service Ingress PersistentVolumeClaim CustomResourceDefinition SpiceDBCluster ServiceAccount Role RoleBinding ClusterRole ClusterRoleBinding; do
  if grep -RqsE "^kind:[[:space:]]+${prohibited_kind}$" "${TMP_DIR}"/*.yaml; then
    fail "rendered prohibited kind ${prohibited_kind}"
  fi
done

helm template formbricks-v6-upgrade-2 "${CHART_DIR}" \
  --namespace formbricks \
  --values "${VALUES_FILE}" \
  --set-string generation=2 > "${TMP_DIR}/generation-2.yaml"
ruby -ryaml - "${TMP_DIR}/prepare.yaml" "${TMP_DIR}/generation-2.yaml" <<'RUBY'
first_path, second_path = ARGV
first = YAML.load_stream(File.read(first_path)).compact
second = YAML.load_stream(File.read(second_path)).compact
%w[ConfigMap Lease].each do |kind|
  first_name = first.find { |document| document["kind"] == kind }.dig("metadata", "name")
  second_name = second.find { |document| document["kind"] == kind }.dig("metadata", "name")
  abort "#{kind} name changes across releases or generations" unless first_name == second_name
end
RUBY

render prepare "${TMP_DIR}/execution-2.yaml" --set execution=2
ruby -ryaml - "${TMP_DIR}/prepare.yaml" "${TMP_DIR}/execution-2.yaml" <<'RUBY'
first_path, second_path = ARGV
first = YAML.load_stream(File.read(first_path)).compact
second = YAML.load_stream(File.read(second_path)).compact
first_job = first.find { |document| document["kind"] == "Job" }.dig("metadata", "name")
second_job = second.find { |document| document["kind"] == "Job" }.dig("metadata", "name")
abort "incrementing execution did not create a new Job name" if first_job == second_job
RUBY

ruby -ryaml - "${TMP_DIR}/prepare.yaml" "${TMP_DIR}/audit.yaml" "${TMP_DIR}/execution-2.yaml" <<'RUBY'
paths = ARGV
plans = paths.map do |path|
  YAML.load_stream(File.read(path)).compact.find { |document| document["kind"] == "ConfigMap" }
end
first_data = plans.first.fetch("data")
plans.drop(1).each do |plan|
  abort "fixed plan data changed across phase or execution" unless plan.fetch("data") == first_data
end
RUBY

expect_render_failure "missing bridge digest" --set-string images.bridge.digest=
expect_render_failure "mutable bridge image" --set-string images.bridge.repository=ghcr.io/formbricks/formbricks:latest
expect_render_failure "unsupported phase" --set-string phase=automatic
expect_render_failure "zero generation" --set-string generation=0
expect_render_failure "receipt-less activation" --set-string phase=activate --set activation.workloadQuiesced=true
expect_render_failure "active bridge workload" --set-string phase=activate --set-string activation.receipt="${RECEIPT}"
expect_render_failure "active candidate workload during rollback" --set-string phase=rollback-begin \
  --set-string activation.receipt="${RECEIPT}"
expect_render_failure "receipt-less rollback begin" --set-string phase=rollback-begin \
  --set activation.workloadQuiesced=true
expect_render_failure "receipt-less rollback complete" --set-string phase=rollback-complete
expect_render_failure "weak consistency" --set-string authzed.consistency=minimize_latency
expect_render_failure "scheme-bearing endpoint" --set-string authzed.endpoint=http://spicedb:50051
expect_render_failure "out-of-range endpoint port" --set-string authzed.endpoint=spicedb:65536
expect_render_failure "invalid system key" --set-string authzed.systemKey=Formbricks
expect_render_failure "unknown root value" --set-string unsupported=true

for removed_phase in fence contract finalize; do
  expect_render_failure "removed ${removed_phase} phase" --set-string phase="${removed_phase}"
done

notes="$(helm install formbricks-v6-upgrade-1 "${CHART_DIR}" \
  --namespace formbricks \
  --values "${VALUES_FILE}" \
  --set-string phase=activate \
  --set-string activation.receipt="${RECEIPT}" \
  --set activation.workloadQuiesced=true \
  --dry-run --debug 2>&1)"
grep -q 'migration.mode=external' <<< "${notes}" || fail "activate notes omit external migration mode"
grep -q 'deployment.image.digest=sha256:' <<< "${notes}" || fail "activate notes omit candidate digest"
grep -q 'authzed.activation.installBootstrap.enabled=false' <<< "${notes}" || \
  fail "activate notes omit fresh-install bootstrap guard"
grep -q 'authzed.activation.upgradeGate.enabled=true' <<< "${notes}" || \
  fail "activate notes omit candidate receipt gate"
grep -q 'Do not use `helm --atomic`' <<< "${notes}" || fail "activate notes omit atomic rollback warning"
grep -q 'activation finalize' <<< "${notes}" || fail "activate notes omit candidate-side finalization"

echo "formbricks-upgrade chart contract passed"
