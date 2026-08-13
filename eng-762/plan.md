# ENG-762 — Settings tables unification

## Context

Every table across organization, workspace and account settings is styled differently. The audit of
current `main` confirms it: the 11 in-scope tables split into two incompatible implementations and
drift on every visual axis.

- **Semantic `<Table>` primitive** (4): pretty URLs, enterprise features, feedback directories,
  workspace team access, organization teams.
- **Hand-rolled `grid grid-cols-N` divs** (7): members, API keys, notification alerts, user actions,
  tags, feedback sources.

| Axis        | Values found in the wild                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container   | `rounded-lg border border-slate-200` · `overflow-hidden rounded-lg` (no border) · `overflow-hidden rounded-lg border` (uncoloured) · `rounded-xl border border-slate-200 bg-white shadow-xs` · none at all (tags) |
| Header tint | `bg-slate-100` (most) · `border-b` with no tint (user actions, feedback sources) · `bg-white` (tags) · `hover:bg-white` (enterprise features)                                                                     |
| Header type | `font-semibold text-slate-900` · `font-medium text-slate-500`                                                                                                                                                     |
| Row hover   | `hover:bg-slate-100` · `hover:bg-slate-50` · `hover:bg-transparent` · none (members, tags)                                                                                                                        |
| Row height  | `h-12` · `h-16` · `h-auto`                                                                                                                                                                                        |

The goal is consistency, reuse and better UX — so the plan fixes the _causes_ of the drift:

- Every settings table renders inside `SettingsCard`, which is already a
  `rounded-xl border border-slate-200 bg-white shadow-xs` frame, so each table's own frame produces a
  nested double border. Only `EnterpriseLicenseFeaturesTable` avoids it (via `noPadding`).
  Consequence: the `rounded-t-lg` on all 7 grid headers has never been visible.
- Grid header/row alignment is enforced only by a JSDoc comment (`card-table/index.tsx:29`:
  _"Must match the header."_). It has already failed five times: `webhook-table.tsx:55` `grid-cols-7`
  against a `grid-cols-12` heading; `edit-api-keys.tsx:171` `grid-cols-10` with base spans summing to
  9 plus a stray empty header cell, and a dead `grid-cols-9` at `:177`; `EditAlerts.tsx:75` a dead
  `grid-cols-8` on a 3-column table; `tags/loading.tsx:20` rendering an actions column the real table
  gates on `!isReadOnly`; and `edit-memberships.tsx` / `members-info.tsx` hand-maintaining the same
  `col-span-*` sequence in two files that each re-derive the same two feature flags.
- `EditAlerts.tsx:80` rows carry `cursor-pointer` with **no `onClick`** — only the inner
  `NotificationSwitch` is interactive.
- `feedback-sources-table-data-row.tsx:24` defines a local `getRelativeTime`, duplicating the shared
  `timeSinceDate` from `apps/web/lib/time.ts` and breaking the repo's date-rendering rule.
- Row accessibility is broken in the grid tables: `edit-api-keys.tsx:184` is a `role="button"` div
  wrapping six unlabelled divs, so a screen reader gets no column association. From the other
  direction, `feedback-directory-table.tsx:144-145` and `teams-table.tsx:79-80` sprinkle _redundant_
  `role="rowgroup"`/`role="row"` onto elements that already carry those roles.

## Decisions

1. **Framed dense table** as the baseline — one frame, `h-12` `bg-slate-100` header, divided rows;
   the look `skeleton-loader`'s `responseTable` variant already encodes.
2. **Converge on the semantic `<table>`**, not CSS grid.
3. **Scope: the ticket's 11 tables + the Survey Languages redesign.**
4. **Survey Languages: full redesign, alias-only Edit** (`code` is immutable server-side).
5. **`CardTable` stays a separate family**, untouched here — see _Follow-ups_.

---

## Delivery: 16 standalone PRs in 4 waves

Every PR below merges to `main` on its own and leaves the product working. Partial completion is safe
by construction: a migrated table looks right, an unmigrated one looks exactly as it does today. There
is no intermediate state where the app is half-styled in a broken way — the only cost of stopping early
is that consistency is incomplete.

Three rules make that true, and they are the reason the waves are ordered this way:

1. **A markup change and its Playwright update ship together.** Otherwise `main` goes red.
2. **A component deletion and its i18n key removal ship together.** `pnpm i18n` exits 1 on _unused_
   keys, so orphaning one fails the build.
3. **A table drops its `[&_tr:last-child]:border-b` only in its own migration PR**, never in Wave 1 —
   that override is currently what closes three borderless tables visually. It becomes redundant only
   once the table has a frame.

### Wave 1 — foundations (no table migrations)

| PR                                                    | Scope                                                                                                                                                                                                                                                                                                                                                               | Visible effect                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** `fix(ui): unify table primitive defaults`       | `table/index.tsx` fixes a–e; delete 3 `pointer-events-auto`, 2 `border-slate-200`, 7 `hover:bg-transparent` + 2 no-op cell variants, 2 `hover:bg-white`, 3 redundant empty-state `hover:bg-white`, 10 `font-medium text-slate-500`; **add** `hover:bg-slate-100` to `workflow-runs-table.tsx:95` and `authorized-apps/page.tsx:92`. Does **not** touch `TableBody`. | Row hairlines shift gray-200 → slate-200 everywhere. Three headers (enterprise features, authorized apps, `OpenTextSummary`) go slate-800/normal → slate-500/medium. |
| **2** `refactor(ui): add settings card body variants` | `SettingsCard`: `noPadding` → `bodyVariant`; migrate its 3 consumers.                                                                                                                                                                                                                                                                                               | The enterprise features table sits flush against the card's bottom edge.                                                                                             |

Fixes (a) and (c) in PR 1 **must be one commit** — `pointer-events-none` is also what suppresses the
header row's hover today, so dropping it alone gives two tables a hovering header.

Mostly deletions, so PR 1 reviews fast despite its file count. It is also the only PR that touches the
high-traffic TanStack tables (responses, contacts, attributes), so check those explicitly.

### Wave 2 — the primitive and the cheap conversions

