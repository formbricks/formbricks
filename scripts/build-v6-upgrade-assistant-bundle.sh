#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: build-v6-upgrade-assistant-bundle.sh \
  --release-version VERSION \
  --source-revision SHA \
  --minimum-source-version VERSION \
  --bridge-image IMAGE@sha256:DIGEST \
  --bridge-runtime-manifest-digest sha256:DIGEST \
  --postgres-bootstrap-image pgvector/pgvector@sha256:DIGEST \
  --spicedb-image authzed/spicedb@sha256:DIGEST \
  --target-image IMAGE@sha256:DIGEST \
  --target-runtime-manifest-digest sha256:DIGEST \
  --output-directory DIRECTORY
EOF
}

release_version=""
source_revision=""
minimum_source_version=""
bridge_image=""
bridge_runtime_manifest_digest=""
postgres_bootstrap_image=""
spicedb_image=""
target_image=""
target_runtime_manifest_digest=""
output_directory=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-version) release_version="${2:-}"; shift 2 ;;
    --source-revision) source_revision="${2:-}"; shift 2 ;;
    --minimum-source-version) minimum_source_version="${2:-}"; shift 2 ;;
    --bridge-image) bridge_image="${2:-}"; shift 2 ;;
    --bridge-runtime-manifest-digest) bridge_runtime_manifest_digest="${2:-}"; shift 2 ;;
    --postgres-bootstrap-image) postgres_bootstrap_image="${2:-}"; shift 2 ;;
    --spicedb-image) spicedb_image="${2:-}"; shift 2 ;;
    --target-image) target_image="${2:-}"; shift 2 ;;
    --target-runtime-manifest-digest) target_runtime_manifest_digest="${2:-}"; shift 2 ;;
    --output-directory) output_directory="${2:-}"; shift 2 ;;
    *) usage; exit 64 ;;
  esac
done

if [[ -z "$release_version" || -z "$source_revision" || -z "$minimum_source_version" ||
  -z "$bridge_image" || -z "$bridge_runtime_manifest_digest" || -z "$postgres_bootstrap_image" ||
  -z "$spicedb_image" || -z "$target_image" || -z "$target_runtime_manifest_digest" ||
  -z "$output_directory" ]]; then
  usage
  exit 64
fi

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

readonly docker_overlay_path="docker/formbricks-authzed-overlay.yml"
readonly postgres_bootstrap_path="docker/authzed-postgres-bootstrap.sh"
readonly one_click_updater_path="docker/formbricks.sh"
readonly spicedb_cluster_crd_path="charts/spicedb-operator/crds/authzed.com_spicedbclusters.yaml"
readonly semver_pattern='^[vV]?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
readonly image_pattern='^ghcr\.io/formbricks/formbricks@sha256:[0-9a-f]{64}$'
readonly postgres_bootstrap_image_pattern='^pgvector/pgvector@sha256:[0-9a-f]{64}$'
readonly spicedb_image_pattern='^authzed/spicedb@sha256:[0-9a-f]{64}$'
readonly digest_pattern='^sha256:[0-9a-f]{64}$'

