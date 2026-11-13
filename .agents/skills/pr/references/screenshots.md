# Screenshots and clips

A PR that changes how a surface looks is reviewed from the media, not the diff. **The "before" shot
exists only before you implement.** Afterwards it costs a stash and a dev-server recompile, and the
reviewer usually gets an "after" alone.

Files in this folder:

| File | When |
| --- | --- |
| `clips.md` | The change is a scroll, an animation, a drag or a transition, or you plan to publish anything that is not a PNG. |
| `hosting.md` | You are ready to upload. The `assets-pr-screenshots` orphan branch, directory naming, URLs. |

## Inputs

- The change, and the surfaces it touches.
- A directory name for the upload: `ENG-<id>` from the ticket, or `pr-<number>`. If neither exists,
  ask. The branch is append-only, so a wrong directory cannot be withdrawn.
- Where you are in the flow. Nothing implemented yet is the good case.

## Prerequisites

- Database up: `pnpm db:up`. The Playwright user fixture writes through Prisma.
- Dev server on :3000. Start the `web` entry from `.claude/launch.json` with the browser preview tool,
  never `pnpm dev` in a shell.
- If a run dies with `Executable doesn't exist`, install the pinned browser:
  `pnpm exec playwright install chromium`.

## Procedure

### 1. Decide whether media is warranted

A `.tsx` under `apps/web/modules`, a Tailwind class, or anything in `packages/survey-ui` or
`packages/surveys` has a visual delta until a pair of shots proves otherwise.

Not visual: API routes, validators, transformers, types, migrations, docs prose, tests, CI. Say so in
one Evidence row and move on.

### 2. Write a throwaway capture spec

`apps/web` is auth-gated. Never type credentials. The fixture at `apps/web/playwright/lib/fixtures.ts`
mints a throwaway user. Name the spec with a `zz-` prefix, keep it untracked, and delete it after.

```ts
// apps/web/playwright/zz-shots.spec.ts — delete after capturing
import { test } from "./lib/fixtures";

const OUT = "/tmp/shots"; // outside the repo

test.use({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2, colorScheme: "light" });

test("capture", async ({ page, users }) => {
  const user = await users.create();
  await user.login();
  await page.goto(`/workspaces/${user.workspaceId}/surveys`);
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("dialog").waitFor(); // wait for the thing, never waitForTimeout
  await page.screenshot({ path: `${OUT}/filters-before.png` });
});
```

No session needed for: link surveys at `/s/<surveyId>`, `packages/survey-ui` in Storybook on :6006
(it cannot render `apps/web` components), and email templates (see
`apps/web/playwright/survey-email-preview.spec.ts`).

### 3. Capture "before" while `git status` is clean

```bash
pnpm exec playwright test zz-shots --project=chromium --reporter=dot
```

Output goes to `/tmp/shots/<subject>-before.png`. Locally the run stops at the first failure, and the
`dot` reporter overwrites `console.log`, so write any measurement to a file.

Already implemented? `git stash` without `-u`, so the untracked spec survives. Shoot, then pop it. Gate
the pop on the top stash message, and never chain push and pop.

Anything under `packages/*`: HMR will not rebuild it. Rebuild between the shots, or you will
screenshot the same code twice:

```bash
rm -rf packages/surveys/dist apps/web/public/js/surveys.* node_modules/.cache/turbo && pnpm build --filter=@formbricks/surveys... --force
```

Then hard-refresh. The browser caches `surveys.umd.cjs` too.

### 4. Implement, then capture "after" with the identical command

Same spec, same command, only the output path changes to `<subject>-after.png`.

### 5. Clips only for behaviour over time

Scroll and sticky behaviour, enter and exit animations, drag-and-drop, skeleton to loaded. Everything
else is a still. Read `clips.md` first: GitHub renders a GIF inline and neither `.webm` nor `.mp4`.

### 6. Clean up

```bash
rm apps/web/playwright/zz-shots.spec.ts && rm -rf test-results playwright-report
```

### 7. Upload

Read `hosting.md`. Work through the guardrails below first. The push is public and permanent.

### 8. Put the pair in Evidence

The media is the proof for the UI row of the **Evidence** table. Fold it if it is long.

```markdown
| Behaviour | How | Before → After |
| --- | --- | --- |
| Response card actions sit inside the card at 1280px | manual | Overflowed the edge → 12px inset |

<details>
<summary>Screenshots</summary>

| Before | After |
| --- | --- |
| ![Actions row overflowing the card edge](https://raw.githubusercontent.com/formbricks/formbricks/assets-pr-screenshots/ENG-1234/actions-before.png) | ![Actions row inside the card, 12px inset](https://raw.githubusercontent.com/formbricks/formbricks/assets-pr-screenshots/ENG-1234/actions-after.png) |

</details>
```

A two-column table puts the pair side by side. One row per subject. Alt text names what to look at
("actions row overflowing the card edge"), never "before".

## Framing rules

One variable. The pair must agree on route, viewport, colour scheme, seeded data and interaction
state. Anything else that moves reads as part of the change.

- `viewport: { width: 1280, height: 820 }`, `deviceScaleFactor: 2`, `colorScheme: "light"`. Shoot both
  schemes if the change touches a dark-mode pair.
- Drive every state the change is about: `Tab` for focus rings, `hover()` for hover, a submitted
  invalid form for errors, an open dialog for overlays. A state described but absent from the image
  is not evidence.
- Crop with numbers, never by eye. Pass the same explicit `clip` rectangle to both phases.
- Locale is `en-US`. The fixture creates the user that way.
- Show the positive too. If the claim is "no longer overflows", also show the container still
  scrolls. `overflow-hidden` hiding the problem looks the same as fixing it.

## Guardrails

The repository is public. Pushing to `assets-pr-screenshots` publishes the pixels to an
unauthenticated CDN, and the branch is append-only.

- Fixture users only. Never a real account, and never a password mid-entry, an API key, a session
  token, a webhook secret or a Stripe object.
- Check the whole frame: the account menu, the org name, an autofill dropdown, devtools, a
  notification from another app.
- No real customer data, including in seeded responses.
- Never rewrite or delete an existing directory on the branch. Merged PRs link to those files.
- If the media was not asked for, ask before pushing.
- Never ship an "after" alone.