| PR                                                                            | Scope                                                                                                   | Notes                                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **3** `feat(ui): add settings table primitive`                                | the new `settings-table/` folder + `column-classes.test.ts`, and **Pretty URLs** converted as the proof | One new component, one converted table. If the corner geometry is wrong you see it here with nothing else in the frame.            |
| **4** `refactor(settings): unify enterprise license features table`           | that table alone                                                                                        | Deliberately its own PR: its diff carries a **design decision** (header goes white → `bg-slate-100`), not a mechanical conversion. |
| **5** `refactor(settings): unify team access and feedback directories tables` | `access-table.tsx`, `feedback-directory-table.tsx`                                                      | No E2E exposure. Feedback directories is the first real use of `isRowDisabled`.                                                    |
| **6** `refactor(settings): unify organization teams table`                    | `teams-table.tsx` + `organization.spec.ts:130`                                                          | Separate from PR 5 only because it touches a spec — `id={team.name}` becomes `data-testid`.                                        |

### Wave 3 — the grid conversions

| PR                                                           | Scope                                                                                                      | Notes                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **7** `refactor(settings): unify api keys table`             | `edit-api-keys.tsx`                                                                                        | Proof case for the grid direction: first use of `hideBelow`, `stopRowClick` and the row activator.                                  |
| **8** `refactor(settings): unify user actions table`         | `ActionClassesTable.tsx`, `ActionRowData.tsx`, `action-settings-card.tsx`; delete `ActionTableHeading.tsx` | Deletes the `children: [JSX.Element, JSX.Element[]]` tuple. Its 3 i18n keys move to the column factory, so nothing is orphaned.     |
| **9** `refactor(settings): unify tags table`                 | `edit-tags-wrapper.tsx`, `single-tag.tsx`, `tags/loading.tsx`                                              | `loading.tsx` must change in the same PR — it duplicates the header markup. Shared `getTagColumns` factory is what kills the drift. |
| **10** `refactor(settings): unify notification alerts table` | `EditAlerts.tsx`                                                                                           | N tables (one per org), so a `.map`. Adds the `footer` slot. Drops the misleading `cursor-pointer`.                                 |
| **11** `refactor(settings): unify members table`             | `edit-memberships.tsx`, `members-info.tsx` + `organization.spec.ts`, `invite-existing-account.spec.ts`     | Largest visual delta of the 11 (gapped → divided rows) _and_ the most E2E exposure. Late on purpose.                                |
| **12** `refactor(unify): unify feedback sources table`       | `feedback-sources-table*.tsx`                                                                              | The only `frame="card"` consumer and the only `footer` consumer. Collapses two tab stops into one — flag in the QA section.         |

Wave 3 PRs are independent of each other; the order is by ascending risk, not dependency. Any of them
can be dropped or deferred without affecting the rest.

### Wave 4 — Survey Languages

| PR                                                                         | Scope                                                                                                                                        | Why this boundary                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **13** `refactor(languages): add language form validation`                 | `lib/validation.ts` + `validation.test.ts`                                                                                                   | Pure additive, nothing imports it yet. Lets the four rules — including the canonical `de` vs `de-DE` duplicate fix — be reviewed on their own merits, with tests, separately from the UI.           |
| **14** `refactor(languages): rebuild survey languages as a settings table` | the 3 new components, `page.tsx`, `loading.tsx`, **delete** the 5 old files, the i18n ledger, and the `survey.spec.ts` rewrite + `helper.ts` | **Cannot be split further.** Deleting the components orphans 2 i18n keys (build fails) and changes the accessible names `survey.spec.ts:301-317` drives. Delete, keys and spec are one atomic unit. |
| **15** `refactor(languages): move language actions to the settings module` | `multi-language-surveys/lib/actions.ts` → `settings/languages/actions.ts`                                                                    | Its last non-settings importer disappears in PR 14, so this lands cleanly as a rename with no path noise mixed into the rewrite.                                                                    |
| **16** `fix(languages): reject deleting a language in use by surveys`      | `lib/language/service.ts` guard, its service tests, and `settings-languages.spec.ts`                                                         | Last and isolated because it is the only **backend behaviour change** in the whole plan — revertable without unwinding any UI.                                                                      |

### If fewer, larger PRs are preferred

Batch to four: Wave 1 → one PR; Wave 2 → one PR; Wave 3 → one PR; Wave 4 → PR 13+14+15 together plus
PR 16 separate. PR 16 should stay on its own regardless — it is the only change that alters server
behaviour. PR 4's header decision is worth surfacing in the description even if it is batched.

### Progress

| PR  | Scope                                   | State                   | Branch                                             |
| --- | --------------------------------------- | ----------------------- | -------------------------------------------------- |
| 1   | table primitive defaults                | **open, draft — #8837** | `claude/eng-762-pr1-table-defaults`                |
| 2   | `SettingsCard` `bodyVariant`            | **open, draft — #8838** | `claude/eng-762-pr2-settings-card-body-variant`    |
| 3   | `SettingsTable` primitive + pretty URLs | **open, draft — #8839** | `claude/eng-762-pr3-settings-table-primitive`      |
| 4   | enterprise license features             | **open, draft — #8840** | `claude/eng-762-pr4-enterprise-features-table`     |
| 5   | team access + feedback directories      | **open, draft — #8841** | `claude/eng-762-pr5-access-and-directories-tables` |
| 6   | organization teams                      | **open, draft — #8842** | `claude/eng-762-pr6-org-teams-table`               |
| 7   | api keys                                | not started             | —                                                  |
| 8   | user actions                            | not started             | —                                                  |
| 9   | tags                                    | not started             | —                                                  |
| 10  | notification alerts                     | not started             | —                                                  |
| 11  | members                                 | not started             | —                                                  |
| 12  | feedback sources                        | not started             | —                                                  |
| 13  | language form validation                | not started             | —                                                  |
| 14  | languages UI rebuild                    | not started             | —                                                  |
| 15  | language actions move                   | not started             | —                                                  |
| 16  | language delete guard                   | not started             | —                                                  |

