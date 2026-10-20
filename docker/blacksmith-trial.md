# Blacksmith Docker release trial

This experiment measures whether Blacksmith can replace the release builder. It
uses the production Dockerfile and existing release smoke checks, but does not
publish images or change the release workflows' default builder.

## Run

From a branch containing the trial workflow:

```sh
gh workflow run release-docker-github-experimental.yml \
  --ref <trial-branch> -f blacksmith_trial=true
```

The trial runs AMD64 and ARM64 on native 16-vCPU Blacksmith runners. It fails if
Blacksmith's persistent builder cannot be configured; a local-builder fallback
would invalidate the comparison.

ARM64 sets the Dockerfile's existing `NODE_BUILD_JOBS` argument to 16: the default
four-worker source compilation substantially underuses that runner. AMD64 keeps
the default four workers. This argument only controls compiler parallelism.

Run it twice sequentially. The first successful run populates the persistent
cache. Each trial uses a new application build identity, so the second run reuses
compiled Node and dependency layers but still compiles and packages the
application, as a new release would. Do not overlap runs using the same cache
keys: concurrent writers can obscure whether the cache was reused.

The native smoke script checks the assembled runtime, starts disposable Postgres
and Redis containers, boots the image with migrations, loads fixtures, and
exercises the application in Chromium.

## Read the results

Each job summary records build duration (including export to the local Docker
daemon), image size, and `docker buildx du` cache usage. Logs identify reused
layers. Record the complete job duration too: runner billing also includes
checkout, builder setup, browser installation, validation, and cache commit.

BuildKit's logical cache size is diagnostic, not a billing measurement. Confirm
actual stored GB and compute charges in Blacksmith's Usage & Billing page. The
trial's two cache keys are separate from E2E caches.

Compare a warm application rebuild with a recent Depot build of the same source,
platforms, and application configuration. A fully cached image, a cold source
compilation, and a different cloud/community variant are different workloads.
The trial omits telemetry credentials, so telemetry upload and cloud-specific
build configuration still need validation before cutover.

## Cutover gate

Proceed only after both native builds and smoke checks pass, the warm run
demonstrates cache reuse, and projected monthly compute plus cache and registry
costs justify moving.

The following release behaviors must also be implemented and exercised before
switching the defaults:

- Save candidates in a private staging registry, with bounded retention and
  access for subsequent validation jobs.
- Assemble the multi-platform index, test both architectures by its immutable
  digest, and prevent promotion if either validation fails.
- Copy the tested image to GHCR/ECR without rebuilding or changing its digest,
  preserve signing, and only then update the intended release tags.

Depot remains required by stable releases and PR Docker validation until those
consumers are migrated. A successful builder trial alone does not justify
canceling the Depot subscription.

## References

- [Blacksmith Docker caching and multi-platform builds](https://docs.blacksmith.sh/blacksmith-caching/docker-builds)
- [Blacksmith runner sizes](https://docs.blacksmith.sh/blacksmith-runners/overview)
- [Blacksmith pricing](https://www.blacksmith.sh/pricing)
