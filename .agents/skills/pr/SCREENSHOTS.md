# Screenshots

A PR that changes how a surface looks is reviewed from the media, not the diff. Read this **before the
first edit** of a UI change: the before shot is free while `git status` is clean.

## 1. Decide whether media is warranted

Assume a visual delta when the diff touches a `.tsx` under `apps/web/modules`, a Tailwind class, or
anything in `packages/survey-ui` or `packages/surveys`, until a pair of shots proves otherwise. API
routes, validators, types, migrations, docs, tests and CI are non-visual: write `No UI change` under the
Coverage table and stop here.

## 2. Capture before, implement, capture after

Prerequisites: the database (`pnpm db:up`); the dev server on :3000, started as a background task so
it does not block your turn; and the repo's pinned Playwright browser (`pnpm exec playwright install
chromium` if a run reports a missing executable). The `dot` reporter garbles `console.log`, so write a
measurement you need beside the shot to a file and read it afterwards.

Write a throwaway spec under `apps/web/playwright/` with a `zz-` prefix and delete it afterwards. The
fixture mints its own user, so never type credentials:

```ts
// apps/web/playwright/zz-shots.spec.ts — delete after capturing
import { test } from "./lib/fixtures";

const OUT = "/tmp/shots"; // outside the repo
const PHASE = process.env.PHASE ?? "before";

test.use({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2, colorScheme: "light" });

test("capture", async ({ page, users }) => {
  const user = await users.create(); // user + org + workspace + a seeded survey
  await user.login();
  await page.goto(`/workspaces/${user.workspaceId}/surveys`);
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("dialog").waitFor(); // wait for the element, not a timer
  await page.screenshot({ path: `${OUT}/filters-${PHASE}.png` });
});
```

```bash
PHASE=before pnpm exec playwright test zz-shots --project=chromium --reporter=dot
# … implement …
PHASE=after pnpm exec playwright test zz-shots --project=chromium --reporter=dot
rm apps/web/playwright/zz-shots.spec.ts && rm -rf test-results playwright-report
```

Surfaces without a session: a link survey at `/s/<surveyId>`; `packages/survey-ui` components in
Storybook on :6006; email templates via `apps/web/playwright/survey-email-preview.spec.ts`.

**Already implemented?** `git stash` (without `-u`, so the capture spec survives), shoot the before,
`git stash pop`. Anything under `packages/*` is imported built, so rebuild between the shots and hard-refresh, or both
shots show the same code:

```bash
rm -rf packages/surveys/dist apps/web/public/js/surveys.* node_modules/.cache/turbo && pnpm build --filter=@formbricks/surveys... --force
```

**Motion** (scroll, animation, drag, a multi-step transition) needs a clip; read [CLIPS.md](CLIPS.md).

## 3. Frame the pair

The pair differs in exactly one variable: the change.

- Same route, viewport (1280×820), `deviceScaleFactor: 2`, colour scheme, seeded data and interaction
  state. Shoot `light`, plus `dark` when the change touches a dark-mode pair.
- Drive every state the change is about: focus (`keyboard.press("Tab")`), hover, an error, an open
  dialog. A state named in prose but absent from the image is not evidence.
- Crop with the same explicit `clip` rectangle in both phases, never by eye. `clip` is CSS px, so it
  doubles at 2x.
- Locale stays `en-US`, which the fixture user already has.
- When showing that content no longer overflows, also show that its container still scrolls.

## 4. Host on the PR branch

Commit the images to the PR's own branch, delete them in the next commit, and push both commits in one
push. The images stay reachable at the first commit, through the PR's history, after the merge and after
the branch is deleted; the squash merge carries only the net diff, so `main` never receives them.
`.pr-assets/` is gitignored, so only this deliberate `git add -f` picks it up.

```bash
mkdir -p .pr-assets && cp /tmp/shots/*.png .pr-assets/
git add -f .pr-assets && git commit -q -m "chore: add PR screenshots" -- .pr-assets
git rm -r -q .pr-assets && git commit -q -m "chore: remove PR screenshots" -- .pr-assets
git push -u origin HEAD                    # both commits together, after the code commits
SHA=$(git rev-parse HEAD~1)                # the commit that holds the images
```

Embed `https://raw.githubusercontent.com/<owner>/<repo>/$SHA/.pr-assets/<file>.png`, taking owner and repo
from `git remote -v`. Check each URL answers 200 logged out (`curl -sI <url> | head -1`).

`assets-pr-screenshots` is the previous host: frozen for the links in merged PRs, so nothing new goes
there. The branch history must keep that commit: update the branch by merging `main` in, never by rebasing or
force-pushing past it. New shots after a review fix are a new add/remove pair with new file names.

## 5. Place the pair

Under the Coverage table, one row per surface, before and after side by side. Alt text names what to look
at, since it is the caption when an image fails to load:

```markdown
| Surface | Before | After |
| --- | --- | --- |
| Response card actions | ![Actions row overflowing the card edge](…/before.png) | ![Actions row inside the card](…/after.png) |
```

Fold more than three rows into `<details>`. The Coverage row the pair proves says `manual` and points at
it.

## Guardrails

The repository is public: an image you push is published for good. Check every frame against this
list before the push:

- Shoot fixture users only (`user-<n>-<timestamp>@example.com`). No real account, customer data, API
  key, token, secret or Stripe object in the frame.
- Check the whole frame, not just the subject: account menu, org name, autofill, devtools, notifications.
- Ship the before with the after; an after alone proves the surface exists, not that it improved.
