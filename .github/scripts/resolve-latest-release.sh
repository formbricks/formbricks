#!/usr/bin/env bash
# Decides whether the release being published is the one GitHub marks as latest, and writes
# `is_latest=true|false` to $GITHUB_OUTPUT. That output promotes the GHCR `latest` tag, the ECR
# `production` tag and the `stable` Git tag, so only a well-formed answer from the API may grant it:
#
#   200 naming this tag     -> is_latest=true
#   200 naming another tag  -> is_latest=false
#   404                     -> is_latest=false (no release is marked latest, so this one is not)
#   anything else           -> fail the job, after curl has retried the transient statuses
#
# Failing is deliberate. Defaulting to false would publish the real latest release without moving
# any of those tags, and nothing would flag it; a failed job is re-run once the API is back.
#
# formbricks/hub keeps a copy of this script for its own release workflow; fix both together.
#
# Inputs (environment): CURRENT_TAG, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT, and optionally
# GITHUB_API_URL (set by Actions) and RELEASE_LOOKUP_RETRIES (default 4).
set -euo pipefail

: "${CURRENT_TAG:?CURRENT_TAG is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
api_url="${GITHUB_API_URL:-https://api.github.com}"
retries="${RELEASE_LOOKUP_RETRIES:-4}"

if [[ ! "${retries}" =~ ^[0-9]+$ ]]; then
  echo "::error::RELEASE_LOOKUP_RETRIES must be a non-negative integer"
  exit 1
fi

body="$(mktemp)"
trap 'rm -f "${body}"' EXIT

# Only these two literals ever reach $GITHUB_OUTPUT. Nothing from the API is written there.
decide() {
  echo "is_latest=$1" >> "${GITHUB_OUTPUT}"
}

# The API's own error message, on one line and truncated. The raw body is never logged: Actions
# parses log lines for workflow commands, and a body we failed to understand is not trusted.
api_message() {
  jq -r '.message? // empty | strings' "${body}" 2> /dev/null | tr -d '\r\n' | cut -c 1-200 || true
}

# The token is passed as a header file so it stays out of curl's argv, and there is no -L, so a
# redirect cannot carry it to another host. --retry covers timeouts and 408/429/500/502/503/504
# (honouring Retry-After); --retry-connrefused adds refused connections. 403 and 404 are answers,
# not transient failures, so they are not retried.
curl_status=0
http_code="$(curl -sS \
  --retry "${retries}" --retry-connrefused --retry-max-time 120 \
  --connect-timeout 10 --max-time 20 \
  -H @<(printf 'Authorization: Bearer %s\n' "${GITHUB_TOKEN}") \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -o "${body}" -w '%{http_code}' \
  "${api_url}/repos/${GITHUB_REPOSITORY}/releases/latest")" || curl_status=$?

if [[ "${curl_status}" -ne 0 ]]; then
  echo "::error::Could not reach the GitHub releases API (curl exit ${curl_status}). Refusing to decide whether this release is the latest; re-run the job once the API is reachable."
  exit 1
fi

case "${http_code}" in
  200)
    # A tag name never contains control characters, so one that does is malformed, not a tag.
    if ! latest_tag="$(jq -er '.tag_name | strings | select(length > 0 and (test("[[:cntrl:]]") | not))' "${body}" 2> /dev/null)"; then
      echo "::error::The GitHub releases API returned 200 without a usable tag_name. Refusing to decide whether this release is the latest."
      exit 1
    fi

    if [[ "${latest_tag}" == "${CURRENT_TAG}" ]]; then
      printf 'This release (%s) is the latest release.\n' "${CURRENT_TAG}"
      decide true
    else
      printf 'This release (%s) is not the latest release (latest: %s).\n' "${CURRENT_TAG}" "${latest_tag}"
      decide false
    fi
    ;;
  404)
    printf '::notice::GitHub marks no release as latest, so this release (%s) is not the latest.\n' "${CURRENT_TAG}"
    decide false
    ;;
  *)
    printf '::error::The GitHub releases API answered HTTP %s: %s. Refusing to decide whether this release is the latest; re-run the job once the API recovers.\n' "${http_code}" "$(api_message)"
    exit 1
    ;;
esac
