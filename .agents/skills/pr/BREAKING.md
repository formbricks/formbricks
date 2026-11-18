# Breaking changes

Read when the diff touches a public API shape, an env var or config key, a migration, a webhook, or the
SDK. The test is whether someone outside this repo has to change something to keep working.

## Breaking

- Renaming, removing or retyping a field in a public API request or response shape, requiring one that
  was optional, or changing an emitted value (`EN` → `en-US`).
- Removing or renaming an endpoint, route, env var or config key (including `charts/formbricks/values.yaml`
  and `.env.example`).
- Changing a default, a webhook payload, or the HTTP status code returned for an existing case.
- Adding an env var or config key that is required, or whose default does not keep existing installs
  working.
- Changing an exported signature of the SDK shipped from `packages/js-core`, `packages/survey-ui` or
  `packages/surveys`.
- Needing manual action on upgrade, including a migration that drops or renames a column or table.

## Not breaking

- Anything purely additive: an optional request or response field, a new endpoint or route, an env var
  whose default keeps existing installs working.
- Any change to code no external consumer reaches: functions, modules, types, and workspace-package
  exports other than the SDK surface above. "Internal API" means internal to this repo.
- A change to a shape no published release (prerelease included) contains yet: there is no consumer to
  break, so rename or delete it and fix its callers.

## Deciding and writing it up

Matches a bullet under **Breaking**: tick the box, whatever you feel about it. Matches none: leave it
unticked and say in one line why. The tick alone applies the `breaking-change` label, which feeds the
release notes and the self-hoster migration guide, so a tick "to be safe" invents an upgrade step that
does not exist; a reviewer who disagrees can still ask for it.

Ticked: replace the `Why:` line under the checkbox with one table row per breaking change, written
for an external integrator:

```markdown
| Change | Before | After | Who's affected | Action required |
| --- | --- | --- | --- | --- |
| `language` field on responses | `EN`, `DE` | `en-US`, `de-DE` | API v1 consumers | Map the new BCP-47 locale codes |
```

CodeRabbit's "Breaking changes match the diff" check compares the tick against the diff and expects a
ticked box to be explained.
