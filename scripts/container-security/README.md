# Container dependency monitoring

`container-security.yml` scans the image defaults committed to **main** every day. It renders the
bundled Helm chart twice (default and optional components), reads every service in both Compose files,
and includes operator-created SpiceDB and Envoy workloads. No containers or clusters are started.
Dependency updates are separate daily Dependabot version PRs for Helm, Compose and Dockerfiles;
review and normal CI remain required. A newer tag is not proof that a CVE is fixed.

## Run and review

```sh
node scripts/container-security/inventory.mjs /tmp/images.json # Helm and js-yaml required
SCAN_ENTRY='{"image":"postgres:17-alpine","sources":["manual"]}' \
  node scripts/container-security/scan.mjs /tmp/container-reports/postgres
GITHUB_REPOSITORY=formbricks/formbricks node scripts/container-security/sync.mjs \
  /tmp/images.json /tmp/container-reports --dry-run
pnpm test:root -- scripts/container-security/container-security.test.ts
```

The dry run will report an incomplete inventory unless every discovered image has a result. Without a
Linear key it previews creation only; with a key it also reads existing tickets to preview reconciliation.
The workflow's manual trigger defaults to dry run. Scheduled runs write tickets. Only main's scheduled
or manual workflow may write; no PR workflow receives Linear credentials.

## Scanning and tickets

Each image gets an isolated runner. The scanner resolves the registry index once, scans immutable
linux/amd64 and linux/arm64 manifests with Trivy, and records architectures that upstream does not
publish. The inventory job downloads the vulnerability and Java index databases once and shares them
with every scan job; database updates are disabled in those jobs so the full run uses one snapshot.
A database preparation failure stops the workflow before scanning or changing Linear tickets.
Registry and scanner errors fail the job. Reports remain available as workflow artifacts for
14 days. The existing Docker Security Scan continues publishing its app/Cube SARIF to Code scanning;
this stack-wide sync reads JSON directly, not Dependabot alerts or the Code scanning API.

Critical/high findings (including those without a fix) enter the existing Engineering triage queue
with the vulnerability label. Identity includes repository, image repository, package ecosystem,
package and CVE; tags, digests and architectures are occurrences in the same ticket. A finding at a
lower severity keeps its existing ticket open. A vulnerability ticket closes only when every current
tag and published architecture of its image repository scans successfully and no longer reports it.
Scan-failure tickets close when their exact image scans successfully or leaves the inventory.
Missing/failed scans create high-priority scan-failure tickets, permit creating tickets from successful
results, and block closure for the affected repository, without blocking unrelated successful scans.
The workflow still fails on incomplete scans so coverage gaps remain visible. Ticket descriptions carry
scope metadata; old or edited tickets without valid metadata require a complete inventory scan before
closing. Images with no packages recognized by Trivy are reported with an explicit warning; scanning
is limited to Trivy-supported package types.
Closing means the finding is absent from main's current image inventory, not that customers upgraded.
Suppression is deliberately not applied to this monitoring scan; temporary build-gate exceptions do
not hide findings from triage. The sync reopens manually closed tickets if the finding is still present.

Uses the existing `LINEAR_API_KEY` (or `LINEAR_ACCESS_KEY`) with issue read/write permissions.
`GITHUB_TOKEN` needs package read only for the scanning job. No additional GitHub alert token is needed.
The first complete run may create many tickets for old dependencies. Use a manual dry run first.

## Maintaining coverage

- Add deployment configurations to `profiles.yaml` when introducing a separately gated runtime. CI
  renders this inventory on every PR. Customer-supplied images and external services are outside scope.
- Envoy's proxy image is compiled into its controller, not rendered as a Pod by Helm. Its upstream
  source and chart version are recorded in `operator-images.json`. Updating the gateway chart fails
  discovery until this mapping is reviewed; do not independently bump that image as if it changed the
  controller. SpiceDB's image is derived from the rendered cluster version.
- Dependabot cannot promise updates for floating `latest`, arbitrary hashes or custom operator fields.
  Such dependencies still get daily vulnerability scans and tickets. Chart upgrades must refresh
  vendored archives; local subchart edits must also refresh the packaged dependency. Cube build input
  updates must bump `docker/cube-image/REVISION` and synchronize Helm/Compose references, and Cube
  version changes need reviewed native checksums. Existing CI catches these mismatches. Web runtime
  Node is compiled from a separate version/checksum in its Dockerfile, which also needs review.

A dependency absent from a successfully discovered, nonempty inventory resolves its scoped monitoring
tickets even if an unrelated image fails to scan. An empty inventory never closes tickets. There is
no release-branch support window, automatic merge, or automatic deployment. A fix reaches self-hosters
through a published chart/image release and their upgrade.
