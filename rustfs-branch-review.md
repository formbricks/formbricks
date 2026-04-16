# RustFS Branch Review

Date: 2026-04-15
Branch: `feat/replace-minio-with-rustfs`

## Executive Summary

The branch is in good shape overall. The core replacement strategy is sound:

- the application storage contract stays generic (`S3_*`)
- local dev, CI, one-click, and customer docs are now RustFS-first
- the one-click flow keeps the important least-privilege pattern instead of falling back to all-admin credentials
- generated RustFS credentials for the one-click and local-upload migration paths now live in a locked-down
  `.env` file instead of being baked into Compose YAML
- MinIO-to-RustFS migration remains explicitly out of scope, which matches the original task

I do not see a blocking problem in the dev/CI/runtime RustFS integration itself. The initial review surfaced
two migration-helper safety issues and one docs inconsistency; all three have now been fixed on this branch.
This rereview also addressed the remaining internal guidance cleanup and the most concrete security hardening
gap by moving generated RustFS credentials out of inline Compose YAML for the one-click and migration flows.

## Open Findings

No blocking findings remain from this review pass.

## Resolved During Review

### 1. The RustFS migration helper no longer removes local upload config when it did not migrate any files

Resolved in:

- `docker/migrate-to-rustfs.sh`

What changed:

- If no upload sources are detected, the helper now exits with a warning and leaves the legacy uploads configuration intact.
- Cleanup still happens only after a confirmed successful copy.

### 2. Existing manual RustFS installs no longer receive a dependency on a missing `rustfs-init` service

Resolved in:

- `docker/migrate-to-rustfs.sh`

What changed:

- The helper now adds `formbricks -> rustfs-init` only when `rustfs-init` actually exists.
- Existing manual RustFS setups can still be bootstrapped because the helper separately ensures the bucket, policy, and service user after startup.

### 3. The cluster-setup example no longer contradicts the branch’s RustFS guidance

Resolved in:

- `docs/self-hosting/setup/cluster-setup.mdx`

What changed:

- The example now uses `S3_FORCE_PATH_STYLE=1` for RustFS and clarifies that Amazon S3 should leave it disabled or unset.

### 4. Internal storage guidance no longer uses MinIO as the default local example

Resolved in:

- `packages/storage/.cursor/rules/storage-package.md`

What changed:

- The internal guidance now uses RustFS instead of MinIO as the self-hosted/local reference example.
- The sample env block now describes path-style access as common for RustFS and many third-party S3-compatible providers, instead of framing it as a MinIO-specific requirement.

### 5. Generated RustFS credentials are no longer hardcoded into Compose for the one-click and migration flows

Resolved in:

- `docker/formbricks.sh`
- `docker/migrate-to-rustfs.sh`

What changed:

- The one-click installer and the RustFS migration helper now write generated RustFS credentials to a local
  `.env` file and restrict it to `0600`.
- The generated Compose content now references those values through namespaced variables instead of embedding
  the actual credentials directly into `docker-compose.yml`.
- The scripts also stopped echoing the generated access key identifiers back to stdout unnecessarily.

### 6. RustFS docs now include stronger storage-media and operational guidance

Resolved in:

- `docs/self-hosting/setup/one-click.mdx`
- `docs/self-hosting/setup/docker.mdx`
- `docs/self-hosting/configuration/file-uploads.mdx`
- `docs/self-hosting/advanced/migration.mdx`

What changed:

- The docs now tell operators to keep generated RustFS credentials in a private `.env` file.
- They now call out local SSD or NVMe storage, XFS on dedicated host-managed disks, avoiding NFS for RustFS
  data, and backing up `rustfs-data`.
- They also make it clearer that centralized logging and alerting are still operator responsibilities in the
  bundled setup.

## What Looks Good

### Implementation quality

- The app-level storage code remains provider-agnostic and unchanged in shape. This is the right boundary.
- `docker-compose.dev.yml` adds the `UID 10001` ownership helper that RustFS explicitly needs for mounted data directories.
- CI switched from MinIO liveness probing to RustFS readiness plus an actual `mc` usability check, which is a real improvement.
- The one-click flow still provisions a separate service user and bucket-scoped policy instead of giving Formbricks the RustFS admin credentials.
- The new `packages/storage/src/rustfs-init-bootstrap.test.ts` is a good addition. It meaningfully covers the generated bootstrap script logic.

### Documentation quality

- Customer-facing docs now consistently describe RustFS as the bundled/self-hosted object storage option.
- The branch added the right warnings that bundled RustFS is a convenience-oriented single-server deployment, not RustFS’s ideal HA production topology.
- The migration docs correctly keep the old MinIO v4 helper as legacy history and explicitly say the new RustFS helper does not migrate MinIO-backed installs.

## Best-Practice Assessment Against RustFS Guidance

### Aligned with RustFS guidance

- Uses mounted-volume ownership compatible with the RustFS container’s non-root UID `10001`.
- Uses policy-based access control and a separate service user in the one-click flow.
- No longer hardcodes generated RustFS credentials into the one-click or migration Compose files.
- Puts the production one-click path behind Traefik instead of directly exposing the storage node.
- Avoids exposing the RustFS console publicly in the one-click flow.
- Uses readiness-aware startup logic in CI and bucket bootstrap logic in dev.
- Docs now explicitly call out SSD/NVMe preference, XFS, avoiding NFS, backups, and private credential
  storage.

