# ghcr.io/formbricks/cube

The Cube image the Formbricks Compose files and Helm chart run by default. It holds the Cube API server
(`@cubejs-backend/server`) and its Postgres driver on `gcr.io/distroless/nodejs24-debian13:nonroot`, for
`linux/amd64` and `linux/arm64`. The configuration it serves (`cube.js` and the `FeedbackRecords` model) is
not baked in; Compose mounts it from [`docker/cube`](../cube) and Helm from a ConfigMap.

Compared with the upstream `cubejs/cube` image, it leaves out:

- **A shell and package manager.** A Compose `command:` or Kubernetes `args:` that wraps Cube in `sh -c`
  fails with `Cannot find module '/cube/conf/sh'`, because the entrypoint is `node`. The default command
  starts the server; healthchecks call `node -e …` directly (`/nodejs/bin` is on `PATH`).
- **Python.** The native module is Cube's Python-free build, so Python-based Cube configuration is not
  supported.
- **Cube Store.** The bundled setup runs without it (`CUBEJS_EXTERNAL_DEFAULT=false`, in-memory cache and
  queue). Point Cube at an external Cube Store before adding external pre-aggregations. Dev mode
  (`CUBEJS_DEV_MODE=true`) is not supported: it runs refresh keys on an embedded Cube Store, so `/readyz`
  answers 500 and every query stalls for seconds. That is why `docker-compose.dev.yml` runs upstream
  `cubejs/cube` at the same Cube version instead of this image.

## Tag

Every published image gets an immutable tag `<Cube version>-<revision>`, for example `1.7.47-1`, and moves
`latest`. The Cube version is the `@cubejs-backend/server` version pinned in `package.json`; the revision is
the number in `REVISION`. [`image-tag.sh`](image-tag.sh) prints the current tag.

Change the tag whenever the image changes:

- Bump `REVISION` for any change to the image that keeps the Cube version: a new base digest, a Dockerfile
  edit, a lockfile refresh.
- Reset `REVISION` to `1` when the Cube version changes.

Then point `docker/docker-compose.yml` and `cube.image.tag` in `charts/formbricks/values.yaml` at the new
tag in the same pull request, and, when the Cube version changed, `docker-compose.dev.yml` at
`cubejs/cube:v<Cube version>`. A unit test in `docker/__tests__/formbricks-script.test.ts` fails while any of
the three does not match.

Dependabot security updates for `package-lock.json` need the same `REVISION` bump before they can merge.

## Build and test locally

```bash
docker build -t formbricks-cube:dev docker/cube-image
trivy image --ignore-unfixed --severity CRITICAL,HIGH --scanners vuln \
  --ignorefile docker/cube-image/.trivyignore.yaml --exit-code 1 formbricks-cube:dev
docker/cube-image/smoke-test.sh formbricks-cube:dev
```

The smoke test needs Docker with the Compose plugin, curl and Node 20 or later. It reads the `cube`,
`postgres` and `hub-migrate` services from `docker/docker-compose.yml`, so it tests what Compose would run. The
queries run against a Cube started with the Helm chart's default `cube.containerSecurityContext` (uid 1000, a
read-only root filesystem, no capabilities), so an image that starts writing to its own filesystem fails here
before it fails in Kubernetes.

## Bumping Cube

1. Set both `@cubejs-backend/*` dependencies in `package.json` to the new exact version (Dependabot opens
   this PR monthly), then regenerate the lockfile with the build image's npm:

   ```bash
   docker run --rm -v "$PWD/docker/cube-image:/w" -w /w --user "$(id -u):$(id -g)" \
     -e npm_config_cache=/tmp/.npm node:24-trixie-slim \
     npm install --package-lock-only --ignore-scripts --no-audit --no-fund
   ```

2. Replace the two lines in `native.sha256` with the new release's checksums. The build fails until they
   match:

   ```bash
   version=1.7.48
   for arch in x64 arm64; do
     asset="native-linux-${arch}-glibc-fallback.tar.gz"
     url="https://github.com/cube-js/cube/releases/download/v${version}/${asset}"
     echo "$(curl -fsSL "$url" | shasum -a 256 | cut -d' ' -f1)  v${version}/${asset}"
   done
   ```

   Cross-check them against the digests GitHub recorded for the release assets:
   `gh release view "v${version}" --repo cube-js/cube --json assets --jq '.assets[] | "\(.digest) \(.name)"'`.

3. Reset `REVISION` to `1`, update the three image references above, and read the Cube changelog for
   breaking changes that reach `apps/web/modules/ee/analysis` or `docker/cube`.

## Trivy gate and `.trivyignore.yaml`

`.github/workflows/cube-image.yml` fails on any CRITICAL or HIGH finding that has a fix. An entry in
`.trivyignore.yaml` needs a one-line reachability statement and an `expired_at` at most 30 days out, so the
gate turns red again and forces a re-check. Remove an entry as soon as a new base digest carries the fix.

## Publishing

`cube-image.yml` publishes on every push to `main` that touches this directory, `docker/cube`,
`docker/docker-compose.yml` or the workflow, and on manual runs from `main`. It builds both architectures, pushes the tag and `latest`, and signs
the digest with cosign. It never pushes a tag that already exists, so a run with nothing new to publish
(for example a schema change under `docker/cube`) only reports that the tag is already published. Pull
requests that change the image without changing its tag fail before they can merge.

After pushing, the job pulls the tag without credentials and fails if that is denied. GitHub creates a new
package as private, so after the first publish an org admin sets `formbricks/cube` to **public** in the
package settings and re-runs the job. A release cannot ship before that: `formbricks-release.yml` pulls the
tag `charts/formbricks/values.yaml` pins, without credentials, before it builds anything.

To check a published image's signature, pin the exact workflow identity, so a fork's `cube-image.yml` cannot
satisfy it:

```bash
cosign verify ghcr.io/formbricks/cube:1.7.47-1 \
  --certificate-identity https://github.com/formbricks/formbricks/.github/workflows/cube-image.yml@refs/heads/main \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```
