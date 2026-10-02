#!/usr/bin/env bash
# Decides whether the release being published is the one GitHub marks as latest, and writes
# `is_latest=true|false` to $GITHUB_OUTPUT. That output promotes the GHCR `latest` tag, the ECR
# `production` tag and the `stable` Git tag, so only a well-formed answer from the API may grant it:
#
#   200 naming this tag     -> is_latest=true
#   200 naming another tag  -> is_latest=false
#   404, repository visible -> is_latest=false (no release is marked latest, so this one is not)
#   anything else           -> fail the job, after curl has retried the transient statuses
#
# A 404 alone is ambiguous: GitHub answers the same for a repository the token cannot see. So a 404
# only counts as "nothing is latest" once the repository itself answers 200.
#
# Failing is deliberate. Defaulting to false would publish the real latest release without moving
# any of those tags, and nothing would flag it; a failed job is re-run once the API is back.
#
# formbricks/hub keeps a copy of this script for its own release workflow; fix both together.
#
# Inputs (environment): CURRENT_TAG, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT, and optionally
# GITHUB_API_URL (set by Actions), RELEASE_LOOKUP_RETRIES (default 4) and RELEASE_LOOKUP_TIMEOUT
# (seconds per attempt, default 20).
set -euo pipefail

: "${CURRENT_TAG:?CURRENT_TAG is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
api_url="${GITHUB_API_URL:-https://api.github.com}"
retries="${RELEASE_LOOKUP_RETRIES:-4}"
timeout="${RELEASE_LOOKUP_TIMEOUT:-20}"

if [[ ! "${retries}" =~ ^[0-9]+$ ]]; then
  echo "::error::RELEASE_LOOKUP_RETRIES must be a non-negative integer"
  exit 1
fi
if [[ ! "${timeout}" =~ ^[1-9][0-9]*$ ]]; then
  echo "::error::RELEASE_LOOKUP_TIMEOUT must be a positive integer"
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

refuse() {
  printf '::error::%s Refusing to decide whether this release (%s) is the latest; re-run the job once the API recovers.\n' "$1" "${CURRENT_TAG}"
  exit 1
}

# GETs an API path into ${body} and sets ${http_code}; a transport failure fails the job.
#
# The token is passed as a header file so it stays out of curl's argv, and there is no -L, so a
# redirect cannot carry it to another host. --retry covers timeouts and 408/429/500/502/503/504
# (honouring Retry-After); --retry-connrefused adds refused connections. curl never retries a 403,
# which GitHub also uses for rate limits, so one fails the job like any other error.
api_get() {
  local curl_status=0
  http_code="$(curl -sS \
    --retry "${retries}" --retry-connrefused --retry-max-time 120 \
    --connect-timeout 10 --max-time "${timeout}" \
    -H @<(printf 'Authorization: Bearer %s\n' "${GITHUB_TOKEN}") \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -o "${body}" -w '%{http_code}' \
    "${api_url}$1")" || curl_status=$?

  if [[ "${curl_status}" -ne 0 ]]; then
    refuse "Could not reach the GitHub API (curl exit ${curl_status})."
  fi
}

api_get "/repos/${GITHUB_REPOSITORY}/releases/latest"

case "${http_code}" in
  200)
    # Exactly one JSON document, whose tag_name is a non-empty string. -s slurps the body so a
    # second document cannot hide behind the first, and a tag name never contains control
    # characters, so one that does is malformed, not a tag.
    if ! latest_tag="$(jq -ers 'if length == 1 then .[0].tag_name else empty end | strings | select(length > 0 and (test("[[:cntrl:]]") | not))' "${body}" 2> /dev/null)"; then
      refuse "The GitHub releases API returned 200 without a usable tag_name."
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
    api_get "/repos/${GITHUB_REPOSITORY}"
    if [[ "${http_code}" != "200" ]]; then
      refuse "The GitHub releases API answered 404 and the repository answered HTTP ${http_code}: $(api_message)."
    fi

    printf '::notice::GitHub marks no release as latest, so this release (%s) is not the latest.\n' "${CURRENT_TAG}"
    decide false
    ;;
  *)
    refuse "The GitHub releases API answered HTTP ${http_code}: $(api_message)."
    ;;
esac
