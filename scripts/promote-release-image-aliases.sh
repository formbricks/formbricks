#!/usr/bin/env bash

set -euo pipefail

: "${EXPECTED_DIGEST:?EXPECTED_DIGEST is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"
: "${IMAGE_NAME:?IMAGE_NAME is required}"
: "${RELEASE_TAG:?RELEASE_TAG is required}"
: "${REPO:?REPO is required}"
: "${VERSION:?VERSION is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

KEEP_LATEST_ON_V5="${KEEP_LATEST_ON_V5:-true}"
readonly API_ROOT="${GITHUB_API_URL:-https://api.github.com}"

printf '%s\n' "promoted=false" "source_stable=false" "aliases_complete=false" >>"$GITHUB_OUTPUT"

if [[ ! "$EXPECTED_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "ERROR: community image digest is missing or invalid" >&2
  exit 1
fi
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: stable alias promotion requires a stable semantic version" >&2
  exit 1
fi
if [[ "${RELEASE_TAG#[vV]}" != "$VERSION" ]]; then
  echo "ERROR: release tag and built image version do not match" >&2
  exit 1
fi

major="${VERSION%%.*}"
remainder="${VERSION#*.}"
minor="${remainder%%.*}"
if [[ "$major" != "5" && "$major" != "6" ]]; then
  echo "ERROR: moving aliases require an explicit release-major policy" >&2
  exit 1
fi

work_directory=$(mktemp -d)
trap 'rm -rf "$work_directory"' EXIT

github_get() {
  local path="$1"
  local output="$2"
  local http_code

  if ! http_code=$(curl -sS -w "%{http_code}" \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "${API_ROOT}/repos/${REPO}/${path}" -o "$output"); then
    echo "ERROR: GitHub release lookup failed; refusing to move image aliases" >&2
    return 1
  fi
  if [[ "$http_code" != "200" ]]; then
    echo "ERROR: GitHub release lookup returned HTTP ${http_code}" >&2
    return 1
  fi
}

latest_payload="${work_directory}/latest.json"
github_get "releases/latest" "$latest_payload"
latest_tag=$(jq -er '.tag_name | select(type == "string" and length > 0)' "$latest_payload") || {
  echo "ERROR: GitHub latest-release response is invalid" >&2
  exit 1
}

all_releases='[]'
page=1
while true; do
  page_payload="${work_directory}/releases-${page}.json"
  github_get "releases?per_page=100&page=${page}" "$page_payload"
  page_length=$(jq -er 'if type == "array" then length else error("invalid") end' "$page_payload") || {
    echo "ERROR: GitHub releases response is invalid" >&2
    exit 1
  }
  all_releases=$(jq -cn --argjson current "$all_releases" --slurpfile page "$page_payload" \
    '$current + $page[0]')
  [[ "$page_length" -lt 100 ]] && break
  page=$((page + 1))
  if [[ "$page" -gt 100 ]]; then
    echo "ERROR: GitHub releases response exceeded the safety page limit" >&2
    exit 1
  fi
done

if ! jq -e --arg tag "$RELEASE_TAG" \
  'any(.[]; .tag_name == $tag and .draft == false and .prerelease == false)' \
  <<<"$all_releases" >/dev/null; then
  echo "ERROR: current stable release is absent from GitHub release inventory" >&2
  exit 1
fi

stable_versions=$(jq -r '
  .[] |
  select(.draft == false and .prerelease == false) |
  .tag_name |
  select(test("^[vV]?[0-9]+\\.[0-9]+\\.[0-9]+$")) |
  sub("^[vV]"; "")
' <<<"$all_releases")

newest_for_prefix() {
  local prefix="$1"
  awk -v prefix="${prefix}." 'index($0, prefix) == 1' <<<"$stable_versions" | sort -V | tail -n 1
}

newest_major=$(newest_for_prefix "$major")
newest_minor=$(newest_for_prefix "${major}.${minor}")
tags=()

if [[ "$newest_major" == "$VERSION" ]]; then
  tags+=("${IMAGE_NAME}:${major}")
fi
if [[ "$newest_minor" == "$VERSION" ]]; then
  tags+=("${IMAGE_NAME}:${major}.${minor}")
fi
if [[ "$latest_tag" == "$RELEASE_TAG" ]]; then
  tags+=("${IMAGE_NAME}:stable")
fi
if [[ "$major" == "5" && "$KEEP_LATEST_ON_V5" == "true" && "$newest_major" == "$VERSION" ]]; then
  tags+=("${IMAGE_NAME}:latest")
elif [[ "$major" == "6" && "$KEEP_LATEST_ON_V5" != "true" && "$latest_tag" == "$RELEASE_TAG" ]]; then
  tags+=("${IMAGE_NAME}:latest")
fi

if [[ "${#tags[@]}" -eq 0 ]]; then
  echo "Release ${RELEASE_TAG} is superseded for every moving alias; no aliases changed."
  echo "aliases_complete=true" >>"$GITHUB_OUTPUT"
  exit 0
fi

tag_arguments=()
for tag in "${tags[@]}"; do
  tag_arguments+=(--tag "$tag")
done
docker buildx imagetools create "${tag_arguments[@]}" "${IMAGE_NAME}@${EXPECTED_DIGEST}"

for tag in "${tags[@]}"; do
  actual_digest=$(docker buildx imagetools inspect "$tag" --format '{{json .Manifest.Digest}}' | tr -d '"')
  if [[ "$actual_digest" != "$EXPECTED_DIGEST" ]]; then
    echo "ERROR: verified image alias does not resolve to the community release digest" >&2
    exit 1
  fi
done

if [[ "$latest_tag" == "$RELEASE_TAG" ]]; then
  echo "source_stable=true" >>"$GITHUB_OUTPUT"
fi
printf '%s\n' "promoted=true" "aliases_complete=true" >>"$GITHUB_OUTPUT"