**They are stacked, not parallel**, because 3 depends on 1 and 2 and every conversion depends on 3. Each
PR's base is its predecessor's branch, so its diff shows only its own commit. As each merges, GitHub
retargets the next onto `main`. Wave 3 PRs (7–12) are independent of each other and can be reordered or
dropped freely; only their common ancestor (3) matters.

This document and the screenshot harness live on the `assets-itsjavi-prs` branch under `eng-762/`,
alongside the `pr-<number>/` image folders. That branch carries non-shipping artifacts only and
deliberately has **no pull request** — nothing here should reach `main`.

### Implementation notes learned while building

- **A control above an edge-to-edge table pays for its own gutter.** `bodyVariant="flush"` removes the
  card body's `px-4 pt-4`, so any button or switch rendered above the table needs `px-4 pt-4` on its own
  wrapper. Applied in `access-view.tsx` and `teams-table.tsx`; PRs 7–10 all have such controls.
- **A card with a conditional body needs a conditional variant.** `teams-view.tsx` renders either the
  table (wants `flush`) or an `UpgradePrompt` (wants `padded`), so it picks per branch.
- **`emptyMessage` is required but sometimes unreachable.** Where rows are a compile-time constant
  (enterprise features), pass `common.no_results` with a comment rather than inventing copy.
- **Prettier strips the trailing comma from `<TRow,>` in `.ts` but keeps it in `.tsx`**, where it is load
  bearing. Don't "fix" it back.
- **`isRowDisabled` should exclude the acting row.** A blanket predicate dims the row whose action is in
  flight, hiding its own spinner.

---

## Path corrections since the ticket was written

| Ticket path                                                                    | Current path                                                               |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `settings/(organization)/domain/...`                                           | `settings/organization/domain/...` (parens dropped)                        |
| `settings/(organization)/enterprise/...`                                       | `settings/organization/enterprise/...`                                     |
| `settings/(account)/notifications/...`                                         | `settings/account/notifications/...`                                       |
| `modules/ee/feedback-record-directory/.../feedback-record-directory-table.tsx` | `modules/ee/feedback-directory/components/feedback-directory-table.tsx`    |
| `unify/sources/components/connectors-table*.tsx`                               | `modules/ee/unify-feedback/sources/components/feedback-sources-table*.tsx` |

Live org/account settings **pages** now sit at `app/(app)/organizations/[organizationId]/settings/*`
and `app/(app)/account/settings/*`; the `workspaces/[workspaceId]/settings/organization|account/*`
directories hold only components plus orphaned `loading.tsx` files with no sibling `page.tsx`.

> **Standing constraint for every step below.** `pnpm i18n` **exits 1 on _unused_ keys**, not just
> missing ones (`packages/i18n-utils/src/scan-translations.ts:13,686,698`). Deleting a component
> orphans its keys and fails the build, so every deletion needs a key ledger: re-consume, or remove
> from `en-US.json` in the same commit. Only `en-US.json` is hand-edited.

---

## Step 0 — fix the shared foundations

One commit, because two of the fixes interact.

### `apps/web/modules/ui/components/table/index.tsx`

Change the base primitive rather than wrapping it: a wrapper leaves the wrong defaults in place for
the TanStack tables and any escape-hatch consumer, so the ~30 override classes never get deleted.
All 14 consumers were audited; the blast radius is two files.

| Fix | Change                                               | Effect                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | `TableHeader`: drop `pointer-events-none`            | 3 consumers (`contacts-table.tsx:261`, `attributes-table.tsx:257`, `ResponseTable.tsx:253`) delete their `pointer-events-auto`. **Must ship with (c)** — `pointer-events-none` is also what suppresses `TableRow`'s hover on header rows today.                                                            |
| b   | `TableRow`: `border-b` → `border-b border-slate-200` | The v3 compat shim at `modules/ui/globals.css:206-212` makes every bare `border-b` paint **gray-200 `#e5e7eb`** while every card frame paints **slate-200 `#e2e8f0`**. That mismatch is why `pretty-urls-table.tsx:65` and `access-table.tsx:36` add `border-slate-200` — both deletions.                  |
| c   | `TableRow`: drop `hover:bg-slate-100`                | Deletes 7 `hover:bg-transparent`, 2 no-op `hover:bg-transparent` on `<TableCell>`, 2 `hover:bg-white`, 3 redundant empty-state `hover:bg-white`. **Two files then need it added back explicitly**: `workflow-runs-table.tsx:95` and `authorized-apps/page.tsx:92`, whose rows rely on the inherited hover. |
| d   | `TableHead`: add `font-medium text-slate-500`        | Deletes 10 repetitions of exactly that string. `twMerge` means a consumer's `font-semibold` still wins, so the TanStack headers are unaffected. Enterprise features, authorized apps and `OpenTextSummary` shift to the treatment the other four already use.                                              |
| e   | `Table`: add a `containerClassName` prop             | Purely additive, matches upstream shadcn. `Table` hardwires `<div className="relative overflow-auto">`, so this is where a standalone frame lands instead of yet another wrapper div.                                                                                                                      |

**Do not change `TableBody`.** Its `[&_tr:last-child]:border-0` is _correct_ under a frame; removing it
double-lines the last row in `workflow-runs-table.tsx`, `contacts-table.tsx`, `attributes-table.tsx`
and `ResponseTable.tsx`. The four settings tables that undo it (`pretty-urls-table.tsx:56`,
`feedback-directory-table.tsx:154`, `teams-table.tsx:89`, `access-table.tsx:27`) only do so because
three of them have `overflow-hidden rounded-lg` with **no border**, so nothing closes the table and
they fake the bottom edge with a row border. Give them a frame and all four overrides delete
themselves. Document the rule: _the last row never draws a border; the frame closes the table._

Note also that `TableRow`'s `bg-white` paints over `<TableHeader className="bg-slate-100">` — the tint
must go on the header `<tr>`, not the `<thead>`. `OpenTextSummary.tsx:53` sets a `<thead>` tint that
has never rendered.

### `SettingsCard` — replace `noPadding` with `bodyVariant`

Only 3 consumers, so replace it outright rather than adding an overlapping prop.

```ts
type TSettingsCardBodyVariant = "padded" | "bleed" | "flush";
const BODY_VARIANT_CLASSES = { padded: "px-4 pt-4", bleed: "", flush: "-mb-4" };
```

