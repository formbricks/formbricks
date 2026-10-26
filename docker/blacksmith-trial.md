# Blacksmith Docker migration and validation

Release builds use native AMD64 and ARM64 Blacksmith runners and publish run-specific
candidate tags directly to the existing destination repository: cloud images to ECR,
community images to GHCR, and experimental images to the existing experimental GHCR
package. Both architectures are tested by immutable digest before applying the
version, `latest`, or deployment tags. GHCR candidates have the package's normal
visibility and can be pulled before validation.

The existing registry settings and credentials are sufficient. This migration requires
no new repository, lifecycle policy, IAM grant, or GitHub variable. Cloud jobs use the
existing AWS OIDC role; community jobs use `GITHUB_TOKEN` package permissions.
Candidate tags remain for retries and diagnosis under the registry's existing retention
settings. The workflow does not delete images or install a new expiry policy.

PR builds use a separate AMD64 cache; fork PRs and merge groups retain an isolated GitHub runner, since merge groups can contain fork changes.
These changes take effect when the migration PR is merged.

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

## Full candidate pipeline checks

After the native trial passes, exercise the community and cloud profiles from
the draft branch. These commands publish explicitly named test
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
the actual release secrets, destination-registry authentication, index assembly,
native validation and promotion actions, beyond the isolated builder trials.

## Cutover gate

Keep the migration PR draft until both native builds and warm-cache smoke tests
pass and the full cloud/community pipelines pass their native validation and
release-tag promotion gates using the existing repositories. The builder trial omits telemetry credentials; it does not
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

| Workload                                       | Build duration  | Result                                                   |
| ---------------------------------------------- | --------------- | -------------------------------------------------------- |
| AMD64 release trial, cold                      | 42m49s          | Native runtime and browser smoke passed                  |
| AMD64 release trial, warm                      | 3m00s and 3m37s | Real application rebuilds; Node cached; smoke passed     |
| ARM64 release trial, cold, 16 compiler workers | 60m36s          | Native runtime and browser smoke passed                  |
| ARM64 release trial, cold, 32 compiler workers | 39m28s          | Native runtime and browser smoke passed                  |
| ARM64 release trial, warm, 32 compiler workers | 18m51s          | Node cached; application rebuild and native smoke passed |
| AMD64 PR workflow, cold, 12 compiler workers   | 20m20s          | Complete Docker validation passed                        |
| AMD64 PR workflow, warm                        | 2m49s and 3m34s | Real application rebuilds; complete validation passed    |

The first attempted ARM64 warm run restored an older cache snapshot and compiled
Node again. A later 32-vCPU cold build passed; a fresh diagnostic runner started
about eight minutes after completion restored matching cache database hashes
and the completed Node layer. The subsequent warm build passed with Node cached;
the application rebuild alone took 969.9 seconds. The initial miss remains
unexplained, so do not assume a cache commit request means the next runner can
immediately reuse it. Release speed and monthly cost improvements are not established.

## References

- [Blacksmith Docker caching](https://docs.blacksmith.sh/blacksmith-caching/docker-builds)
- [Blacksmith runner sizes](https://docs.blacksmith.sh/blacksmith-runners/overview)
- [Blacksmith pricing](https://www.blacksmith.sh/pricing)
- [ECR storage and transfer pricing](https://aws.amazon.com/ecr/pricing/)
