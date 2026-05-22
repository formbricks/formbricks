# Manual QA

Manual verification flows that exist alongside the automated [`./CHECKS.md`](./CHECKS.md). Use these when:

- A change touches the survey runtime (`packages/surveys` / `packages/survey-ui`) — automated tests can't catch every visual / focus / RTL regression.
- A change touches the dashboard editor or the response analysis surface — the click depth is too high for unit tests.
- A change touches auth, billing, integrations, or any outbound side-effect we can't safely fake.
- A change touches the embedding contract (JS SDK, runtime mount, host-page CSS isolation).

`apps/web/playwright/` carries the automated E2E coverage; everything below is the human pass that complements it.

## Coverage

| Area                                          | Status     | Setup                                                                                                                                  | Notes                                                                                                                                     |
| --------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web` — Dashboard                        | Maintained | `pnpm db:up && pnpm dev`. Sign in at `http://localhost:3000` with seeded user.                                                         | Desktop-only (mobile blocked by `NoMobileOverlay`). Verify in Chrome + at least one non-Chrome browser before releasing.                  |
| `packages/surveys` — Runtime                  | Maintained | Rebuild after every edit (see "Survey runtime cache" in `CHECKS.md`). Open the survey preview in the editor, or use a link survey URL. | Three modes to exercise: `modal`, `inline`, `link`. The bundled JS at `apps/web/public/js/surveys.umd.cjs` is what real customers ship.   |
| `packages/survey-ui` — Component lib          | Maintained | `pnpm storybook` (`http://localhost:6006`) and the editor preview pane.                                                                | Stories live next to the component in `*.stories.tsx`. Use them for keyboard / focus / RTL / locale variants.                             |
| `apps/storybook` — Shared stories             | Light      | `pnpm --filter @formbricks/storybook dev`.                                                                                             | Catches visual regressions for the dashboard component library.                                                                           |
| `apps/web` — Workflows PoC                    | Light      | `pnpm db:up && pnpm db:migrate:dev && pnpm dev`; use a seeded workspace/survey and worker queue.                                       | Manual demo only for 001-010. Confirms v3-backed dashboard, Response Completed enqueue, no-send previews, and disabled workflow behavior. |
| `packages/js-core` — Embedded SDK             | Maintained | Test against a real third-party host page (see "Embeddability" workflow below).                                                        | The SDK is the moat; broken embedding breaks every customer integration silently.                                                         |
| `docker/docker-compose.yml` — Self-host stack | Light      | `docker compose -f docker/docker-compose.yml up`. Smoke-test the same web flows.                                                       | Validate before any release; required env vars listed in `ENV_VARS.md`.                                                                   |

## Workflows

The 10 must-pass paths. Each is "one human pass" — they're not exhaustive, but if all 10 pass, the build is shippable.