`flush` also adds `overflow-hidden`. Migration: `email-customization-settings.tsx:206` and
`branding-settings-card.tsx:72` → `bleed` (byte-identical to today — they supply their own padding, so
a blanket `pb-0` would have regressed them); `EnterpriseLicenseFeaturesTable.tsx:113` → `flush`.

**How the corners work**, which is why this belongs on the card:

- _Top_ — the card's header block already owns the top corners (`SettingsCard.tsx:44`,
  `border-b border-slate-200 px-4 pb-4`), so the table's header band needs **no** `rounded-t-*`. All 7
  grid tables' `rounded-t-lg` gets deleted as the dead code it is.
- _Bottom_ — `-mb-4` cancels the card's `pb-4`, and `overflow-hidden` + the card's own `rounded-xl`
  clips the last row with the correct _inner_ radius, which a `rounded-b-xl` on an inner div would get
  wrong by the border width. The card's bottom border becomes the table's: one line, one radius, one
  owner.
- `overflow-hidden` is safe — every escaping overlay in these rows portals to `document.body`
  (`dropdown-menu/index.tsx:72`, `tooltip/index.tsx:21`, `popover/index.tsx:16`), covering the row
  kebab, the notification-alerts header tooltip and `MergeTagsCombobox`. Anything added later must too.

---

## Step 1 — the `SettingsTable` primitive

```
apps/web/modules/ui/components/settings-table/
├── index.tsx                        SettingsTable, SettingsTableFrame; re-exports skeleton + types
├── settings-table-skeleton.tsx
├── settings-table-row-actions.tsx   the one kebab
├── types.ts
└── lib/column-classes.ts            getHeaderCellClassName / getBodyCellClassName / getFrameClassName
```

Built from the `Table*` parts, so those parts remain the **escape hatch** for anything the column API
can't express — and thanks to Step 0 an escape-hatch consumer still inherits the corrected defaults.
The escape hatch costs consistency of structure, never of style.

### Column config, not JSX children

Worth the bigger per-call-site rewrite because it is the only thing that structurally fixes the two
failures the ticket is about: skeletons drifting from their tables, and headers living in a different
file from their rows. Export columns from a `getXColumns(t, flags)` factory that `loading.tsx` imports
too — the drift becomes unrepresentable.

```ts
export type TSettingsTableColumn<TRow> = {
  id: string;
  /** Already-translated. `null` renders an empty header cell — pair with `srLabel`. */
  header: ReactNode;
  cell: (row: TRow, index: number) => ReactNode;
  width?: `w-${string}`;
  align?: "left" | "center" | "right";
  hideBelow?: "sm" | "md" | "lg";
  cellClassName?: string;
  srLabel?: string;
  /** Clicks inside this column do not trigger `onRowClick`. For action buttons and nested links. */
  stopRowClick?: boolean;
  skeletonWidth?: `w-${string}`;
};
```

Table props: `columns`, `rows`, `getRowId`, `emptyMessage`, `frame?: "none" | "card"`, `isLoading`,
`skeletonRows`, `isRowDisabled`, `footer`, `getRowProps`, `bodyProps`, and
`aria-label`/`id`/`data-testid` passthrough. Row activation is a discriminated union so omitting
`getRowLabel` is a **compile error**, not a review comment:

```ts
type SettingsTableClickProps<TRow> =
  | { onRowClick?: never; getRowLabel?: never; isRowClickable?: never }
  | {
      onRowClick: (row: TRow) => void;
      getRowLabel: (row: TRow) => string;
      isRowClickable?: (row: TRow) => boolean;
    };
```

Props wrapped in `Readonly<>`; component declared `<TRow,>(...)` (trailing comma required for a
generic arrow function in `.tsx`).

### Column widths: `w-*` on the `<th>` with `table-auto`

Not `<colgroup>`: `display: none` on a `<col>` is not honoured, so a hidden column keeps reserving
width — and responsive hiding is needed by API keys, feedback sources and 4 of the 5 optional tables.
Colgroup and responsive hiding are mutually exclusive.

With `table-auto`, a percentage on the `<th>` is a suggestion the browser honours whenever content
fits, and when a `hidden sm:table-cell` column drops out the remaining percentages no longer sum to
100 so the browser rescales them — exactly what `grid-cols-N` + `col-span` was faking. Precedent:
`OpenTextSummary.tsx:55-58`. `table-fixed` is deliberately not the default; it suits the virtualised
TanStack tables with pixel sizes from `column.getSize()`, not settings tables where a long name should
be able to take space from a short date.

### Row activation

`role="button"` on a `<tr>` destroys the row in the accessibility tree — a `row` cannot be a `button`
— yet `edit-api-keys.tsx:185` and `workflow-runs-table.tsx:86` both do it. Instead: `onClick` on the
`<tr>` for the mouse, and the first non-`stopRowClick` column's cell content wrapped in a real
`<button type="button">` carrying `getRowLabel(row)` as its accessible name. One tab stop, real button
semantics, `<tr>` stays a `row`. `ActionClassesTable.tsx:40-49` already has this shape, and
`ActionTableHeading.tsx:9`'s `<span className="sr-only">` is already the `getRowLabel` equivalent.

### Emitted classes

```
frame="card"  container:   rounded-xl border border-slate-200 bg-white shadow-xs
frame="none"  container:   (nothing — Table's own "relative overflow-auto")
header <tr>:               bg-slate-100
header <th>:               (base) h-12 px-4 text-left align-middle font-medium text-slate-500
                           + text-center|text-right · hidden sm:table-cell · w-[22%]
body <tr> clickable:       cursor-pointer hover:bg-slate-50
body <tr> disabled:        pointer-events-none opacity-60   (+ aria-disabled)
row activator <button>:    -m-1 flex w-full items-center rounded-sm p-1 text-left
                           focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden
empty <td>:                h-24 text-center text-sm text-slate-500
skeleton bar:              h-4 rounded-xl bg-slate-200  (+ skeletonWidth ?? w-24)
```