### Partially aligned / advisory gaps

- The bundled deployment remains a single-server convenience setup.
  RustFS’s production-oriented docs point operators toward larger topologies for enterprise-grade resilience.
- The branch still does not provision audit-log export, centralized logging, or alerts by default.
  The docs now tell operators to wire those separately, but the bundled stack does not automate them.

These are best-practice gaps, but I would treat them as follow-up hardening rather than blockers for this branch.

## Similarities And Differences: MinIO vs RustFS In Formbricks

### Similarities

- Both are used here as S3-compatible backends behind the same `S3_*` application contract.
- Both use the `mc` client for bucket/bootstrap automation.
- Both support the Formbricks flows that matter here:
  - presigned/browser uploads
  - object reads
  - object deletes
  - bucket listing for cleanup
- Both fit naturally behind Traefik with a dedicated `files.` subdomain in the self-hosted flow.

### Differences

- Project status:
  - MinIO’s repository is now marked as no longer maintained.
  - RustFS is active and evolving.
- Licensing:
  - MinIO community distribution moved into a more constrained/legacy position.
  - RustFS is documented as Apache 2.0.
- Container behavior:
  - RustFS now expects mounted data directories to be writable by UID `10001`, which required adding `rustfs-perms`.
  - The old bundled MinIO flow did not need that helper.
- Bootstrap semantics in this branch:
  - Dev/CI now use RustFS admin credentials directly for simplicity.
  - One-click keeps the safer least-privilege service-user model.
- Migration stance:
  - The old v4 script migrated local uploads to bundled MinIO.
  - The new RustFS helper migrates local uploads to RustFS, but intentionally refuses MinIO-to-RustFS migration.

## Intentional Remaining MinIO References

The branch still contains some MinIO references, but the important ones are intentional and should not be treated as incomplete migration work:

- `minio/mc`
  - Still used as the bootstrap client image for RustFS in dev/docs/scripts.
  - This is expected because the branch intentionally uses `mc` for bucket, policy, and service-user automation.
- `docker/migrate-to-v4.sh`
  - Kept as the historical legacy helper for the old bundled MinIO path.
  - This matches the original task’s requirement not to rewrite or remove the old migration history.
- `cleanup-minio-init`
  - Kept as a backward-compatible alias that now routes to the RustFS cleanup path.

No additional non-legacy MinIO wording stood out after the internal `.cursor` guidance was updated.

## Comparison Against The Original Task

| Original task requirement                                         | Status | Notes                                                                                                       |
| ----------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Research alternatives and recommend a future-proof path           | Done   | Prior research selected RustFS as the preferred replacement.                                                |
| Replace MinIO in the dev setup                                    | Done   | `docker-compose.dev.yml` now uses RustFS plus `rustfs-perms` and `rustfs-init`.                             |
| Replace MinIO in CI/e2e                                           | Done   | `.github/workflows/e2e.yml` now boots RustFS and waits for readiness.                                       |
| Replace MinIO in the docs                                         | Done   | Self-hosting and file-upload docs are RustFS-first now.                                                     |
| Replace MinIO in the recommended customer self-hosted Docker path | Done   | `docker/formbricks.sh` now provisions RustFS for the one-click path; docs also include manual RustFS setup. |
| Do not do MinIO-to-new-solution migration in this ticket          | Done   | `docker/migrate-to-rustfs.sh` explicitly skips MinIO-backed installs.                                       |
| Leave the old migration path as historical/legacy context         | Done   | `docker/migrate-to-v4.sh` remains in place and is documented as legacy.                                     |

Overall, the branch satisfies the original task well.

## Validation Performed

I rechecked the branch with:

- `bash -n docker/formbricks.sh`
- `bash -n docker/migrate-to-rustfs.sh`
- `docker compose -f docker-compose.dev.yml config`
- `pnpm --filter @formbricks/storage test -- src/rustfs-init-bootstrap.test.ts`
- helper-level smoke verification that `write_rustfs_env_file` creates a `.env` file with `0600` permissions
  and the expected `FORMBRICKS_RUSTFS_*` keys

I also previously reran a live end-to-end smoke test against the patched branch:

- isolated RustFS on `localhost:9002`
- app on `localhost:3002`
- browser upload flow returned:
  - `200` from `POST /api/v1/client/.../storage`
  - `201` from direct browser upload to `http://localhost:9002/formbricks`
- uploaded object was present in the isolated RustFS bucket afterward

## Recommendation

I would merge this branch.

If you want a stricter “best-practice” follow-up after merge, I would prioritize these next:

1. Add an integration-level installer/migration test that exercises real `mc admin` calls against a live
   RustFS container and verifies the `.env`-based credential flow end to end.
2. Add optional centralized logging and alerting guidance or automation for bundled RustFS users.
3. Keep documenting the bundled path as a convenience deployment and steer stricter production users toward
   dedicated RustFS or external object storage.

## Sources

- RustFS Security Checklist:
  https://docs.rustfs.com/installation/checklists/security-checklists.html
- RustFS Production-oriented MNMD guidance:
  https://docs.rustfs.com/installation/linux/multiple-node-multiple-disk.html
- RustFS Docker / access guidance:
  https://github.com/rustfs/rustfs
- MinIO repository status:
  https://github.com/minio/minio
