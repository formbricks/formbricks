#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_REPOSITORY:?Set ECR_CANDIDATE_REPOSITORY to a dedicated private ECR repository}"
: "${RELEASE_REPOSITORY:?Release repository is required}"
: "${CANDIDATE_REPOSITORY:?Candidate repository URI is required}"

if [[ "$STAGING_REPOSITORY" == "$RELEASE_REPOSITORY" ]]; then
  echo "Candidate retention must never apply to the release repository" >&2
  exit 1
fi

actual="$(aws ecr describe-repositories --repository-names "$STAGING_REPOSITORY" \
  --query 'repositories[0].repositoryUri' --output text)"
test "$actual" = "$CANDIDATE_REPOSITORY"

# A dedicated repository may expire every image. Additional rules could exempt
# candidates from the age limit, so require a single bounded expiration rule.
aws ecr get-lifecycle-policy --repository-name "$STAGING_REPOSITORY" |
  jq -e '
    .lifecyclePolicyText | fromjson | .rules |
    length == 1 and
    .[0].action.type == "expire" and
    .[0].selection.tagStatus == "any" and
    .[0].selection.countType == "sinceImagePushed" and
    .[0].selection.countUnit == "days" and
    .[0].selection.countNumber >= 1 and
    .[0].selection.countNumber <= 7
  ' >/dev/null

echo "Dedicated private ECR repository and candidate retention verified."