`hover:bg-slate-50`, not `slate-100`: row hover must be lighter than the `slate-100` header band, and
the three grid tables with real row hover already use `slate-50`.

**Sticky header deliberately omitted** — nothing in scope needs it, and `containerClassName` makes it
a small later addition.

### One kebab, not five

Five row-menu implementations exist, each styled differently: `workflow-list-actions.tsx:136`
(`rounded-lg border bg-white p-2` + `sr-only` label), `language-view.tsx` (`rounded-sm p-1`, **no**
`sr-only` label), `feedback-source-row-dropdown.tsx`, `dashboard-dropdown-menu.tsx`
(`Button variant="outline"`), `chart-dropdown-menu.tsx`. `SettingsTableRowActions` gives one trigger
with the accessible label built in. `DropdownMenuItem` already accepts an `icon` prop
(`dropdown-menu/index.tsx:90`), so menu items need no new API.

### Testing the primitive

`lib/column-classes.ts` is a `.ts` file on purpose. AGENTS.md bans component unit tests for `.tsx` but
explicitly wants them for logic in `.ts`, and align/`hideBelow`/width/frame class resolution is pure
input→output. `column-classes.test.ts` is where this work gets real unit coverage, and it locks the
class contract without locking markup.

**No Storybook story.** `apps/storybook/.storybook/main.ts:20` globs only `../src/**/*.mdx` and
`packages/survey-ui/src/**/*.stories.*`, so the 23 existing `apps/web/modules/ui/components/*/stories.tsx`
files are already dead. Reviving it needs four changes (the glob, the `@` alias currently pointed at
`packages/survey-ui/src`, Tailwind `@source` coverage for `apps/web/modules/**`, and an i18n provider
in `preview`) — its own ticket. Use before/after screenshots on the PR instead.

---

## Step 2 — migrate the 11 tables

| Order | Table                                                      | Files                                                                                                                                                         | Effort   |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1     | **Pretty URLs** — the proof                                | `.../settings/organization/domain/components/pretty-urls-table.tsx`                                                                                           | trivial  |
| 2     | **Enterprise features** — alone; carries a design decision | `.../settings/organization/enterprise/components/EnterpriseLicenseFeaturesTable.tsx`                                                                          | trivial  |
| 3     | Workspace team access                                      | `modules/ee/teams/workspace-teams/components/access-table.tsx`                                                                                                | trivial  |
| 4     | Feedback directories                                       | `modules/ee/feedback-directory/components/feedback-directory-table.tsx`                                                                                       | moderate |
| 5     | Organization teams                                         | `modules/ee/teams/team-list/components/teams-table.tsx`                                                                                                       | moderate |
| 6     | API keys                                                   | `modules/organization/settings/api-keys/components/edit-api-keys.tsx`                                                                                         | moderate |
| 7     | User actions                                               | `modules/workspaces/settings/(setup)/components/ActionClassesTable.tsx`, `ActionRowData.tsx`, `action-settings-card.tsx`; **delete** `ActionTableHeading.tsx` | moderate |
| 8     | Tags                                                       | `modules/workspaces/settings/tags/components/edit-tags-wrapper.tsx`, `single-tag.tsx`, `.../tags/loading.tsx`                                                 | moderate |
| 9     | Notification alerts                                        | `.../settings/account/notifications/components/EditAlerts.tsx`                                                                                                | moderate |
| 10    | **Members**                                                | `.../edit-memberships/edit-memberships.tsx` + `members-info.tsx`                                                                                              | risky    |
| 11    | **Feedback sources**                                       | `modules/ee/unify-feedback/sources/components/feedback-sources-table.tsx`, `-rows-container.tsx`, `-data-row.tsx`                                             | risky    |

Pretty URLs first: one self-contained file, 3 columns, no interactivity, no loading state, no
Playwright dependency — yet it carries `font-medium text-slate-500`, two `hover:bg-transparent`, a
`border-slate-200` and the last-child override, so every Step 0 deletion shows up in one small diff.
If the corner geometry is wrong you see it immediately with nothing else in the frame.

Enterprise features second and alone, because its diff carries a **design decision** — its header goes
from white to `bg-slate-100` — rather than a mechanical conversion. Get that signed off in isolation.

Notes on the non-trivial ones:

- **Feedback directories** — first real use of `isRowDisabled`: `loading` on one row, `disabled` on all
  while any is loading. Deletes the redundant `role="rowgroup"`/`role="row"` and the two no-op
  `hover:bg-transparent` on `<TableCell>`.
- **Organization teams** — two mapped lists (`userTeams`, `otherTeams`) in one `<TableBody>`:
  concatenate with a discriminator so the "you are a member" column can branch. `id={team.name}` →
  `getRowProps`, `aria-label="Teams list"` → prop.
- **API keys** — `col-span-4 sm:col-span-2` → `width`, `hidden sm:block` → `hideBelow: "sm"`; the
  hand-rolled `role="button"`/`tabIndex`/`onKeyDown` (lines 185-198) → the primitive's activator; the
  two `stopPropagation` sites (copy icon, trash) → `stopRowClick` columns; dead `grid-cols-9` and the
  stray empty header cell deleted.
- **User actions** — deletes `ActionTableHeading.tsx` and the hostile
  `children: [JSX.Element, JSX.Element[]]` tuple. That indirection buys nothing: its caller
  `action-settings-card.tsx` is already `"use client"`, and a `<button>` cannot wrap a `<tr>`. Its
  three i18n keys move to the column factory, so nothing is orphaned.
- **Tags** — gains a frame for the first time. No row click, so no activator conflict, but the `h-16`
  row holds an `<Input>` and needs `cellClassName="h-16 py-3"`. The payoff is `loading.tsx` importing
  the same `getTagColumns(t, isReadOnly)` factory, which kills the column-count drift.
- **Notification alerts** — N tables, one per organization, so a `.map` of `SettingsTable`s;
  `workspaces[].surveys[]` flattens into one row array carrying the workspace name as a sub-line; the
  misleading `cursor-pointer` is dropped; the per-table "invite them" paragraph needs the `footer`
  slot; the org header block above each table stays hand-rolled.
