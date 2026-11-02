---
name: fix-advisories
description: "Clear Dependabot and pnpm-audit advisories without breaking the packages that use the patched dependency."
disable-model-invocation: true
---

The user wants open dependency advisories fixed. An advisory fix is done when the alert closes **and** every runtime consumer of the patched package still works: overrides have shipped green CI and broken production before. A `fast-xml-parser` pin made S3 deletes silently do nothing (formbricks#9329), an `@xmldom/xmldom` override broke every SAML sign-in (formbricks#9793), and overrides declared in `pnpm-workspace.yaml` were never enforced in the lockfile (formbricks#8301).

## Steps

1. **List the advisories.** Read the open Dependabot alerts and run `pnpm audit --json` from the repo root. Each advisory has a Linear ticket with the `vulnerability` label (`scripts/dependabot-to-linear.mjs` files them); work from those tickets.

2. **Find who pulls the package in.** `pnpm why <package> -r` for each advisory. Prefer, in order:
   1. Bumping the direct dependency that pulls it in (its catalog entry in `pnpm-workspace.yaml` when it is catalogued; `pnpm catalog:check` enforces that).
   2. An `overrides` entry in `pnpm-workspace.yaml`, scoped to the parent (`parent>package`) when only one consumer needs it, with a comment naming the advisory.

3. **Prove the consumers still work.** For every package `pnpm why` listed as a runtime consumer, run the tests that exercise it, and name them in the PR. An override that crosses a major version, or that a consumer's own `peerDependencies` range does not admit, needs that consumer's behaviour checked, not just its tests: XML parsers and signers sit under S3 storage and SAML.

4. **Confirm the lockfile resolves the patched version.** After `pnpm install`, `pnpm why <package> -r` shows only patched versions, and `pnpm audit` no longer reports the advisory. A declared override that the lockfile does not reflect fixes nothing.

5. **Record what has no fix.** An advisory with no patched upstream version stays open on its Linear ticket, with a comment naming the upstream issue or release it waits for, so the next run reads that instead of rediscovering it.

6. **Backport by severity.** Follow the backport policy on the ticket's severity: High and Critical go to every maintained release line, Medium to the current minor. Each release branch resolves its own lockfile, so repeat steps 3 and 4 there rather than assuming main's result carries over.

The PR names each advisory, the version it resolves to, and the consumer tests from step 3.
