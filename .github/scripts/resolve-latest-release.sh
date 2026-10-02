#!/usr/bin/env bash
# Decides whether the release being published is the one GitHub marks as latest, and writes
# `is_latest=true|false` to $GITHUB_OUTPUT. That output promotes the GHCR `latest` tag, the ECR
# `production` tag and the `stable` Git tag, so only a well-formed answer from the API may grant it.
#
# It asks GitHub's GraphQL API for this release's `isLatest`, the flag the "Set as the latest
# release" checkbox sets, rather than inferring it from REST's /releases/latest: there, a 404 means
# both "no release is latest" and "this token cannot see the repository", and the answer is a tag
# name to compare. Here every case is explicit, in one request:
#
#   isLatest true                      -> is_latest=true
#   isLatest false                     -> is_latest=false
#   repository or release not found    -> fail the job
#   any GraphQL error or non-200       -> fail the job, after curl has retried the transient ones
#   anything else in the response      -> fail the job
#
# Failing is deliberate. Defaulting to false would publish the real latest release without moving
# any of those tags, and nothing would flag it; a failed job is re-run once the API is back.
#
# formbricks/hub keeps a copy of this script for its own release workflow; fix both together.
#
# Inputs (environment): CURRENT_TAG, GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT, and optionally
# GITHUB_GRAPHQL_URL (set by Actions), RELEASE_LOOKUP_RETRIES (default 4) and RELEASE_LOOKUP_TIMEOUT
# (seconds per attempt, default 20).
set -euo pipefail

: "${CURRENT_TAG:?CURRENT_TAG is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
graphql_url="${GITHUB_GRAPHQL_URL:-https://api.github.com/graphql}"
retries="${RELEASE_LOOKUP_RETRIES:-4}"
timeout="${RELEASE_LOOKUP_TIMEOUT:-20}"

refuse() {
  printf '::error::%s Refusing to decide whether this release (%s) is the latest; re-run the job once the API recovers.\n' "$1" "${CURRENT_TAG}"
  exit 1
}

if [[ ! "${retries}" =~ ^[0-9]+$ ]]; then
  refuse "RELEASE_LOOKUP_RETRIES must be a non-negative integer."
fi
if [[ ! "${timeout}" =~ ^[1-9][0-9]*$ ]]; then
  refuse "RELEASE_LOOKUP_TIMEOUT must be a positive integer."
fi
if [[ ! "${GITHUB_REPOSITORY}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  refuse "GITHUB_REPOSITORY must be owner/name."
fi

body="$(mktemp)"
trap 'rm -f "${body}"' EXIT

# Only these two literals ever reach $GITHUB_OUTPUT. Nothing from the API is written there.
decide() {
  echo "is_latest=$1" >> "${GITHUB_OUTPUT}"
}

# The first error message the API gave, on one line and truncated. The raw body is never logged:
# Actions parses log lines for workflow commands, and a body we failed to understand is not trusted.
api_message() {
  jq -rs '.[0] | (.errors?[0]?.message? // .message?) // empty | strings' "${body}" 2> /dev/null |
    tr -d '\r\n' | cut -c 1-200 | sed 's/\.$//' || true
}

# The tag and repository travel as GraphQL variables, never spliced into the query text.
request="$(jq -cn \
  --arg owner "${GITHUB_REPOSITORY%%/*}" \
  --arg name "${GITHUB_REPOSITORY#*/}" \
  --arg tag "${CURRENT_TAG}" \
  '{
    query: "query($owner: String!, $name: String!, $tag: String!) { repository(owner: $owner, name: $name) { release(tagName: $tag) { tagName isLatest } } }",
    variables: { owner: $owner, name: $name, tag: $tag }
  }')"

# The token is passed as a header file so it stays out of curl's argv, and there is no -L, so a
# redirect cannot carry it to another host. --retry covers timeouts and 408/429/500/502/503/504
# (honouring Retry-After); --retry-connrefused adds refused connections. The query only reads, so
# repeating it is safe. curl never retries a 403, which GitHub also uses for rate limits, so one
# fails the job like any other error.
curl_status=0
http_code="$(curl -sS \
  --retry "${retries}" --retry-connrefused --retry-max-time 120 \
  --connect-timeout 10 --max-time "${timeout}" \
  -H @<(printf 'Authorization: Bearer %s\n' "${GITHUB_TOKEN}") \
  -H "Content-Type: application/json" \
  --data-binary "${request}" \
  -o "${body}" -w '%{http_code}' \
  "${graphql_url}")" || curl_status=$?

if [[ "${curl_status}" -ne 0 ]]; then
  refuse "Could not reach the GitHub API (curl exit ${curl_status})."
fi
if [[ "${http_code}" != "200" ]]; then
  refuse "The GitHub API answered HTTP ${http_code}: $(api_message)."
fi

# GraphQL reports most failures (NOT_FOUND, RATE_LIMITED, FORBIDDEN, ...) as a 200 with `errors`,
# sometimes beside partial data, so any error fails, whatever `data` holds.
if ! jq -es 'length == 1 and (.[0] | type == "object") and (.[0].errors == null)' "${body}" > /dev/null 2>&1; then
  refuse "The GitHub API returned errors or a malformed response: $(api_message)."
fi

# -s slurps the body, so exactly one JSON document is read and a second cannot hide behind it.
# The release must be the one asked for, and isLatest a real boolean, or nothing is decided. It is
# printed as a string because -e treats a literal false as failure.
if ! is_latest="$(jq -ers --arg tag "${CURRENT_TAG}" \
  '.[0].data.repository.release | select(type == "object" and .tagName == $tag) | .isLatest | booleans | tostring' \
  "${body}" 2> /dev/null)"; then
  refuse "GitHub could not find release ${CURRENT_TAG} in ${GITHUB_REPOSITORY}, or did not say whether it is the latest."
fi

if [[ "${is_latest}" == "true" ]]; then
  printf 'This release (%s) is the latest release.\n' "${CURRENT_TAG}"
  decide true
else
  printf 'This release (%s) is not the latest release.\n' "${CURRENT_TAG}"
  decide false
fi
