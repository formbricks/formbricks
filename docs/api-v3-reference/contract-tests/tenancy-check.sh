#!/usr/bin/env bash
#
# Asserts that the v3 feedback-record surface keeps datasets apart, which the contract tests cannot.
#
# Schemathesis checks a response against its documentation. It is told about exactly one workspace, so
# it never attempts a cross-tenant read — a surface that happily served another organization's records
# would pass every contract check, because the *shape* of the answer would be perfectly correct. That
# is the whole gap this script covers (ENG-3117 S5).
#
# Two properties, both about a caller holding a valid key for workspace A:
#
#   1. A dataset in another organization is refused.
#   2. That refusal is indistinguishable from the refusal for a dataset that does not exist. If the two
#      differed — 403 against 404, say, or different `code`s — the surface would be an oracle for
#      "does this id exist", which is how a cross-tenant enumeration starts (ENG-1980).
#
# Usage: tenancy-check.sh [base-url]
# Needs SEED_API_KEY in the environment and the seeded fixtures.json next to this script.
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
# Absolute, because these ids are read with `node -p "require(...)"` and Node resolves a bare
# relative path as a module specifier rather than a file.
FIXTURES="$(cd "$(dirname "$0")" && pwd)/fixtures.json"

if [ -z "${SEED_API_KEY:-}" ]; then
  echo "::error::SEED_API_KEY is not set; the tenancy check cannot authenticate."
  exit 1
fi

workspace_id=$(node -p "require('${FIXTURES}').workspaceId")
foreign_dataset_id=$(node -p "require('${FIXTURES}').tenancy?.foreignDatasetId ?? ''")
foreign_workspace_id=$(node -p "require('${FIXTURES}').tenancy?.foreignWorkspaceId ?? ''")

if [ -z "${foreign_dataset_id}" ] || [ -z "${foreign_workspace_id}" ]; then
  echo "::error::fixtures.json carries no tenancy fixtures. Re-run db:seed:contract — without them this check would pass by testing nothing."
  exit 1
fi

# A syntactically valid id that was never created. Same shape as a real one (`z.cuid2()`: lowercase
# alphanumeric), so it fails on existence rather than on validation.
nonexistent_dataset_id="clctnosuchdataset0000001"

failures=0

# Prints "<status> <code>" so two refusals can be compared as a single value, which is the point:
# equal strings mean the surface said the same thing about both ids.
probe() {
  local url="$1" status code
  status=$(curl -s -o /tmp/tenancy-body.json -w "%{http_code}" -H "x-api-key: fbk_${SEED_API_KEY}" "${url}")
  code=$(node -p "(() => { try { return require('/tmp/tenancy-body.json').code ?? '-'; } catch { return '-'; } })()")
  echo "${status} ${code}"
}

expect_refused() {
  local description="$1" observed="$2"
  local status="${observed%% *}"
  if [ "${status}" != "403" ]; then
    echo "::error::${description} answered ${observed}, expected 403. A caller can reach a dataset it holds no permission on."
    cat /tmp/tenancy-body.json
    failures=$((failures + 1))
  else
    echo "ok: ${description} → ${observed}"
  fi
}

echo "--- a dataset in another organization is refused"
foreign=$(probe "${BASE_URL}/api/v3/feedback-records?workspaceId=${workspace_id}&datasetId=${foreign_dataset_id}")
expect_refused "listing a foreign dataset" "${foreign}"

echo "--- a workspace the key holds no permission on is refused"
foreign_ws=$(probe "${BASE_URL}/api/v3/feedback-records?workspaceId=${foreign_workspace_id}")
expect_refused "listing in a foreign workspace" "${foreign_ws}"

echo "--- counting is gated the same way as listing"
foreign_count=$(probe "${BASE_URL}/api/v3/feedback-records/count?workspaceId=${workspace_id}&datasetId=${foreign_dataset_id}")
expect_refused "counting a foreign dataset" "${foreign_count}"

echo "--- a foreign dataset and a nonexistent one are indistinguishable"
missing=$(probe "${BASE_URL}/api/v3/feedback-records?workspaceId=${workspace_id}&datasetId=${nonexistent_dataset_id}")
expect_refused "listing a nonexistent dataset" "${missing}"

if [ "${foreign}" != "${missing}" ]; then
  echo "::error::A foreign dataset answers '${foreign}' but a nonexistent one answers '${missing}'. The difference tells a caller which ids exist in other organizations."
  failures=$((failures + 1))
else
  echo "ok: both refusals are '${missing}' — no existence oracle"
fi

echo "--- a real record id is refused when named through a workspace the key cannot use"
# The strongest form of the check: the id is genuinely one of ours and the record genuinely exists, so
# a 200 would be a straight object-level authorization failure (BOLA) and a 404 would still confirm to
# the caller that the id is real. Only a 403 reveals nothing.
record_id=$(node -p "require('${FIXTURES}').read.feedbackRecordId ?? ''")
if [ -n "${record_id}" ]; then
  foreign_record=$(probe "${BASE_URL}/api/v3/feedback-records/${record_id}?workspaceId=${foreign_workspace_id}")
  expect_refused "reading a real record through a foreign workspace" "${foreign_record}"
else
  echo "::warning::No feedback record fixture; skipped the object-level authorization assertion."
fi

if [ "${failures}" -gt 0 ]; then
  echo "::error::${failures} tenancy assertion(s) failed."
  exit 1
fi

echo "All tenancy assertions passed."
