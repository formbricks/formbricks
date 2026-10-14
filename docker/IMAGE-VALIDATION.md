# Image assembly and promotion

Next's standalone server, manifests, static assets and public files are assembled in
one build step. `next-runtime.json` records the deployment identity, build variant
and file hashes. The image build checks referenced assets before export and checks
the inventory again after copying it into the runtime image.
The inventory covers application output and public assets. Traced dependency packages
are completed by the Dockerfile's existing Prisma/logger overlays and checked separately
by its runtime dependency audit. Relative dependency symlinks are preserved during assembly.

CI supplies `FORMBRICKS_DEPLOYMENT_ID` as a Docker build argument derived from the
source revision, registry variant, workflow run and attempt. `FORMBRICKS_BUILD_VARIANT`
distinguishes ECR/cloud and GHCR/community builds. These are public build inputs,
not runtime configuration or secrets. Local Docker builds need neither argument;
they receive a local identity during compilation. Do not override deployment identity
when starting an already-built image.

Release workflows first publish a candidate tag. They validate that exact digest
on AMD64 and ARM64 before moving release or environment tags. The smoke test uses
disposable PostgreSQL and Redis containers, runs migrations, loads `/`, verifies
login hydration and navigates to password recovery. It rejects missing scripts,
styles and uncaught browser errors. It does not validate authorization, survey
submission, Hub/Cube integration or the Kubernetes handoff.

## Rerun validation

Install dependencies and Chromium using the repository-pinned pnpm/Playwright versions:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm --dir docker test __tests__/next-runtime.test.ts __tests__/image-promotion.test.ts
bash docker/smoke-release-image.sh REPOSITORY@sha256:DIGEST BUILD_IDENTITY ecr linux/amd64
bash docker/smoke-release-image.sh REPOSITORY@sha256:DIGEST BUILD_IDENTITY ecr linux/arm64
```

Cross-architecture execution needs QEMU or a native runner. The script creates its own
isolated datastores; it does not accept application database credentials. Cleanup runs
on success and failure. To inspect an image without starting the application:

```sh
docker run --rm --network none --entrypoint node REPOSITORY@sha256:DIGEST \
  verify-next-runtime.mjs . BUILD_IDENTITY ecr
```

## Repair and recovery

Use `rebuild_application: true` on **Deploy Selected Branch to Apollo** or
**Build Cloud Deployment Images** to bypass the installer and runner caches. Node
compilation and dependency-download caches remain reusable. This builds, validates
and promotes a new candidate; it does not modify the existing image.

For cache regression testing, build community then cloud variants with the same source,
repeat with warm caches, and run the same verifier/browser checks on each digest. Include
the release Sentry configuration, since PR builds intentionally omit upload credentials.

A failed candidate leaves deployment tags unchanged. Keep its digest and failed-check
output for diagnosis, then retry with a new build identity. Do not patch manifests or
rename chunks inside running pods. For a 6.1 repair, preserve the deployed migration
and authorization state; reverting the image to 6.0 requires separately establishing
that the upgrade has not crossed its forward-recovery boundary.

After deployment, verify each pod's digest and public browser journeys. An image smoke
test does not prove ingress draining, mixed-version compatibility or zero downtime.
