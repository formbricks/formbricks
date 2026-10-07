#!/usr/bin/env bash
# Prints the GHCR tags for a community release, one per line.
#
# The exact version tag is always published. The rolling MAJOR.MINOR and MAJOR aliases only move
# when this version is the highest stable release on that line, so a maintenance release for an
# older minor (or a replay of an older patch) never rolls an alias back.
#
# Inputs (environment): VERSION, IMAGE_NAME, IS_PRERELEASE, MAKE_LATEST.
# Stdin: the tag names of every published stable release, one per line (a leading v is ignored).
set -euo pipefail

image="ghcr.io/${IMAGE_NAME}"
echo "${image}:${VERSION}"

if [[ "${IS_PRERELEASE}" != "true" && "${VERSION}" =~ ^([0-9]+)\.([0-9]+)\.[0-9]+$ ]]; then
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  published="$(sed -e 's/^[vV]//' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' || true)"

  highest_on_line() {
    { printf '%s\n' "${published}"; echo "${VERSION}"; } | grep -E "^$1\." | sort -V | tail -n 1
  }

  if [[ "$(highest_on_line "${major}\.${minor}")" == "${VERSION}" ]]; then
    echo "${image}:${major}.${minor}"
  else
    echo "Keeping ${major}.${minor}: a newer ${major}.${minor}.x release is published" >&2
  fi

  if [[ "$(highest_on_line "${major}")" == "${VERSION}" ]]; then
    echo "${image}:${major}"
  else
    echo "Keeping ${major}: a newer ${major}.x release is published" >&2
  fi
fi

if [[ "${IS_PRERELEASE}" == "false" && "${MAKE_LATEST}" == "true" ]]; then
  echo "${image}:latest"
fi
