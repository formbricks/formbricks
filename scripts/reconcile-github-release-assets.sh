#!/usr/bin/env bash

set -euo pipefail

usage() {
  printf '%s\n' "Usage: reconcile-github-release-assets.sh RELEASE_TAG REPOSITORY ASSET..." >&2
}

if [[ $# -lt 3 ]]; then
  usage
  exit 64
fi

release_tag="$1"
repository="$2"
shift 2

command -v gh >/dev/null 2>&1 || { printf '%s\n' "gh is required" >&2; exit 1; }
command -v cmp >/dev/null 2>&1 || { printf '%s\n' "cmp is required" >&2; exit 1; }

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

existing_assets=""
seen_names=()
release_assets=()
missing_assets=()

refresh_assets() {
  existing_assets=$(gh release view "$release_tag" --repo "$repository" --json assets --jq '.assets[].name')
}

release_has_asset() {
  local asset_name="$1"
  grep --fixed-strings --line-regexp -- "$asset_name" <<<"$existing_assets" >/dev/null
}

verify_release_asset() {
  local asset_path="$1"
  local asset_name
  local downloaded_asset
  asset_name=$(basename -- "$asset_path")
  downloaded_asset="${temporary_directory}/${asset_name}"
  rm -f -- "$downloaded_asset"
  gh release download "$release_tag" --repo "$repository" --pattern "$asset_name" --output "$downloaded_asset"
  if ! cmp --silent -- "$asset_path" "$downloaded_asset"; then
    printf '%s\n' "Existing release asset differs from the locally verified artifact: $asset_name" >&2
    return 1
  fi
}

for asset_path in "$@"; do
  if [[ ! -f "$asset_path" ]]; then
    printf '%s\n' "Release asset is missing locally: $asset_path" >&2
    exit 1
  fi

  asset_name=$(basename -- "$asset_path")
  for seen_name in "${seen_names[@]:-}"; do
    if [[ "$seen_name" == "$asset_name" ]]; then
      printf '%s\n' "Release asset name is duplicated locally: $asset_name" >&2
      exit 1
    fi
  done
  seen_names+=("$asset_name")
  release_assets+=("$asset_path")
done

refresh_assets
for asset_path in "${release_assets[@]}"; do
  asset_name=$(basename -- "$asset_path")
  if release_has_asset "$asset_name"; then
    verify_release_asset "$asset_path"
    printf '%s\n' "Verified existing release asset: $asset_name"
  else
    missing_assets+=("$asset_path")
  fi
done

for asset_path in "${missing_assets[@]}"; do
  asset_name=$(basename -- "$asset_path")
  if ! gh release upload "$release_tag" --repo "$repository" "$asset_path"; then
    refresh_assets
    if ! release_has_asset "$asset_name"; then
      printf '%s\n' "Release asset upload failed: $asset_name" >&2
      exit 1
    fi
  fi
  verify_release_asset "$asset_path"
  printf '%s\n' "Uploaded release asset: $asset_name"
done

refresh_assets
for asset_path in "${release_assets[@]}"; do
  asset_name=$(basename -- "$asset_path")
  if ! release_has_asset "$asset_name"; then
    printf '%s\n' "Release asset is missing after publication: $asset_name" >&2
    exit 1
  fi
  verify_release_asset "$asset_path"
done
