# Image assembly and promotion

Next's standalone server, manifests, static assets and public files are assembled in
one build step. `next-runtime.json` records the deployment identity, build variant
and file hashes. The image build checks referenced assets before export and checks
the inventory again after copying it into the runtime image.
The inventory covers application output and public assets. Traced dependency packages
are completed by the Dockerfile's existing Prisma/logger overlays and checked separately
by its runtime dependency audit. Relative dependency symlinks are preserved during assembly.

CI supplies `FORMBRICKS_DEPLOYMENT_ID` as a Docker build argument derived from the
source revision, resolved version, registry variant and build profile (Sentry enabled and
PostHog configuration). Workflow run IDs and credential rotations do not invalidate normal
builds. `FORMBRICKS_BUILD_VARIANT`
distinguishes ECR/cloud and GHCR/community builds. These are public build inputs,
not runtime configuration or secrets. Local Docker builds need neither argument;
they receive a local identity during compilation. Do not override deployment identity
when starting an already-built image.

Release workflows save candidates in Depot's private build registry. They publish no candidate
tags or unverified digests to GHCR/ECR. After validation, `depot push` copies the saved build
to explicit release tags and the workflow checks every destination digest against the tested
private digest. The saved build ID is also checked against that digest before copying.
Do not use multi-platform `push-by-digest` with Depot here: its merge step can create an
implicit `latest` tag. Do not delete GHCR package versions to clean up temporary tags;
a version may also carry published release tags.

Separate AMD64 and ARM64 jobs validate the exact index digest in parallel on matching native
runners. They do not install QEMU or pull different architectures into the same Docker image
store. Promotion depends on both jobs succeeding. Browser assertions and actions have bounded
60-second timeouts, and the complete validation job has a 20-minute budget. Failed checks
remain blocking; rerunning a failed validation job reuses the built digest without rebuilding. The smoke test uses
disposable PostgreSQL and Redis containers, runs migrations, seeds a non-authenticating
user fixture so the instance selects login instead of setup, loads `/`, verifies
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

Run each command on the matching native architecture (CI enforces this). The script creates its own
isolated datastores; it does not accept application database credentials. Cleanup runs
on success and failure. To inspect an image without starting the application:

```sh
docker run --rm --network none --entrypoint node REPOSITORY@sha256:DIGEST \
  verify-next-runtime.mjs BUILD_IDENTITY ecr
```

Assertion failures report their specific reason and affected file paths, without actual/expected
configuration values. Unexpected errors, including malformed JSON, retain a generic diagnostic.

## CA trust

Node trusts the OS CA bundle (Alpine's `ca-certificates`), not the Mozilla list compiled into
its binary: the Dockerfile builds Node with `--openssl-use-def-ca-store` and pins a minimum
CA package version. Both matter. A CA-package fix, such as the distrust of the compromised
eMudhra intermediates, only reaches Node through this switch, and it holds even when a
deployment sets its own `NODE_OPTIONS`.

The image build checks the installed CA package versions, that the compromised root is absent
from the OS bundle, and that Node defaults to the OS store. Two scripts prove the behaviour
with real handshakes. Both need Docker; the first also needs `openssl`:

```sh
# Offline, a few seconds. Runs on every PR and on each release candidate digest.
bash apps/web/scripts/docker/verify-tls-image.sh REPOSITORY@sha256:DIGEST

# Needs network. Evidence for a rollout: the 12 published eMudhra chains must be rejected
# through tls, https, fetch and undici, and a valid public chain accepted.
bash apps/web/scripts/docker/verify-tls-image.sh REPOSITORY@sha256:DIGEST --incident-hosts
```

The live check depends on hosts we do not run, so it is not a PR gate. Node keeps honouring
`NODE_EXTRA_CA_CERTS` on top of the OS store. `SSL_CERT_FILE` and `SSL_CERT_DIR` now apply too.

## Repair and recovery

Use `rebuild_application: true` on **Deploy Selected Branch to Apollo** or
**Build Cloud Deployment Images** to bypass the installer and runner caches. Node
compilation and dependency-download caches remain reusable. Only this explicit repair mode
adds a run/attempt nonce to the deployment identity. Ordinary reruns retain the identity and
can reuse the complete application artifact. This builds, validates
and promotes a new candidate; it does not modify the existing image.

For cache regression testing, build community then cloud variants with the same source,
repeat with warm caches, and run the same verifier/browser checks on each digest. Include
the release Sentry configuration, since PR builds intentionally omit upload credentials.

Failed candidate validation leaves deployment tags unchanged. Keep its digest and failed-check
output and private build ID for diagnosis, then rerun validation of that digest.
Private pulls require the existing Depot project credential and a build-scoped pull token. Use the explicit repair option
when the application needs to be rebuilt.

Registry writes to multiple tags are not transactional. A failure after promotion begins
can leave only some tags updated, including a tag already consumed by a deployment controller.
Inspect every intended tag's current digest and resume promotion of the same verified digest.
Do not automatically restore previous tag values or roll back workloads: a deployment may
already have crossed the upgrade's forward-recovery boundary. Keep the promotion job's
verified candidate digest when recovering; rebuilding creates a different candidate that
must pass validation again.

Do not patch manifests or
rename chunks inside running pods. For a 6.1 repair, preserve the deployed migration
and authorization state; reverting the image to 6.0 requires separately establishing
that the upgrade has not crossed its forward-recovery boundary.

After deployment, verify each pod's digest and public browser journeys. An image smoke
test does not prove ingress draining, mixed-version compatibility or zero downtime.