- **Members (risky)** — the server/client split must collapse into `MembersInfo`, since a `columns`
  array holds `cell` functions and functions cannot cross the server→client boundary. Two flag-gated
  columns; rows contain `EditMembershipRole` (a Select) and `MemberActions`; rows go from `space-y-4`
  **gapped** to divided — the largest visual delta of the 11. Preserve the `ph-no-capture` classes on
  the name/email cells (`members-info.tsx:102,105`): that is PostHog redaction, not styling.
- **Feedback sources (risky)** — uses `frame="card"`; it is standalone under `PageContentWrapper`, not
  in a card. The two nested `<button>` sub-grids (lines 94-115, 130-147) exist solely to keep the
  middle origin `<Link>` clickable inside a clickable row; in a `<table>` that becomes a row-level
  `onClick` plus `stopRowClick` on the origin column, so **two tab stops collapse into one** — a
  behaviour change needing explicit QA. Swap the local `getRelativeTime` (line 24) for the shared
  `timeSinceDate`. It is the only consumer of `footer` (`FeedbackSourceSuggestions` renders inside the
  frame below the rows), so if it is descoped, descope `footer` with it.

**Behaviour to preserve** (ticket guardrail 4): row interactions stay as they are — feedback
directories and org teams keep inline action buttons rather than becoming kebabs, tags keeps inline
rename-on-blur, notification alerts keeps its `Switch`. Consolidating inline buttons into kebabs is a
UX change, not a restyle; it is a follow-up.

### E2E selectors that will otherwise break silently

| Selector                  | Source                                                        | Spec                                                            |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| `#membersInfoWrapper`     | `members-info.tsx:96`                                         | `organization.spec.ts:41`                                       |
| `#singleMemberInfo`       | `members-info.tsx:99` — a **duplicated DOM id**, invalid HTML | `organization.spec.ts:43`, `invite-existing-account.spec.ts:38` |
| `#shareInviteButton`      | `member-actions.tsx:144`, nested in the row                   | `organization.spec.ts:48`                                       |
| `id={team.name}` → `#E2E` | `teams-table.tsx:98,115`                                      | `organization.spec.ts:130`                                      |

Move Members and org teams to `data-testid` (`member-row`, `team-row`) and update the three specs in
the same commit — the duplicated `#singleMemberInfo` is a real defect worth retiring. Note
`organization.spec.ts:100` uses `#membersInfoWrapper > #singleMemberInfo:last-child`, a direct-child
selector a `<tbody>` would break; it is commented out, so leave it commented.

---

## Step 3 — Survey Languages redesign

Two things make this a rebuild rather than a restyle:

- **Add** pushes a sentinel row `{id: "new", ...}` into local state; `id === "new"` is the
  create-vs-update discriminator in three places (`edit-language.tsx:170`, `language-row.tsx:23,37`).
- **Save** fires one server action _per row_ via `Promise.all` (`edit-language.tsx:168-181`) — an
  `updateLanguageAction` for every pre-existing language even when untouched, each audit-logged as
  `updated`. Only the first error surfaces and there is no rollback, so a partial failure leaves mixed
  state until refresh. After this change, **one user intent = one action call.**

### Why Edit edits only the alias

`ZLanguageUpdate` (`packages/types/workspace.ts:44`) carries only `alias`, and
`apps/web/lib/language/service.ts:160-163` writes `{alias, updatedAt}` with a comment saying the
spread was deliberately removed. `createLanguage` is the only place canonical code validation lives.

Treating a code change as delete+create would be silently destructive, and worse than it first looks:

- `SurveyLanguage.language` is `onDelete: Cascade` (`main.prisma:1137`), so every join row across
  _all_ surveys in the workspace disappears, taking the `default` and `enabled` flags with it.
- The translated strings live in each survey's element i18n JSON keyed by language code. Only
  `removeLanguageKeysFromSurvey` strips them, and **nothing in the delete path calls it** — so the old
  code's translations survive as unreachable dead JSON and nothing exists under the new code.
- `Response.language` (`main.prisma:182`) stores the code _or_ the alias as a free-form string, so
  historical response-language filtering breaks.

So: kebab has exactly **Edit** (set the alias) and **Remove**. Picking the wrong language is fixed by
Remove + Add, which routes through the usage guard and is honest about what it destroys.

One real hazard to surface in copy, not block on: **the alias is a live routing key.**
`modules/survey/link/components/survey-renderer.tsx:223-235` and `link/lib/metadata-utils.ts:50-57`
resolve `?lang=` against `alias` as well as `code` (case-insensitively), so changing an alias
invalidates already-shared links. Say so in the Edit modal.

### Files

The current placement is backwards: `multi-language-surveys/components/` is otherwise all
survey-editor code, and `modules/workspaces/settings/languages/loading.tsx:5` reaches _into_ the
survey module just to render a skeleton header. Move the settings-only pieces to
`modules/workspaces/settings/languages/`, alongside its siblings (`settings/tags/components/` etc.).

| Action | File                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| new    | `.../languages/components/languages-table.tsx` — container; owns only `isAddModalOpen` + `editingLanguage`. No `languages` state: renders from props, `router.refresh()` after each mutation |
| new    | `.../languages/components/language-modal.tsx` — **one** component for both modes (`language: TLanguage \| null`); they share both fields and differ only in whether the picker is editable   |
| new    | `.../languages/components/language-row-dropdown.tsx` — kebab + its own `DeleteDialog`, matching `feedback-source-row-dropdown.tsx` and `dashboard-dropdown-menu.tsx`                         |
| new    | `.../languages/lib/validation.ts` + `validation.test.ts` — a `.ts` file so it is unit-testable                                                                                               |
| move   | `multi-language-surveys/lib/actions.ts` → `.../languages/actions.ts` — after the rewrite it has zero survey-editor importers; pure rename, do it as its own step                             |
| change | `.../languages/page.tsx` (pass `workspace.languages` + `workspaceId` instead of the whole `TWorkspace`), `.../languages/loading.tsx`                                                         |
| change | `apps/web/lib/language/service.ts`, `apps/web/lib/language/tests/language.test.ts`, `apps/web/locales/en-US.json`, `apps/web/playwright/survey.spec.ts`, `playwright/utils/helper.ts`        |
| delete | `edit-language.tsx`, `language-row.tsx`, `language-select.tsx`, `add-language-button.tsx`, `language-labels.tsx`                                                                             |

