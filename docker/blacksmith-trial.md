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

Provision the repository through the existing infrastructure-as-code workflow,
with the account's KMS encryption and image-scanning settings, and apply the
seven-day retention policy in `docker/blacksmith-candidate-lifecycle.json`.
Review the infrastructure plan before applying it. Do not create a second,
unmanaged repository with manual AWS commands.

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
on native 16-vCPU AMD64 and 32-vCPU ARM64 runners, loads each image locally, and runs the existing runtime,
migration, startup and Chromium smoke checks. It fails if Blacksmith's persistent
builder is unavailable. ARM64 uses 32 compiler workers; AMD64 retains four.

Run sequentially and verify that the completed cold build's cache is available
before measuring a warm build. A successful job and a cache commit request alone
do not prove persistence: check that Node compilation is `CACHED` in the next
build's logs. Each trial uses a new application identity, so a warm run still
compiles and packages the application. Avoid overlapping trials on the same
cache keys: concurrent cache writers can obscure reuse.

Release builds retain the trial cache keys to reuse the expensive initial Node
compilation. PR builds use `apps/web/Dockerfile-pr-amd64`, isolated from release
caches. Successful production and PR builds prune reclaimable BuildKit cache to
30 GB per builder. This is not a hard billing limit: snapshots, active records,
and Docker storage can differ from BuildKit's logical size. Monitor actual
storage in Blacksmith's dashboard, particularly after failed jobs.
Blacksmith also evicts builder caches after seven days of inactivity. Infrequent
release builds may therefore compile Node from scratch again.

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

## Full candidate pipeline checks

Once the native and registry trials pass, exercise the community and cloud
profiles from the draft branch. These commands publish explicitly named test
versions after validation. The community workflow also updates its branch tag
in the experimental package; the cloud command leaves deployment tags unchanged.

```sh
trial_version="$(node -p "require('./apps/web/package.json').version.split('-')[0]")-blacksmith.$(date -u +%Y%m%d%H%M%S)"
gh workflow run release-docker-github-experimental.yml \
  --ref <trial-branch> -f version_override="$trial_version"
gh workflow run build-and-push-ecr.yml \
  --ref <trial-branch> -f version_override="$trial_version" \
  -f deploy_production=false -f deploy_staging=false
```

Verify that both native validation jobs and promotion succeed in each run, that
every destination tag matches its tested index digest, and that the community
signature verifies. Record the runs in the migration PR. These checks exercise
the actual release secrets, private candidate access, index assembly and
promotion actions, beyond the isolated builder and Alpine transport trials.

## Cutover gate

Keep the migration PR draft until both native builds and warm-cache smoke tests
pass, registry transport passes against the configured candidate repository,
and the full cloud/community candidate pipelines pass their existing native
validation gates. The builder trial omits telemetry credentials; it does not
prove Sentry upload, the cloud build profile, or Kubernetes deployment.

Record build and complete job durations, cache size, and actual billed usage.
Compare like workloads: warm application rebuilds, cold Node compilation, and
fully cached images are different measurements. Include Blacksmith compute,
cache storage, and ECR storage and transfer when estimating monthly cost.

After merging, validate a community experimental release and a staging cloud
deployment before removing Depot credentials or canceling its subscription.
If promotion partially changes tags, follow the forward-recovery procedure in
[Image validation](IMAGE-VALIDATION.md); do not automatically roll back workloads.

## Migration trial evidence

[PR #9715](https://github.com/formbricks/formbricks/pull/9715) tracks current
results and unresolved cutover gates. On October 20, 2026:

| Workload                                       | Build duration  | Result                                                |
| ---------------------------------------------- | --------------- | ----------------------------------------------------- |
| AMD64 release trial, cold                      | 42m49s          | Native runtime and browser smoke passed               |
| AMD64 release trial, warm                      | 3m00s and 3m37s | Real application rebuilds; Node cached; smoke passed  |
| ARM64 release trial, cold, 16 compiler workers | 60m36s          | Native runtime and browser smoke passed               |
| ARM64 release trial, cold, 32 compiler workers | 39m28s          | Native runtime and browser smoke passed               |
| AMD64 PR workflow, cold, 12 compiler workers   | 20m20s          | Complete Docker validation passed                     |
| AMD64 PR workflow, warm                        | 2m49s and 3m34s | Real application rebuilds; complete validation passed |

The first attempted ARM64 warm run restored an older cache snapshot and compiled
Node again. A later 32-vCPU cold build passed; a fresh diagnostic runner started
about eight minutes after completion restored matching cache database hashes
and the completed Node layer. The initial miss remains unexplained, so do not
assume a cache commit request means the next runner can immediately reuse it.

## References

- [Blacksmith Docker caching](https://docs.blacksmith.sh/blacksmith-caching/docker-builds)
- [Blacksmith runner sizes](https://docs.blacksmith.sh/blacksmith-runners/overview)
- [Blacksmith pricing](https://www.blacksmith.sh/pricing)
- [ECR storage and transfer pricing](https://aws.amazon.com/ecr/pricing/)
- [ECR lifecycle policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html)