| #   | Workflow                                     | Persona                     | Environment             | Expected Outcome                                                                                                                                           | Failure Signals                                                                                         | Status     |
| --- | -------------------------------------------- | --------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **Sign up → onboarding → first survey**      | New customer                | Dashboard               | Signup → email verification (or skip with `EMAIL_VERIFICATION_DISABLED=1` in dev) → onboarding wizard → first survey created with a template.              | Auth callback errors; stuck onboarding; survey list empty after "Create".                               | Maintained |
| 2   | **Build a multi-question survey**            | Survey creator              | Dashboard editor        | Add ≥3 question types (Open Text, Rating, NPS), add conditional logic, set a quota, save. Preview pane reflects every change.                              | Save fails; preview drifts from saved state; conditional logic editor doesn't render.                   | Maintained |
| 3   | **Answer a Link Survey**                     | End-respondent              | `/s/<surveyId>`         | Open the link URL, complete the survey to the end card. Submission appears in the dashboard responses table within seconds.                                | Runtime crash; question doesn't advance; submission missing or duplicated; CSS bleeding from host page. | Maintained |
| 4   | **Embed via JS SDK on a third-party page**   | Developer                   | Test HTML page          | Drop the `formbricks` snippet on a blank HTML page with a known `userId`/attributes, trigger via no-code or `formbricks.track("event")`. Survey appears.   | Survey never appears; `formbricks is not defined`; CSP violation in console; SDK fails to load.         | Maintained |
| 5   | **Identify a user + segment targeting** (EE) | Dev + analyst               | Dashboard + SDK         | `setUserId` + `setAttribute` from the SDK; the contact appears in `/contacts`; a Segment matches it; a Website & App survey targeted at the Segment fires. | Attributes don't sync; segment count stays 0; survey doesn't fire even when targeted user matches.      | Maintained |
| 6   | **Invite a teammate + change role**          | Org admin                   | Dashboard               | Invite via email; accept; promote to Manager; deactivate. Access changes correctly at every step.                                                          | Invitee can't accept; role change doesn't propagate; deactivated user still sees data.                  | Maintained |
| 7   | **Configure an integration**                 | Workspace admin             | Settings → Integrations | Connect Slack (or Google Sheets / Notion). Submit a test response; integration delivers it.                                                                | OAuth redirect loop; tokens not stored; test response not delivered.                                    | Maintained |
| 8   | **Export & analyze**                         | Response analyst            | Dashboard               | Open a survey's analysis tab. View summary + responses table; tag a response; export CSV/xlsx; build a Chart on a Dashboard.                               | Charts fail to render (check Cube is up); export download empty; tag doesn't persist.                   | Maintained |
| 9   | **Multi-language survey**                    | Survey creator + respondent | Dashboard + survey      | Add a non-default language to a survey; translate the headline; switch language in the runtime; submit a response.                                         | Language switcher missing; translation doesn't apply; response language tag wrong.                      | Light      |
| 10  | **Self-host smoke test**                     | Self-host operator          | `docker compose up`     | Bring up the full stack from `docker/docker-compose.yml`. Sign up + create + answer + analyze.                                                             | Container won't start; missing env var; Hub/Cube reachable failures; default port collisions.           | Light      |

## Survey-Runtime-Specific Checks

The runtime is high-leverage and easy to regress. After **any** change to `packages/surveys`, `packages/survey-ui`, or `packages/types`:

- **Rebuild + hard refresh.** See the "Survey runtime cache" section in `CHECKS.md` — the most common regression source is stale `surveys.umd.cjs`.
- **Stack vs simple arrangement.** Switch the survey's `cardArrangement` between `simple` and `straight` / `casual`. Both must render correctly.
- **Modal + inline + link modes.** Each is a separate code path in `survey-container.tsx`.
- **Placement.** `bottomRight` / `topRight` / `bottomLeft` / `topLeft` / `center` — exercise at least two on desktop.
- **Overlay.** `none` / `light` / `dark`. Click-outside should dismiss only when `clickOutside=true` and `overlay !== "none"`.
- **Keyboard nav.** Tab through every question type. Rating: `ArrowLeft` / `ArrowRight` + `Enter`. Submit: `Cmd/Ctrl+Enter`.
- **Focus ring.** Visible 3px brand-tinted ring on every interactive element. Never `outline: none` without a replacement.
- **RTL.** Set a language with `dir: "rtl"` (or pass `?lang=ar` on a link). Number rating scales must mirror correctly via `getRTLScaleOptionClasses`.
- **Themed brand.** Set a custom brand color in workspace styling; the runtime card should pick it up from `--fb-*` tokens. Borders, buttons, focus rings, progress fill all shift accordingly.
- **Host-page isolation.** Embed the survey on a page with a wild CSS reset / a dark theme / a heavy font override. The card must stay readable; the host page must stay unmodified.
- **Auto-close.** Run a modal survey with `autoClose` set. The progress bar shrinks; the modal closes; resetting on interaction works.

## Workflows PoC Demo

Use this script for [001-010 Workflows PoC vertical slice](../cowork/plans/001-010-workflows-poc-vertical-slice.md).
This is not the full Beta QA matrix.

