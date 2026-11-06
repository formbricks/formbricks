# Release guidance template

Use this for every stable release, including patches and backports.

- **GitHub Releases is the source of truth for release notes.** The `release-notes` skill writes the
  GitHub release, including its `## Upgrade impact` section.
- **The docs mirror it.** After publication, copy the summary and the upgrade-impact line into
  `docs/platform/changelog.mdx`. Don't rewrite the text.
- **The docs hold the procedures.** Each minor has one version page with the steps. A patch adds a row
  to its minor's page. A release with nothing to do still gets a release-notes entry, but no extra page.

## Before writing

Compare the previous and target **release tags**, not `main`. Backports can differ between release lines.

- Application and Hub migrations: data rewrites, removed fields, new indexes, backfills, timeouts, order,
  disk space needed, and what a rollback can't undo.
- Compose, installer, chart, CRDs, images, Cube model files, default settings and secret bindings.
  Keep "what existing installations must do" separate from "new defaults for fresh installs".
- The permission schema (`authzed/schema.zed`): if it changed, permission preparation needs the schema digest.
- Integrations: SSO callbacks and account linking, API and SDK contracts, API-key scopes, webhooks,
  old uploads, survey links and optional features.
- The upgrade test: each minor is tested from the latest patch of the previous minor, and each patch
  from the previous patch. Confirm it ran before publishing.

Never put customer configuration, identities or secrets in public docs.

## Release-notes entry (docs mirror)

Add to the top of `docs/platform/changelog.mdx`:

```mdx
<Update label="VERSION" description="PUBLICATION DATE">
<span id="release-X-Y-Z" />

One sentence about what changed for users.

**Upgrade impact: None.**

<!-- or: **Upgrade impact: Action required** for WHO: WHAT. Do the steps in [VERSION: TOPIC](/self-hosting/upgrade/versions/PAGE). -->

[All changes on GitHub](GITHUB_RELEASE_URL)

</Update>
```

Use only the two upgrade-impact values. Never publish "review required" or another "not yet known" status:
find out before publishing.

## Patch row

Add a row to the **Patch actions** table on the minor's version page:

```mdx
| 6.1.4 | None. |
| 6.1.5 | Action required for WHO: [6.1.5 security updates](/self-hosting/upgrade/versions/PAGE) (SHORT LIST). |
```

A patch that several release lines share gets one page, with every version in its title, linked from each line's row.

## Version page (one per minor)

Create `docs/self-hosting/upgrade/versions/MAJOR.MINOR.mdx`. Add it to `docs/docs.json`, to
`docs/self-hosting/advanced/migration.mdx`, and as a row in `docs/self-hosting/upgrade/paths.mdx`.

```mdx
---
title: "MAJOR.MINOR: Upgrade guide"
description: "What changes in MAJOR.MINOR and what you need to do when you upgrade."
icon: "arrow-up-right-dots"
---

**Upgrade from:** the latest PREVIOUS_MINOR patch. Skipping a minor version is not supported; see [Upgrade paths](/self-hosting/upgrade/paths).
**Downtime:** a maintenance window. **Applies to:** EDITIONS AND SETUPS.

## What changes

- Three to six plain bullets: what's different after the upgrade, and why it matters.

## Before you upgrade

| Who            | What to do                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| Everyone       | Plan a maintenance window. SAY WHAT MAKES THE MIGRATION SLOW, IF ANYTHING. |
| AFFECTED SETUP | The exact setting, service or file, where to change it, and what to keep.  |

### Patch actions

Check each patch you cross. You can go straight to the latest MAJOR.MINOR patch.

| Patch | Upgrade impact |
| ----- | -------------- |

## Upgrade

Follow the runbook for your setup: [Kubernetes](/self-hosting/upgrade/kubernetes),
[Docker Compose](/self-hosting/upgrade/docker) or [one-click](/self-hosting/upgrade/one-click).
Add only steps or ordering that are specific to this version.

## Check it worked

- Concrete checks with what the operator should see.

Also do the [checks after the upgrade](/self-hosting/advanced/upgrade#after-the-upgrade).

## If something goes wrong

What a rollback to the old image can't undo, and what to restore. Link [backup and restore](/self-hosting/operate/backup-restore).

All changes: [PREVIOUS → VERSION](https://github.com/formbricks/formbricks/compare/PREVIOUS...VERSION).
```

Keep version pages short. Put long SQL, troubleshooting or optional-feature procedures on a focused page
under `versions/`, named `MAJOR.MINOR.PATCH: Topic`, and link it. Keep one copy of each command.

## Writing rules

- For each step, say where to run it, the exact command or file change, and what the operator should see.
- New secrets: give the generation command, where to store the value and which services use it.
- New files: link the release source or give the download command and destination.
- "Merge" instructions name the blocks to copy and the settings to keep.
- Say what runs automatically and what the operator runs.
- Use pinned versions in examples, never `latest` or `stable`.
- Write for the reader: no "evidence", "source review", "reviewed on" or other notes about how the page was made.
- Plain words. No slash compounds such as "app/Hub" in sentences. Short sentences.

## Before you merge

- A reader can find their next stop and every required action without asking anyone.
- Every command uses services and executables that exist in the target release.
- Every file and secret can be obtained, every command says where it runs, and success is recognizable.
- Run `npx mint validate` and `npx mint broken-links` in `docs/`, and check the pages on desktop and mobile in the preview.
- Keep existing URLs and heading anchors. Add a redirect for a moved page and an invisible `<span id>` for a removed heading.
