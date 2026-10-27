# Release guidance template

Use this for every stable release, including patches and backports. Write the deployment summary once
and reuse it in the GitHub release notes. A release with no extra action still needs a release-note entry;
it does not need an empty upgrade page.

## Before writing

Compare the actual previous and target **release tags**, not current `main`. Backports can differ across
release lines. Record the checked tags and source paths in the release evidence.

- Review application **and Hub** migrations: data rewrites, removed fields, indexes/locks, backfills,
  timeouts, order, disk/WAL needs, reruns and downgrade limits.
- Compare Compose, installer, chart/CRDs, images, model files, configuration defaults and secret bindings.
  Separate existing-install actions from fresh-install defaults. Never imply a PostgreSQL major or storage
  engine change is safe just because a reference file changes.
- Check integrations: SSO callbacks/account linking, SDK/API contracts, API-key scopes, webhooks, queues,
  old uploads, survey links and optional features. Name affected and fixed patches.
- Verify the proposed upgrade path, required stops and applicable deployment methods. Distinguish a
  source review from a runtime upgrade/restore rehearsal; cite exact pairs and topology when tested.
- Rehearse supported release paths with existing data before claiming they are tested. Include an existing
  SSO account, an old file, a scoped/denied API key, a survey response, workers and rollback. Use synthetic
  fixtures or authorized isolated data; never put customer configuration, identities or secrets in public docs.

## Release-note entry

Add to `docs/platform/changelog.mdx`. Replace every placeholder; do not publish alternatives or empty fields.

```mdx
<Update label="VERSION" description="PUBLICATION DATE">

One sentence about the user-visible change.

**Deployment impact:** Action required for AFFECTED SETUPS / Standard procedure only.

- REQUIRED ACTION, with a link to the exact procedure. Omit this bullet when no extra action is needed.
- Expected downtime or a release-specific exception to the standard maintenance procedure.

[Upgrade steps](/self-hosting/upgrade/versions/TARGET) · [Complete changes](GITHUB_RELEASE_URL)

</Update>
```

Use **Review required** if historical evidence is incomplete; do not infer “no action” from a missing
migration guide. For a verified standard-only release, link the shared deployment procedure instead of
creating `TARGET`. Link patch actions from the affected minor page too, so operators skipping patches find them.

## Upgrade checklist

Create a page only when extra actions need it. Keep the checklist brief. Move long SQL, troubleshooting
and optional-feature procedures to focused linked pages; keep one canonical copy of each command.

```mdx
---
title: "Upgrade to TARGET"
description: "The concrete changes operators must prepare for."
icon: "arrow-up-right-dots"
---

**Applies to:** SOURCE RANGE → TARGET RANGE; DEPLOYMENT METHODS; EDITIONS/FEATURES.
Choose the required stops in [Upgrade paths](/self-hosting/upgrade/paths).

## Before

| Who needs to act | Change | Required action |
| --- | --- | --- |
| AFFECTED SETUP | OLD → NEW | Exact setting/service/file, where to change it, and what to preserve. |

State maintenance impact, migration duration factors, prerequisites and backup scope.
New secrets: explain how to generate once, store and share between services. Preserve existing keys.
Optional components: say explicitly when they can remain disabled.
Name the first affected/fixed patch; do not apply a later patch's behavior to TARGET.0.

## During

Link the deployment procedure applicable to this target. Add only release-specific ordering/commands.
Use a selected immutable release for images, scripts, charts and model files; never copy historical
commands that fetch today's `stable` or `latest`. State stop conditions and expected exit/result.

## After

- Verify the changed behavior with existing data, users and integrations.
- Confirm migrations, required backfills, permissions and workers completed before advancing.
- Complete the [shared acceptance checks](/self-hosting/upgrade/rehearse#acceptance-at-every-stop).

## Recovery

State which changes cannot be undone by an image rollback, which coordinated data must be restored,
and any repair needed when rolling forward again. Link [restore](/self-hosting/operate/backup-restore).

Sources: exact release notes/comparison links. Evidence: source review or named tested pair/topology,
with upgrade and restore results. Never use a documentation build as runtime evidence.
```

## Ready for review

- A reader can identify their next stop and all required actions without researching an unnamed “tested pair”.
- Commands use services/executables present in the target; dependency pins and chart/app mapping are checked.
- The route was walked from its oldest supported source, including patch actions and existing custom storage/SSO.
- Test evidence, known gaps and recovery limits are explicit. “No extra action” is an assessed result.
- Run Mintlify validation, links/anchors and a desktop/mobile preview. Preserve existing URLs and heading anchors.
- Use the existing release-authoring checks; this template adds no separate approval workflow.
