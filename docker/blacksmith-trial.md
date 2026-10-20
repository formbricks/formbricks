# Blacksmith Docker migration and validation

Release builds use native AMD64 and ARM64 Blacksmith runners, save candidates in
private ECR, and validate both architectures before copying the tested index to
release tags. PR builds use a separate AMD64 cache; fork PRs retain an isolated
GitHub runner. These changes take effect when the migration PR is merged.

## AWS setup before merging

Create a **dedicated private ECR repository** in the existing `ECR_REGION` and
`ECR_REGISTRY` account, for example `formbricks/formbricks-build-candidates`.
Do not reuse `ECR_REPOSITORY`: lifecycle expiration deletes image versions,
including any release tags pointing at those versions.

With an AWS administrator identity, create the repository and apply the committed
retention policy (substitute the region and repository if necessary):

```sh
aws ecr create-repository --region eu-central-1 \
  --repository-name formbricks/formbricks-build-candidates
aws ecr put-lifecycle-policy --region eu-central-1 \
  --repository-name formbricks/formbricks-build-candidates \
  --lifecycle-policy-text file://docker/blacksmith-candidate-lifecycle.json
```

Grant the existing role referenced by `AWS_ECR_PUSH_ROLE_ARN` these actions on
**only the new repository ARN**:

```json
{
  "Action": [
    "ecr:BatchCheckLayerAvailability",
    "ecr:GetDownloadUrlForLayer",
    "ecr:BatchGetImage",
    "ecr:InitiateLayerUpload",
    "ecr:UploadLayerPart",
    "ecr:CompleteLayerUpload",
    "ecr:PutImage",
    "ecr:DescribeRepositories",
    "ecr:GetLifecyclePolicy"
  ],
  "Effect": "Allow",
  "Resource": "arn:aws:ecr:REGION:ACCOUNT_ID:repository/formbricks/formbricks-build-candidates"
}
```

Retain the role's existing `ecr:GetAuthorizationToken` permission on `*` and
release-repository permissions. No image deletion permission is needed by CI.
The role's GitHub OIDC trust must cover the existing release workflow contexts.
Set the GitHub repository variable:

```sh
gh variable set ECR_CANDIDATE_REPOSITORY \
  --repo formbricks/formbricks --body formbricks/formbricks-build-candidates
```

Preparation checks the repository URI, separation from the release repository,
and a single lifecycle rule expiring every image after one to seven days. A
missing or incompatible policy fails before any compilation or publication.
Candidate images remain available for failed-job retries until expiration;
retrying later requires a new build and validation. ECR applies expiration
asynchronously, so the seven-day rule is not an exact deletion deadline.

## Native build trial

From a branch containing these workflows:

```sh
gh workflow run release-docker-github-experimental.yml \
  --ref <trial-branch> -f blacksmith_trial=true
```

This opt-in path does not publish images. It builds the production Dockerfile
on native 16-vCPU runners, loads each image locally, and runs the existing runtime,
migration, startup and Chromium smoke checks. It fails if Blacksmith's persistent
builder is unavailable. ARM64 uses 16 compiler workers; AMD64 retains four.

Run twice sequentially. A successful first run commits the cache. Each trial
uses a new application identity, so a warm run still compiles and packages the
application while reusing Node and dependencies. Avoid overlapping trials on the
same cache keys: concurrent cache writers can obscure reuse.

Release builds retain the trial cache keys to reuse the expensive initial Node
compilation. PR builds use `apps/web/Dockerfile-pr-amd64`, isolated from release
caches. Successful production and PR builds prune reclaimable BuildKit cache to
30 GB per builder. This is not a hard billing limit: snapshots, active records,
and Docker storage can differ from BuildKit's logical size. Monitor actual
storage in Blacksmith's dashboard, particularly after failed jobs.

## Registry transport trial

After configuring the dedicated candidate repository:

```sh
gh workflow run release-docker-github-experimental.yml \
  --ref <trial-branch> -f blacksmith_registry_trial=true
```

This stages a public multi-platform Alpine fixture in private ECR, verifies
anonymous access is denied, copies it unchanged to
`ghcr.io/formbricks/blacksmith-registry-trial`, and signs and verifies the digest.
The private fixture expires under the candidate policy. The public fixture and
signatures remain for inspection. No Formbricks release tags are written.

## Cutover gate

Keep the migration PR draft until both native builds and warm-cache smoke tests
pass, registry transport passes against the configured candidate repository,
and the full cloud/community candidate pipelines pass their existing native
validation gates. The builder trial omits telemetry credentials; it does not
prove Sentry upload, the cloud build profile, or Kubernetes deployment.

Record build and complete job durations, cache size, and actual billed usage.
Compare like workloads: warm application rebuilds, cold Node compilation, and
fully cached images are different measurements. Include Blacksmith compute,
cache storage, and temporary ECR storage when estimating monthly cost.

After merging, validate a community experimental release and a staging cloud
deployment before removing Depot credentials or canceling its subscription.
If promotion partially changes tags, follow the forward-recovery procedure in
[Image validation](IMAGE-VALIDATION.md); do not automatically roll back workloads.

## References

- [Blacksmith Docker caching](https://docs.blacksmith.sh/blacksmith-caching/docker-builds)
- [Blacksmith runner sizes](https://docs.blacksmith.sh/blacksmith-runners/overview)
- [Blacksmith pricing](https://www.blacksmith.sh/pricing)
- [ECR lifecycle policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html)