Deletion is safe — grep confirms `EditLanguage` is imported only by the settings page, the other four
only from within that set. **The survey editor uses `language-view.tsx`, which is independent** and
untouched (`survey.spec.ts:467-469`'s "Select Language" targets _that_ file, not this page).

`language-select.tsx` goes away in favour of `InputCombobox` (`@/modules/ui/components/input-combo-box`),
which is `Command`-backed and brings keyboard nav, `role="option"` items and an empty state for free —
replacing a hand-rolled popover built from Button + Input + `useClickOutside`.

Deleted along with the files: `isEditing`, `EditSaveButtons`, the `id: "new"` sentinel,
`AddLanguageButton`'s one-pending-row gate (structurally unnecessary once Add is a modal), the
`Promise.all` save, and the `useEffect` that resyncs local state.

### Columns

`Language` · `Identifier (BCP-47)` · `Alias` · empty actions head (rendered even when `isReadOnly`, so
`colSpan` stays stable, as `feedback-directory-table.tsx:151` does).

`getLanguageLabel` returns `string | undefined` (`packages/i18n-utils/src/utils.ts:4332`) and many
catalog entries lack non-English labels, so wrap it:
`getLanguageLabel(code, locale) ?? getLanguageLabel(code, "en-US") ?? code`. Without this the cells go
blank for some locales — a live bug in `language-view.tsx:394` that must not be copied.

Sort rows by `createdAt` ascending with `id` as tie-break, in the component. `lib/workspace/service.ts:19`
selects `languages: true` with **no `orderBy`**, so row order after `router.refresh()` is otherwise
unspecified. Sorting in the component avoids touching `getWorkspace`, which the whole app shares, and
avoids locale-dependent collation.

Rejected: Created/Updated (no decision value, pushes to five columns) and **Default** — "default" is a
per-_survey_ property on `SurveyLanguage.default`, so a workspace-level Default column would be
actively misleading.

### Validation

`lib/validation.ts` exports a schema **factory** plus stable error codes, translated at the render
site — the established pattern (`unify-feedback/sources/types.ts:287` emits
`"FEEDBACK_SOURCE_NAME_REQUIRED"`, `edit-feedback-source-modal.tsx:286` maps it). Keeping `t` out of
the schema keeps it a pure, testable function. Memoize on `[existingLanguages, editingLanguageId]` so
`zodResolver` isn't handed a new schema each render.

Four rules carry over from `edit-language.tsx`, now as **inline field errors** via `react-hook-form` +
`zodResolver` (`mode: "onChange"`) instead of four `toast.error` calls: empty code; duplicate code;
duplicate alias; alias equal to any row's code; alias colliding with an ISO code from
`iso639Languages`.

One is a genuine bug fix: compare codes **canonically** (`normalizeLanguageCode(x) ?? x`). Today
`edit-language.tsx:37` compares raw lowercased strings, and the DB unique index is on the literal
string (`@@unique([workspaceId, code])`), so a workspace holding a legacy bare `de` accepts a second
`de-DE` — two rows for the same language. The Add modal's options are `supportedLanguages` minus
existing ones, compared canonically, so duplicates become mostly unreachable rather than an
after-the-fact error.

Also normalize a blank alias to `null` on submit. `ZLanguageInput.alias` is `.nullable()` but the
current UI writes `""` (`edit-language.tsx:100`, `language-row.tsx:35`). Both already render as `—`,
and `survey-renderer.tsx`'s alias match is false for both, so this is invisible today — but it is what
would eventually make a `@@unique([workspaceId, alias])` index possible.

**Reuse the three existing server actions as-is.** The repo rule bans _new_ server actions; this
redesign adds none and removes calls. Migrating to `/api/v3` would mean ~10 new files plus
re-implementing two things the action wrapper gives free — `withAuditLogging` and the PostHog
`workspace_language_created` capture — and a second copy of `checkAuthorizationUpdated`'s two-branch
authz matrix. Wrong trade for a 3-to-5-row admin table in the same PR as a UI rewrite. Recorded as a
follow-up; this redesign makes it mechanical (four call sites, one action per intent).

### The "in use by surveys" guard

Today it is client-only and advisory, and `deleteLanguageAction` performs **no** check
(`actions.ts:75-107`) — the only thing between a request and a workspace-wide cascade is a disabled
button in one React component. Add the check to `deleteLanguage` server-side, right after the
workspace check, reusing the existing `getSurveysUsingGivenLanguage` and throwing `ValidationError`
(already imported and thrown by `createLanguage`, so it flows through the same path into
`getFormattedErrorMessage`).

This is a **behaviour change** — flag it in the PR. No supported UI flow regresses, since today's
button is already disabled in exactly this case; only bypass paths break, which is the point. It needs
`apps/web/lib/language/tests/language.test.ts` to gain `surveyLanguage: { findMany: vi.fn() }` in its
mock, the existing happy path stubbed to `[]`, and a new sad-path test. A TOCTOU window remains
(`getSurveysUsingGivenLanguage` is `reactCache`d per request), but it is now fail-**closed**.

Client side, `DeleteDialog` covers both cases via `disabled` (its equivalent of
`ConfirmationModal.isButtonDisabled`), with `text` swapping between
`delete_language_confirmation` and `cannot_remove_language_warning` and `children` carrying a real
`<ul>` of survey names — replacing the `• ${name}`-joined template string that is the only reason
`ConfirmationModal` needs `whitespace-pre-line`. Open the dialog immediately on Remove with the
destructive button disabled while the usage query resolves; today the click does nothing visible until
the round-trip finishes.

### i18n ledger

**Reuse 16** existing `workspace.languages.*` keys — but note they currently live _only_ inside the
five deleted files, so each must be re-consumed or the scanner fails: `add_language`, `alias`,
`alias_tooltip`, `identifier`, `language`, `search_items`, `cannot_remove_language_warning`,
`remove_language_from_surveys_to_remove_it_from_workspace`, `delete_language_confirmation`,
`remove_language`, `language_deleted_successfully`, `please_select_a_language`,
`duplicate_language_or_language_id`, `conflict_between_identifier_and_alias`,
`conflict_between_selected_alias_and_another_language`, `no_language_found`.

**Delete 2** — both become orphans: `edit_languages` (the global Edit-mode button is gone) and
`languages_updated_successfully` (plural bulk-save toast).

**Add ~7**: an Add-modal description, `edit_language` title, `edit_language_description` (explaining
code immutability), `alias_placeholder`, `duplicate_alias`, `language_added_successfully`,
`language_updated_successfully` — plus optionally a warning that changing an alias breaks existing
links. `alias_placeholder` is a bug fix: `language-row.tsx:34` hardcodes `placeholder="e.g. en_us"`,
violating the all-text-via-`t()` rule.

**Edit 2 values**: `no_language_found` drops "below" (the Add button now sits above the table), and
`search_items` → "Search languages". The latter changes a Playwright selector.

---

## Verification

```
pnpm lint && pnpm typecheck
pnpm test            # column-classes.test.ts, validation.test.ts, language service tests
pnpm format:check    # import order is enforced here
pnpm i18n            # exits 1 on unused keys — run after every deletion commit
pnpm build
```

E2E — three specs assert on selectors this work changes:

```
pnpm test:e2e -- organization.spec.ts invite-existing-account.spec.ts action.spec.ts survey.spec.ts
```

Rewrite `survey.spec.ts:301-317` for the new languages flow, extracting an `addWorkspaceLanguage`
helper into `playwright/utils/helper.ts` (the spec already imports that module and adds two languages
back to back). The `.nth(1)` on line 316 and the `waitForTimeout(2000)` on line 318 both disappear:
the `.nth(1)` exists only because the old `LanguageSelect` hides filtered options with CSS instead of
unmounting them (`language-select.tsx:79`), so a second "German" node exists in the DOM. One combobox
inside a modal removes that flakiness class rather than working around it.

Add `apps/web/playwright/settings-languages.spec.ts` (modelled on `survey-archive.spec.ts`) covering:
add → row appears; edit sets an alias **and the picker is absent** (`toHaveCount(0)` — the regression
guard for the immutability decision); remove an unused language; and remove a language used by a
seeded survey → dialog lists the survey name, destructive button `toBeDisabled()`. That last flow has
no automated coverage today. Add one inline-validation case too, since that behaviour replaces four
`toast.error` calls.

Manual pass with `pnpm db:up && pnpm dev`, each surface also at a narrow width (the responsive columns
in API keys and feedback sources):

- Org: Teams/Members · API Keys · Domain · Enterprise · Feedback Directories
- Workspace: Team Access · Survey Languages (add / edit / remove / remove-blocked / read-only member) ·
  App Connection (user actions) · Tags
- Account: Notifications
- Feedback Sources — the standalone `frame="card"` case, and the only kebab inside a framed container,
  so it proves the portal assumption
- Regression check on the four TanStack tables Step 0 touches (responses, contacts, attributes,
  workflow runs) plus authorized OAuth apps

What to look for: exactly one border line where the table meets the card header and the card's bottom
edge; identical header tint and type on every page; row hover lighter than the header band; no
double-lined last row; empty states identical in copy position and spacing.

## Risks

- **`pnpm i18n` will fail** if a deletion commit orphans keys. Highest-probability breakage in the
  whole plan; the ledgers above are the checklist.
- **Step 0 touches 14 consumers**, including the highest-traffic tables in the product (responses,
  contacts, attributes) which are not otherwise in scope. Check them explicitly before merging Step 0.
- **Members has the largest visual delta** (gapped → divided rows) _and_ the most E2E exposure — last
  in the order for that reason.
- **Feedback sources changes tab-stop behaviour.** Intentional; call it out in the PR's QA section.
- **The `deleteLanguage` guard is a backend behaviour change** — isolate it in its own step so it is
  revertable without unwinding the UI.
- **`InputCombobox` has its own max-width** and will behave differently from the hand-rolled popover;
  verify inside `DialogContent width="narrow"`.

## Follow-ups (deliberately out of scope)

- **Tables the ticket missed**, same drift: webhooks (`modules/integrations/webhooks/components/`
  `webhook-table.tsx` + `webhook-table-heading.tsx` + `webhook-row-data.tsx` — same tuple pattern, and
  its dead `grid-cols-7` is also the _wrong number_), the four integration `ManageIntegration` tables
  (Sheets, Airtable, Notion, Slack — trivial each), authorized OAuth apps, and
  `modules/ui/components/load-segment-modal`.
- **`CardTable` cleanup**, small and independent: make `href` optional so
  `modules/survey/list/components/survey-card.tsx` — a byte-level clone differing only in `shadow-xs`
  vs `shadow-sm` — can adopt it; it is blocked today only because its rows are conditionally clickable.
  Delete the unused `CardTable` root export (it forwards no ref, so both consumers hand-roll its
  `space-y-3` on their auto-animate parent). Then apply the column-config idea there as the second proof.
- **`/api/v3` migration** for workspace-language CRUD with TanStack Query hooks.
- **A "used in N surveys" column** for languages — one `surveyLanguage.groupBy`, and it would turn the
  usage guard from a click-time surprise into visible information.
- **`@@unique([workspaceId, alias])`**, gated on an `UPDATE "Language" SET alias = NULL WHERE alias = ''`
  backfill that this PR's normalization makes eventually safe.
- **Orphaned `loading.tsx` files** under `workspaces/[workspaceId]/settings/organization|account/*`
  with no sibling `page.tsx`, while the live routes have none at all.
- **Consolidating inline row buttons into kebabs** where a row has 2+ actions — a UX change the
  ticket's parity guardrail excludes.
- **Reviving Storybook for `apps/web`** — four config changes; would let the primitive have a story.
- **`DESIGN.md` does not exist** in this repo, though `AGENTS.md` references
  `.agents/formbricks-context/DESIGN.md`. The de-facto spec is `Card`'s class string plus whatever each
  file does. This work produces the first written table contract; worth promoting into a real doc.