[[ "$release_version" =~ $semver_pattern ]] || { echo "invalid release version" >&2; exit 1; }
[[ "$minimum_source_version" =~ $semver_pattern ]] || { echo "invalid minimum source version" >&2; exit 1; }
[[ "${release_version#[vV]}" == 6.* ]] || { echo "release version must be v6" >&2; exit 1; }
[[ "${minimum_source_version#[vV]}" == 5.* ]] || { echo "minimum source version must be v5" >&2; exit 1; }
[[ "$source_revision" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid source revision" >&2; exit 1; }
[[ "$bridge_image" =~ $image_pattern ]] || { echo "bridge image must be an immutable official image" >&2; exit 1; }
[[ "$target_image" =~ $image_pattern ]] || { echo "target image must be an immutable official image" >&2; exit 1; }
[[ "$postgres_bootstrap_image" =~ $postgres_bootstrap_image_pattern ]] || {
  echo "PostgreSQL bootstrap image must be an immutable pgvector image" >&2
  exit 1
}
[[ "$spicedb_image" =~ $spicedb_image_pattern ]] || {
  echo "SpiceDB image must be an immutable AuthZed image" >&2
  exit 1
}
[[ "$bridge_image" != "$target_image" ]] || { echo "bridge and target images must be distinct" >&2; exit 1; }
[[ "$bridge_runtime_manifest_digest" =~ $digest_pattern ]] || { echo "invalid bridge runtime manifest digest" >&2; exit 1; }
[[ "$target_runtime_manifest_digest" =~ $digest_pattern ]] || { echo "invalid target runtime manifest digest" >&2; exit 1; }
[[ "$bridge_runtime_manifest_digest" != "$target_runtime_manifest_digest" ]] || {
  echo "bridge and target runtime manifests must be distinct" >&2
  exit 1
}

release_version="${release_version#[vV]}"
minimum_source_version="${minimum_source_version#[vV]}"
supported_pre_activation_versions='[]'
if [[ "$release_version" == "6.0.0" ]]; then
  # These two published candidates predate the durable activation receipt. They must traverse the
  # same signed bridge as v5. Later v6 releases either already carry a receipt or fail closed.
  supported_pre_activation_versions='["6.0.0-rc.1","6.0.0-rc.2"]'
fi

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

docker_overlay_digest="sha256:$(hash_file "$docker_overlay_path")"
postgres_bootstrap_digest="sha256:$(hash_file "$postgres_bootstrap_path")"
spicedb_cluster_crd_digest="sha256:$(hash_file "$spicedb_cluster_crd_path")"
mkdir -p "$output_directory"
cp docker/formbricks-upgrade-assistant "$output_directory/formbricks-upgrade-assistant"
cp "$docker_overlay_path" "$output_directory/formbricks-authzed-overlay.yml"
cp "$postgres_bootstrap_path" "$output_directory/authzed-postgres-bootstrap.sh"
cp "$one_click_updater_path" "$output_directory/formbricks.sh"
cp "$spicedb_cluster_crd_path" "$output_directory/authzed.com_spicedbclusters.yaml"
chmod 0755 "$output_directory/formbricks-upgrade-assistant"
chmod 0644 "$output_directory/formbricks-authzed-overlay.yml"
chmod 0700 "$output_directory/authzed-postgres-bootstrap.sh"
chmod 0755 "$output_directory/formbricks.sh"
chmod 0644 "$output_directory/authzed.com_spicedbclusters.yaml"

jq -cn \
  --arg releaseVersion "$release_version" \
  --arg sourceRevision "$source_revision" \
  --arg minimumSourceVersion "$minimum_source_version" \
  --argjson supportedPreActivationVersions "$supported_pre_activation_versions" \
  --arg bridgeImage "$bridge_image" \
  --arg bridgeRuntimeManifestDigest "$bridge_runtime_manifest_digest" \
  --arg formbricksChart "formbricks-${release_version}.tgz" \
  --arg dockerAuthzedOverlaySha256 "$docker_overlay_digest" \
  --arg authzedPostgresBootstrapSha256 "$postgres_bootstrap_digest" \
  --arg postgresBootstrapImage "$postgres_bootstrap_image" \
  --arg spicedbImage "$spicedb_image" \
  --arg spicedbClusterCrdSha256 "$spicedb_cluster_crd_digest" \
  --arg targetImage "$target_image" \
  --arg targetRuntimeManifestDigest "$target_runtime_manifest_digest" \
  --arg upgradeChart "formbricks-upgrade-${release_version}.tgz" \
  '{
    schemaVersion: 1,
    releaseVersion: $releaseVersion,
    sourceRevision: $sourceRevision,
    minimumSourceVersion: $minimumSourceVersion,
    supportedPreActivationVersions: $supportedPreActivationVersions,
    supportedInstallTypes: ["docker_compose", "helm", "one_click"],
    artifacts: {
      bridgeImage: $bridgeImage,
      bridgeRuntimeManifestDigest: $bridgeRuntimeManifestDigest,
      formbricksChart: $formbricksChart,
      dockerAuthzedOverlaySha256: $dockerAuthzedOverlaySha256,
      authzedPostgresBootstrapSha256: $authzedPostgresBootstrapSha256,
      postgresBootstrapImage: $postgresBootstrapImage,
      spicedbImage: $spicedbImage,
      spicedbClusterCrdSha256: $spicedbClusterCrdSha256,
      targetImage: $targetImage,
      targetRuntimeManifestDigest: $targetRuntimeManifestDigest,
      upgradeChart: $upgradeChart
    }
  }' >"$output_directory/formbricks-upgrade-manifest.json"

if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "$output_directory"
    sha256sum formbricks-upgrade-assistant formbricks-upgrade-manifest.json \
      formbricks-authzed-overlay.yml authzed-postgres-bootstrap.sh \
      authzed.com_spicedbclusters.yaml formbricks.sh \
      >formbricks-upgrade-checksums.txt
  )
else
  (
    cd "$output_directory"
    shasum -a 256 formbricks-upgrade-assistant formbricks-upgrade-manifest.json \
      formbricks-authzed-overlay.yml authzed-postgres-bootstrap.sh \
      authzed.com_spicedbclusters.yaml formbricks.sh \
      >formbricks-upgrade-checksums.txt
  )
fi
