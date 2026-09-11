#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: build-v6-upgrade-assistant-bundle.sh \
  --release-version VERSION \
  --source-revision SHA \
  --minimum-source-version VERSION \
  --bridge-image IMAGE@sha256:DIGEST \
  --target-image IMAGE@sha256:DIGEST \
  --output-directory DIRECTORY
EOF
}

release_version=""
source_revision=""
minimum_source_version=""
bridge_image=""
target_image=""
output_directory=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-version) release_version="${2:-}"; shift 2 ;;
    --source-revision) source_revision="${2:-}"; shift 2 ;;
    --minimum-source-version) minimum_source_version="${2:-}"; shift 2 ;;
    --bridge-image) bridge_image="${2:-}"; shift 2 ;;
    --target-image) target_image="${2:-}"; shift 2 ;;
    --output-directory) output_directory="${2:-}"; shift 2 ;;
    *) usage; exit 64 ;;
  esac
done

if [[ -z "$release_version" || -z "$source_revision" || -z "$minimum_source_version" ||
  -z "$bridge_image" || -z "$target_image" || -z "$output_directory" ]]; then
  usage
  exit 64
fi

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

readonly runtime_contract_path="authzed/runtime-contract.json"
if ! jq -e '
  type == "object" and
  (.clientContractVersion | type == "number") and
  (.migrationHead | type == "string") and
  (.protocolVersion | type == "number")
' "$runtime_contract_path" >/dev/null 2>&1; then
  echo "invalid AuthZed runtime contract" >&2
  exit 1
fi

readonly semver_pattern='^[vV]?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'
readonly image_pattern='^ghcr\.io/formbricks/formbricks@sha256:[0-9a-f]{64}$'

[[ "$release_version" =~ $semver_pattern ]] || { echo "invalid release version" >&2; exit 1; }
[[ "$minimum_source_version" =~ $semver_pattern ]] || { echo "invalid minimum source version" >&2; exit 1; }
[[ "${release_version#[vV]}" == 6.* ]] || { echo "release version must be v6" >&2; exit 1; }
[[ "${minimum_source_version#[vV]}" == 5.* ]] || { echo "minimum source version must be v5" >&2; exit 1; }
[[ "$source_revision" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid source revision" >&2; exit 1; }
[[ "$bridge_image" =~ $image_pattern ]] || { echo "bridge image must be an immutable official image" >&2; exit 1; }
[[ "$target_image" =~ $image_pattern ]] || { echo "target image must be an immutable official image" >&2; exit 1; }
[[ "$bridge_image" != "$target_image" ]] || { echo "bridge and target images must be distinct" >&2; exit 1; }

release_version="${release_version#[vV]}"
minimum_source_version="${minimum_source_version#[vV]}"
client_contract_version=$(jq -er '.clientContractVersion' "$runtime_contract_path")
migration_head=$(jq -er '.migrationHead' "$runtime_contract_path")
protocol_version=$(jq -er '.protocolVersion' "$runtime_contract_path")

bridge_runtime_manifest=$(jq -cn \
  --arg authorizationMode legacy_bridge \
  --argjson clientContractVersion "$client_contract_version" \
  --arg migrationHead "$migration_head" \
  --argjson protocolVersion "$protocol_version" \
  --arg sourceRevision "$source_revision" \
  '{
    authorizationMode: $authorizationMode,
    clientContractVersion: $clientContractVersion,
    migrationHead: $migrationHead,
    protocolVersion: $protocolVersion,
    sourceRevision: $sourceRevision
  }')
target_runtime_manifest=$(jq -cn \
  --arg authorizationMode spicedb_authoritative \
  --argjson clientContractVersion "$client_contract_version" \
  --arg migrationHead "$migration_head" \
  --argjson protocolVersion "$protocol_version" \
  --arg sourceRevision "$source_revision" \
  '{
    authorizationMode: $authorizationMode,
    clientContractVersion: $clientContractVersion,
    migrationHead: $migrationHead,
    protocolVersion: $protocolVersion,
    sourceRevision: $sourceRevision
  }')

hash_text() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{print $1}'
  else
    printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
  fi
}

bridge_runtime_manifest_digest="sha256:$(hash_text "$bridge_runtime_manifest")"
target_runtime_manifest_digest="sha256:$(hash_text "$target_runtime_manifest")"

mkdir -p "$output_directory"
cp docker/formbricks-upgrade-assistant "$output_directory/formbricks-upgrade-assistant"
chmod 0755 "$output_directory/formbricks-upgrade-assistant"

jq -cn \
  --arg releaseVersion "$release_version" \
  --arg sourceRevision "$source_revision" \
  --arg minimumSourceVersion "$minimum_source_version" \
  --arg bridgeImage "$bridge_image" \
  --arg bridgeRuntimeManifestDigest "$bridge_runtime_manifest_digest" \
  --arg formbricksChart "formbricks-${release_version}.tgz" \
  --arg targetImage "$target_image" \
  --arg targetRuntimeManifestDigest "$target_runtime_manifest_digest" \
  --arg upgradeChart "formbricks-upgrade-${release_version}.tgz" \
  '{
    schemaVersion: 1,
    releaseVersion: $releaseVersion,
    sourceRevision: $sourceRevision,
    minimumSourceVersion: $minimumSourceVersion,
    supportedInstallTypes: ["docker_compose", "helm", "one_click"],
    artifacts: {
      bridgeImage: $bridgeImage,
      bridgeRuntimeManifestDigest: $bridgeRuntimeManifestDigest,
      formbricksChart: $formbricksChart,
      targetImage: $targetImage,
      targetRuntimeManifestDigest: $targetRuntimeManifestDigest,
      upgradeChart: $upgradeChart
    }
  }' >"$output_directory/formbricks-upgrade-manifest.json"

if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "$output_directory"
    sha256sum formbricks-upgrade-assistant formbricks-upgrade-manifest.json \
      >formbricks-upgrade-checksums.txt
  )
else
  (
    cd "$output_directory"
    shasum -a 256 formbricks-upgrade-assistant formbricks-upgrade-manifest.json \
      >formbricks-upgrade-checksums.txt
  )
fi