1. Open the dashboard and navigate to the Workflows main sidebar section.
2. Create a new workflow from the dialog, enter a name and optional description, and confirm the
   builder loads from the v3 API response with that metadata.
3. Configure the Response Completed trigger, the If/Else condition, Send Email Preview, and Send
   Webhook Preview. Collapse and expand the node config drawer.
4. Save the draft and enable it.
5. Complete a matching survey response and confirm a workflow run is created in `queued`, then moves
   through `running` to `completed`.
6. Open run detail and confirm the trigger payload, step outputs, email preview, and webhook preview
   envelope are visible.
7. Open the workspace-level Workflow Runs page from the main navigation and confirm the same run is
   visible with its workflow name, status, timestamp, response id, and detail link.
8. Navigate between the Workflows list, workspace Workflow Runs, builder, workflow runs, and run
   detail pages and confirm route loading states use skeletons without dummy page-title text or large
   layout shifts.
9. Disable the workflow, complete another matching response, and confirm no new run is created.
10. Confirm no real email is sent and no outbound webhook request is made.

Status: Passed on 2026-05-22 for the 001-010 implementation session. The local demo used the seeded
workspace and survey, created workflow `cmpga6fzg0009sbmcjw5mje79`, enabled it, enqueued only the
`workflow-run.process` BullMQ job for run `cmpgabuce0001sb60hnwj9l9a`, verified completed run
detail, and disabled the workflow. The full response pipeline hook is covered by automated tests;
the manual pass intentionally avoided a full `responseFinished` pipeline job because that can also
invoke legacy side effects.

## Setup Data

The dev seed (`pnpm db:seed`) creates a baseline. For deeper QA add the following manually:

- **One organization, two workspaces** — to verify cross-workspace isolation.
- **One survey of each type** — `link`, `website`, `app`. With multi-language enabled on at least one.
- **One survey with logic + variables + recall** — exercises the conditional engine.
- **One survey with quotas + a segment** (EE) — exercises targeting + quota gating.
- **At least 50 responses across surveys** — for the analysis surface, charts, and pagination.
- **One contact CSV import** (EE) — exercises bulk attribute creation.
- **One configured integration** (Slack or webhook) — exercises outbound delivery.
- **One trial state + one downgraded state** (Cloud) — exercises `LimitsReachedBanner` + `PendingDowngradeBanner`.

`pnpm db:seed:clear` resets to a clean state. For larger fixtures, document the setup in a `cowork/plans/` doc rather than expanding this file.

## Devices and Browsers

- **Dashboard** — Desktop only. Primary: latest Chrome. Secondary: latest Firefox + latest Safari before release. Below `sm` (430px) the dashboard renders `NoMobileOverlay` by design.
- **Survey runtime** — Desktop + mobile. Primary: latest Chrome (desktop + Android). Secondary: latest Safari (desktop + iOS), latest Firefox. The runtime ships into customers' pages and must survive every realistic browser.
- **Email follow-ups** — Test the rendered HTML in at least Gmail (Chrome) and Apple Mail (macOS).
- **Locale matrix** — At minimum: `en-US`, one RTL locale (`ar`), one non-Latin (`ja` or `zh`). Lingo.dev auto-fills via `pnpm i18n` but the fonts and line-breaking still need a human eye.

## Update Rules

Add or update entries here when changes affect:

- **User-facing flows** — signup, survey creation, answering, response analysis, billing, integrations.
- **Roles, permissions, or auth** — any change to `getWorkspaceAuth`, `getAccessFlags`, the role hierarchy, or SSO config.
- **Embedded runtime contracts** — `renderSurvey` / `renderSurveyInline` / `renderSurveyModal` props, the `formbricksSurveys` global, the CSS scoping rules.
- **Self-host setup data** — required env vars, ports, services.
- **Survey runtime visuals or interactions** — stack animation, theming tokens, keyboard nav, RTL behavior.
- **Release-critical behavior** — anything an upgrade-from-prior-version customer would notice.

Small internal refactors, copy tweaks, and dependency bumps don't need updates unless they change how a human should verify the result.
