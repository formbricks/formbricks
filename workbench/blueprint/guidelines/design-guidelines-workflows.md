# Design System Specification: Workflows Builder

- **Theme:** The Workshop (shared with the dashboard — see [`design-guidelines-dashboard.md`](./design-guidelines-dashboard.md))
- **Product surface:** Workflows inside `apps/web` — list, builder, runs, run detail
- **Framework:** Next.js 16 (App Router, RSC) + React 19
- **Canvas engine:** [xyflow / React Flow](https://reactflow.dev) — same lineage as Twenty and Typeform's flow editors
- **Styling:** Tailwind CSS v3 (config in [`apps/web/tailwind.config.js`](../../../apps/web/tailwind.config.js)) + shadcn/ui primitives on Radix
- **Color schemes:** **light only**. Dark CSS variables exist in the dashboard but are not shipped; build against the light surface and do not branch on `dark`.
- **Platform:** Web, desktop-first. The workflow builder needs canvas space; `<sm` continues to render `NoMobileOverlay`.

This guide tells designers and engineers how the Workflows feature should feel, what it should prefer to reuse from the dashboard catalog ([`components-guide-dashboard.md`](./components-guide-dashboard.md)), and what kinds of workflow-specific components it is likely to introduce. It is a design-system reference, not a one-mockup implementation spec — exact final names, props, and per-trigger/per-action layouts are owned by the implementation plans in [`workbench/cowork/plans/`](../../cowork/plans/).

PoC scope note: [Plan 001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md) implements a
smaller vertical slice of this design system. It should still follow the same canvas, drawer, node,
and dashboard reuse principles, but dry-run launchers, audit/run-log depth, real side-effect
warnings, migration surfaces, and full run-detail polish are full MVP/Beta surfaces unless the PoC
plan explicitly includes them.

---

## 1. Creative North Star

> **A workshop bench with a circuit board on it.** Calm slate scaffolding, predictable tools, but with explicit signal flowing through colored wires. Where the dashboard hides the brand teal so the work stands out, the workflows builder uses **a small, deliberate category palette** to make the structure of a workflow legible at a glance.

What this means in practice:

- The canvas is the same slate-50 the dashboard uses; nothing about the workshop changes.
- Nodes are white workbench cards with hairline slate-200 borders, like every other dashboard surface.
- The only place color earns its place is the **category chip** at the top of each node and on the edge pills between them. Color tells the user "this starts the workflow", "this branches", or "this creates an external side effect" without requiring the exact action name.
- Animations are reserved for canvas affordances (drag, snap, dry-run replay). The builder should not feel "alive" — it should feel like CAD.
- Specific reference images are inspiration for density, hierarchy, and interaction patterns. They are not complete screen specifications; the system must stay open to new trigger, action, flow, compute, AI, and human-input types.

What it is not:

- Not a Figma/Miro/whiteboard. The canvas is a graph editor, not an infinite drawing surface. Nodes snap; edges follow shapes; freeform geometry isn't a feature.
- Not the survey editor. The survey editor is a list of stacked blocks; workflows are a directed graph. We don't reuse `BlockCard` / `BlocksDroppable` here.
- Not a marketing surface for the brand color. Brand teal still earns its place only on "you are here" and on the activate/publish CTA.

---

## 2. Source of Truth

A workflow is a JSON document validated by zod schemas (see [`decisions/002-workflows-tech.md`](../decisions/002-workflows-tech.md)). The canvas is a **view** over that JSON; React Flow state is derived from the document, not the other way around.

Design implications:

- Every interaction in the UI must be expressible as a JSON edit.
- Free-floating React Flow positions are persisted as `position` metadata on the JSON node; they have no behavioral meaning.
- The auto-layout pass is the default; manual layout is a user override saved into the doc.
- If a behavior can't be modeled in the JSON schema yet, it shouldn't have UI affordances yet.
- Trigger and action UIs are schema-driven where possible. The drawer can specialize for a node type, but it should not introduce behavior that only exists in React component state.

---

## 3. Page Architecture

Workflows occupy four routes inside the workspace shell. All four sit inside `WorkspaceLayout` (sidebar + `TopControlBar` + content), so app-level chrome is already handled.

| Page             | Purpose                                                                             | Layout primitives                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Workflows list   | Browse, filter, and create workflows; see lifecycle status                          | `PageContentWrapper`, `PageHeader`, `DataTable*`, `EmptyState`, `Badge`                             |
| Workflow builder | Edit a single workflow on the canvas                                                | Full-bleed canvas inside `PageContentWrapper`, top step strip, drawer over canvas, floating toolbar |
| Workflow runs    | Paginated list of every run across the workspace, filterable by workflow and status | `PageContentWrapper`, `PageHeader`, `SecondaryNavigation`, `DataTable*`, `Badge`                    |
| Run detail       | Visual replay of a single run with per-step inputs, outputs, logs                   | Two-column: timeline left, inspector right; reuses run status pill                                  |

The builder is the only one that diverges from the standard dashboard page shape. List and runs pages stay inside the normal padded `PageContentWrapper` rhythm.

---

## 4. The Builder Page in Detail

### 4.1 Top Strip

A step-strip across the top of the page acts as the builder's "wizard" indicator. The reference image shows steps like _Content → Settings → Logic → Translations → Style → Distribution_; for workflows the analogues are something like **Setup → Build → Test → Publish** (final wording is product copy, not design).

- **Pattern:** prefer `SecondaryNavigation`. It already supports `activeId`, a 2px `bg-brand-dark` underline, disabled tabs with tooltips, and a loading state — close to the strip needed here.
- **Position:** inside `PageHeader`'s `children` slot, same as elsewhere in the dashboard.
- **Right side:** primary actions — `Save` (outline) and `Activate` / `Publish` (default = `bg-primary` slate-900 button). On the activate CTA only, consider promoting to `bg-brand-dark` so the action is visually distinct from a generic save — this matches the dashboard's reserved use of teal for "you are here / commit." Don't add a third button next to those without a strong reason.

### 4.2 The Canvas

- **Background:** `bg-slate-50` page surface with a faint dotted grid. Use React Flow's built-in `Background` with `variant="dots"`, `gap={24}`, `size={1}`, `color="#cbd5e1"` (slate-300). The grid is intentionally low-contrast — it should disappear at the edges.
- **Padding:** the canvas runs edge-to-edge inside `PageContentWrapper`. Disable `PageContentWrapper`'s default `p-6` for this route, or use a wrapper variant that drops the gutter. Do not nest the canvas in a `SettingsCard`.
- **Camera:** pan via space-drag or right-click drag; zoom via scroll + a `MiniMap` only if the workflow is realistically going to exceed two screens. Skip the minimap for MVP.
- **Selection:** click selects a single node; shift-click adds to selection; drag-rectangle selects multiple. Selection state lives in canvas state; the JSON document is unaffected.
- **Connection:** edges are drawn by dragging from a node's bottom handle to a target's top handle. Invalid drops (e.g., creating a cycle, connecting two triggers) snap back with a `react-hot-toast` error.
- **Auto-layout:** every save triggers an auto-layout pass (top-down hierarchical) unless the user has manually positioned. Use `dagre` or `elkjs`; both are well-trodden React Flow companions. The chosen library belongs in an implementation plan, not here.

### 4.3 The Floating Toolbar

A single horizontal `IconBar` floats at the bottom-center of the canvas, ~16px above the page edge. Contents:

- Zoom out, zoom in, fit-to-view, 100% reset (group 1)
- Undo, redo (group 2)
- Auto-arrange (re-run layout) (group 3)
- Dry run (group 4, separated visually — see §10)

Use the existing `IconBar` component with `TooltipRenderer` on every button. Buttons are 32×32 with `border-slate-200`, `bg-white/95 backdrop-blur` so the toolbar reads above the dotted grid without obscuring node edges.

### 4.4 The Node Configuration Drawer

Per [decision 002](../decisions/002-workflows-tech.md), the configuration panel must be a **fixed/absolute drawer over the canvas, collapsible** — not a static sidebar that permanently consumes canvas space.

- **Size:** width 384px (`w-96`); full height of the content area; positioned `absolute right-4 top-4 bottom-4`.
- **Surface:** `bg-white rounded-xl border border-slate-200 shadow-card-md` (the existing `shadow-card-md` token), so it sits visually above the canvas grid.
- **Collapse:** a slim handle on the inner edge collapses to a 32px rail. Persist the collapsed state per-user in a cookie, same pattern as `MainNavigation`.
- **Header:** node title + category chip + overflow `DropdownMenu` (Duplicate, Delete, Copy ID). Close (`X`) button at the right edge.
- **Body:** uses standard `Form`, `Input`, `Select`, `Switch`, `RadioGroup`, and related dashboard form primitives wherever they fit — _no bespoke form chrome by default_. Trigger/action-specific sections are allowed when the schema needs them. For conditional predicates, prefer `ConditionsEditor` or a thin workflow wrapper around it (see §6.2).
- **Footer:** `Cancel` + `Save` row, slate-900 primary, outline cancel.

If multiple nodes are selected, the drawer shows an "N nodes selected" summary with bulk delete/duplicate, similar to `BulkEditOptionsModal` in the survey editor.

---

## 5. Node System

Every node on the canvas follows the same **base node contract**: category chip, title, summary body, connection handles, selection state, and menu affordances. Trigger and action types can specialize their summaries and configuration drawers, but they should still read as members of the same system.

### 5.1 Anatomy

```
┌─────────────────────────────────────────────┐
│  [chip] Title                          [⋮]  │  ← Header (h-9)
├─────────────────────────────────────────────┤
│                                             │
│  Body (1–3 lines of summary content)        │
│                                             │
└─────────────────────────────────────────────┘
        ▲                                ▲
   top handle                       bottom handle
```

- **Outer card:** `rounded-xl bg-white border border-slate-200 shadow-card-sm`, min-width 280px, max-width 360px.
- **Header strip:** 36px tall, `border-b border-slate-200`, holds:
  - Left: the **category chip** (see §6) — a 24px rounded-md tile with a white icon, plus the category label in `text-xs font-medium text-slate-600`.
  - Center / left-of-overflow: the node's title in `text-sm font-semibold text-slate-800`.
  - Right: an `IconBar`-style overflow `⋮` that opens a `DropdownMenu` (Duplicate, Delete, Disable, Copy ID).
- **Body:** `p-3 text-sm text-slate-600`. Holds the human summary of the node's config (e.g., "On Response Completed in _Customer NPS Survey_" or "POST `https://api.example.com/x`"). Keep it to ≤3 lines; truncate the rest with ellipsis. Detail belongs in the drawer, not on the canvas.
- **Handles:** 8×8 circle, `bg-white border-2 border-slate-300`, on hover `border-brand-dark`. Trigger nodes have only a bottom handle; terminal/leaf nodes have only a top handle.
- **Selection state:** add `ring-2 ring-brand-dark ring-offset-2 ring-offset-slate-50`. The card itself does not change color.
- **Hover state:** `shadow-card-md` (one step deeper than rest).
- **Error state:** the chip background switches to `bg-error-background`, foreground `text-error-foreground`, plus a small `AlertCircle` icon next to the title. The body retains its normal slate body text.
- **Disabled node** (when the parent workflow is `disabled` and we still want to render the canvas read-only): the card gets `opacity-60`, handles disappear, drawer is read-only.

### 5.2 The Inline Add Affordance

Between two connected nodes, hovering the edge reveals a 24×24 `+` pill centered on the edge midpoint. Click opens the **trigger/action picker** (§7). This mirrors the survey editor's `AddElementButton` pattern but rendered on edges rather than in a list.

- Surface: `bg-white border border-slate-200 rounded-full shadow-card-sm`, icon in `text-slate-700`.
- Position: React Flow's `EdgeLabel` mode with `position={0.5}` along the edge path.
- Visible only on hover of the edge OR when the parent edge is selected.

### 5.3 Branch Nodes (If/Else)

Branch nodes (conditions, switch-style logic) produce **two or more output handles**. The visual:

- The single node has labeled output handles (`true`, `else`, or arbitrary case labels).
- Each outgoing edge automatically gets a pill near its source labeled with the handle (`true`, `else`, `any is true` for grouped conditions). Pills use semantic background:
  - `true` → `bg-success-background text-success-foreground`
  - `false` / `else` → `bg-slate-100 text-slate-600`
  - any is true / matched / fallback → `bg-info-background text-info-foreground`

### 5.4 Run-Replay Decoration

When a node is rendered inside the Run Detail view (not the editor), the header chip is decorated with a **status dot**:

- Queued → `bg-slate-300`
- Running → `bg-info` with a slow pulse (animation `ping-slow` already exists in the Tailwind config)
- Completed → `bg-success`
- Failed → `bg-error`
- Canceled / skipped → `bg-slate-400` outlined

These mirror the run status vocabulary in [decision 002](../decisions/002-workflows-tech.md) (`queued`, `running`, `completed`, `failed`, `canceled`).

---

## 6. Category Color System

Reference icon grids (data / AI / flow / core / human input) group actions by **what they do**, not what they are called. Each category has a single color identity used everywhere — the chip on a node, the icon in the trigger/action picker, and the pill on an edge that originated from a node of that category.

The roster below is the initial system, not a closed taxonomy. New trigger/action families can be added when product behavior justifies them, but first try to map new nodes to an existing category so the builder does not become a rainbow of one-off meanings.

We anchor as many categories as possible to the **existing semantic color families** from `tailwind.config.js` (`info`, `warning`, `success`, `error`, plus the brand teal). Two starting categories (AI, Compute) don't fit those families and require a small palette extension — see §6.3.

### 6.1 Category Roster

| Category            | Examples                                                                                    | Role                                                            | Chip BG                 | Chip FG / Icon            | Token source                                           |
| ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------- | ------------------------- | ------------------------------------------------------ |
| **Trigger / Entry** | Response Received, Response Completed, Survey Completed, (later) Webhook Received, Schedule | Entry to the graph; MVP assumes one active trigger per workflow | `bg-brand-dark/15`      | `text-brand-dark`         | Existing brand                                         |
| **Flow**            | If / Else, Filter, Iterate, Delay, Parallel                                                 | Controls order and conditions; never has external side effects  | `bg-success-background` | `text-success-foreground` | Existing `success`                                     |
| **Data**            | Update record, Search, Create record, Delete                                                | CRUD inside Formbricks; reads/writes our own DB                 | `bg-slate-100`          | `text-slate-700`          | Existing slate ramp                                    |
| **Core action**     | Send Email, Send Webhook / API Call, HTTP request, Draft email                              | External side effects; the user-facing outputs of automation    | `bg-error-background`   | `text-error-foreground`   | Existing `error` (the coral red — _not_ `destructive`) |
| **Compute**         | Calculate, Set variable, Math/string expression                                             | Pure transformation of inputs to outputs                        | `bg-violet-100`         | `text-violet-700`         | New (see §6.3)                                         |
| **AI**              | AI Agent action (prompt → output), classify, summarize                                      | Model-backed actions                                            | `bg-fuchsia-100`        | `text-fuchsia-700`        | New (see §6.3)                                         |
| **Human Input**     | Form step, Manual approval, Wait for input                                                  | Pauses execution for a human                                    | `bg-warning-background` | `text-warning-foreground` | Existing `warning`                                     |

Notes:

- The **Trigger** category uses the brand teal at low opacity because triggers anchor the visual hierarchy ("you are here, start of flow") — the same reason `bg-brand-dark` is the active-nav marker in the dashboard.
- **Core action** uses the `error` family rather than `destructive`. The `error.background` (`red-50`) / `error.foreground` (`red-900`) pair is calm enough to live on a node chip without screaming "danger." We are _not_ using the destructive coral here — destructive is reserved for delete buttons.
- For MVP we only need: Trigger, Flow (If/Else), Data (if any Data nodes ship), Core (Send Email, Send Webhook), Compute (Calculate). AI and Human Input are stretch/post-MVP per the milestone; their tokens should land now so the picker grid renders consistently when those nodes arrive.

### 6.2 Condition Editing Reuse

The dashboard already ships [`ConditionsEditor`](../../../apps/web/modules/ui/components/conditions-editor/index.tsx) — the recursive AND/OR builder used by segments, quotas, survey conditional logic, and response filters. For workflow nodes that need predicate editing, this is the first component to evaluate.

Use it for the predicate portion of a Flow node when the workflow schema maps cleanly to its config + callbacks: left operand options from trigger payloads and prior step outputs, operator options from the workflow schema, and right operand options from known value sets or typed inputs.

Do not force every branch or action editor into `ConditionsEditor`. A workflow-specific drawer may need surrounding sections for branch outcomes, action lists, fallback paths, or computed outputs. In that case, compose those sections around `ConditionsEditor`, or wrap it with workflow-specific adapters, while keeping the row density, spacing, and controls visually aligned with the existing component.

The reference screenshots in [`workbench/research/images/`](../../research/images/) are examples of useful condition and compute-field patterns. Treat them as fragments of the broader workflow editor, not as a full drawer contract.

### 6.3 Palette Extensions (new)

Two new color families are needed for **Compute** and **AI**. We deliberately reuse Tailwind's stock `violet` and `fuchsia` ramps so we don't have to invent custom hex values. Add them to `tailwind.config.js` under `colors` as small families with the same shape as `info`/`warning`/`success`/`error`:

```js
compute: {
  DEFAULT: colors.violet[600],
  foreground: colors.violet[900],
  muted: colors.violet[700],
  background: colors.violet[50],
  "background-muted": colors.violet[100],
},
ai: {
  DEFAULT: colors.fuchsia[600],
  foreground: colors.fuchsia[900],
  muted: colors.fuchsia[700],
  background: colors.fuchsia[50],
  "background-muted": colors.fuchsia[100],
},
```

This keeps the chip styling shorthand (`bg-compute-background text-compute-foreground`) consistent with the existing semantic families, and avoids leaking literal `violet-*` / `fuchsia-*` tokens into component code.

### 6.4 Iconography Inside Chips

Every chip carries a white-line icon on the colored tile (same as the right-hand reference image). Use Lucide — the dashboard already standardizes on it.

Suggested mappings (final selection is a design pass):

- Trigger → `Zap`
- Flow → `GitBranch` (If/Else), `Filter`, `Repeat` (Iterate), `Pause` (Delay)
- Data → `Plus`, `Pencil`, `Trash2`, `Search`, `PencilLine`
- Core → `Send`, `MailPlus`, `Code`, `Globe`
- Compute → `Calculator` (matches the reference)
- AI → `Sparkles` or `Brain`
- Human Input → `FormInput` or `UserCheck`

Icon weight: 16×16, 1.5 stroke, color `text-white` on the colored tile. The category label next to the chip is always `text-xs font-medium text-slate-600` — the _label_ stays slate so the chip tile stays the only colored element.

---

## 7. The Trigger / Action Picker

Triggered by the inline `+` between two nodes, by an empty-graph CTA, or by any future node insertion affordance. This is the panel modelled after the reference icon grid, but the action inventory is data-driven and should grow without redesigning the shell.

- **Surface:** a `Popover` (for inline use) or a `Sheet` from the right (for empty-graph "Add your first step"). For MVP we propose the `Sheet` flavor — more room for descriptions and easier to grow as the action library expands.
- **Layout:** sections by category, initially ordered **Trigger / Flow / Data / Core / Compute / AI / Human Input**. Each section is a section header (`text-xs uppercase tracking-wide text-slate-500`) plus a 3-column grid of cards. New trigger/action categories can be added when the schema justifies them; do not hard-code the picker to MVP-only actions.
- **Card:** 88×88, `rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-card-sm`, white surface, the category chip centered with the action name below in `text-xs font-medium text-slate-700`. Hover does _not_ tint the card itself — only the chip stays colored.
- **Search:** `SearchBar` at the top filters across all categories. Result rows collapse the section dividers when filtering.
- **Disabled actions:** an action that's defined but post-MVP (e.g., AI Agent if not shipped) appears greyed with a small `Soon` `Badge` overlay. Don't hide them — visibility builds anticipation.

---

## 8. Workflow List Page

Standard dashboard rhythm. Nothing exotic here.

- **Wrapper:** `PageContentWrapper` + `PageHeader` (title: "Workflows"; CTA: "New workflow" → slate-900 primary).
- **Empty state:** `EmptyState` variant `default` with a workflow-themed illustration; primary CTA = "New workflow".
- **Table:** `DataTable*` from the catalog with columns:
  - Name (link to builder)
  - Status — pill (see §11)
  - Trigger (icon + short label, using the trigger category chip)
  - Last run (relative time + status dot)
  - Created by, Created at, Updated at
  - Row actions (`DropdownMenu`: Open, Duplicate, Delete via `ConfirmationModal`)
- **Filters:** `DataTableToolbar` with filters for status, trigger type, and full-text search. Persistence via the existing settings modal pattern.

---

## 9. Workflow Runs Page

Same shell as the list page, with `SecondaryNavigation` switching between **Workflows** and **Runs**.

- **Table columns:** Workflow (link to definition), Status (pill), Trigger source (response/survey name), Started, Duration, Outcome.
- **Pagination:** server-driven, same shape as the responses table.
- **Row click:** opens **Run Detail** in a side `Sheet` for quick triage, or navigates to the full Run Detail route for deep dive. Both must be supported; the sheet is the fast path during MVP QA.

---

## 10. Run Detail Page

The run detail surface is where the canvas earns its keep — it's the **same nodes** the user built, decorated with run status (§5.4), with a right-side inspector.

- **Left:** read-only canvas. No drawer; no `+` affordances; no drag. Clicking a node selects it and updates the inspector.
- **Right:** `Inspector` panel (~420px, same drawer pattern as §4.4 but pinned open). Contents:
  - Step header (icon + name + status pill + duration)
  - Tabs: `Input` / `Output` / `Logs`. Use shadcn `Tabs` primitive.
  - Input / Output: pretty-printed JSON in a `CodeBlock` with copy button.
  - Logs: chronological list of log lines with timestamps and severity dots (slate / blue / amber / red).
- **Top strip:** run summary chip — overall status, trigger source, elapsed time, and a "Re-run" button if/when re-runs land.
- **Dry-run replay:** the same surface is used for dry-run results, with a banner `Alert variant="info"` at the top ("This is a dry run — no side effects were performed").

---

## 11. Status Vocabularies & Badges

Two distinct status vocabularies, both rendered through small status-badge wrappers around `Badge` where possible. They never share a column.

### 11.1 Workflow lifecycle (definition)

Per [decision 002](../decisions/002-workflows-tech.md) and the milestone:

| State      | Pill       | Token mapping          |
| ---------- | ---------- | ---------------------- |
| `draft`    | `Draft`    | `Badge type="gray"`    |
| `active`   | `Active`   | `Badge type="success"` |
| `disabled` | `Disabled` | `Badge type="warning"` |

In the builder, the active state pill sits in the page header near the title. In the list, it's a column.

### 11.2 Run status

| State       | Pill        | Token mapping                                                                                                      |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `queued`    | `Queued`    | `Badge type="gray"`                                                                                                |
| `running`   | `Running`   | `Badge type="warning"` with a `Loader2` spinner icon, or a `bg-info` family if we add a "running" semantic variant |
| `completed` | `Completed` | `Badge type="success"`                                                                                             |
| `failed`    | `Failed`    | `Badge type="error"`                                                                                               |
| `canceled`  | `Canceled`  | `Badge type="gray"` outlined                                                                                       |

The existing `Badge` ships `warning` / `success` / `error` / `gray`. If we want a distinct "running" blue, prefer adding an `info` `Badge` variant once rather than inlining colors at call sites.

---

## 12. Reused Components (from the dashboard catalog)

Every component below already exists and should be preferred when it fits. Cross-reference each against [`components-guide-dashboard.md`](./components-guide-dashboard.md) for the source path. If a workflow interaction needs behavior or layout the shared component does not expose, wrap or extend it deliberately instead of bending the workflow schema around the component.

**App shell & layout** — `WorkspaceLayout`, `TopControlBar`, `NoMobileOverlay`.

**Page skeleton** — `PageContentWrapper`, `PageHeader`, `SecondaryNavigation`, `GoBackButton`, `Breadcrumb`, `Header` (only for full-screen empty/onboarding moments).

**Forms & inputs** — `Form` (react-hook-form bridge), `Input`, `PasswordInput`, `InputComboBox` (variable picking in action configs), `TagsCombobox` (recipient lists in Send Email), `DropdownSelector`, `MultiSelect`, `ColorPicker`, `DatePicker`/`Calendar` (Delay node config), `FileInput` (if an action ever attaches a file).

**Modals & drawers** — `Dialog` (narrow/default/wide widths already cover us), `Sheet` (right-side drawer for trigger/action picker, run detail in-line), `ConfirmationModal` (delete workflow), `DeleteDialog` (delete node from drawer header), `ModalWithTabs` (settings or webhook test modal).

**Alerts & feedback** — `Alert` (`info` for dry-run banner, `warning` for MVP-limitation banners about unencrypted webhook headers / no body templating / no scheduling), `ToasterClient` (validation errors, save success), `UpgradePrompt` (gate post-MVP actions if/when needed).

**Data display** — `DataTable*` (workflow list, runs list), `EmptyState`, `Skeleton` / `SkeletonLoader` (canvas + lists during load), `LoadingSpinner` (run-detail tabs).

**Inline atoms** — `Badge` (status pills — see §11), `IdBadge` (workflow ID copy chip), `Tooltip` / `TooltipRenderer` (every icon button), `IconBar` or a workflow toolbar wrapper aligned with it, `SearchBar` (picker filter), `Tag` (variable chips inside `Editor` for Send Email subject/body), `Typography` (`H1`–`H4`, `Muted`, `Small`).

**Targeting & conditions** — `ConditionsEditor` for predicate editing when it fits the workflow schema, `LoadSegmentModal` / `SaveAsNewSegmentModal` if we let users save reusable condition presets later.

**Editor** — `Editor` (Lexical, for Send Email body) plus its exported `AddVariablesDropdown` — a natural surface for inserting workflow variables such as `{{trigger.response.email}}` where rich text is needed.

**Settings surface** — `SettingsCard`, `AdvancedOptionToggle` (per-action advanced options inside the drawer), `OptionsSwitch` (segmented controls like `Sync` vs `Async` if/when needed).

**Identity** — `Badge` already covered; `ProfileAvatar` if showing who created a workflow in the list.

---

## 13. Net-new Components We Need

The components below are workflow-specific. None should be built before the milestone's API and data-model plans are agreed, and most can live in a new `apps/web/modules/workflows/components/` directory to keep the catalog clean.

> **Naming below is suggestive, not prescriptive.** Plans 001-003 and 001-006 decide final names and prop shapes.

### Canvas core

- **Workflow canvas wrapper** — initializes React Flow with light-theme nodes/edges, dotted background, pan/zoom, fit-to-view, undo/redo, and the auto-layout pass.
- **Base node component** — the shared white card + header chip + body + handles described in §5.1. Concrete node types compose on top of it unless a schema-driven exception proves necessary.
- **Typed node adapters** — per trigger/action kind or per category, depending on what the data model needs. Visual differences should mostly come from the category chip and summary content.
- **Branch node / fan-out node** — base node + extra labeled output handles for true/false/case/fallback branches.
- **Edge component** — straight or smoothstep edge with optional label pill; hovers reveal the `+` add affordance.
- **Edge label pill** — the small chip on outgoing edges (`true`, `else`, `any is true`, `matched`, ...).
- **Inline add button** — the `+` pill that appears on edge hover and opens the picker.

### Builder chrome

- **Builder toolbar** — the floating bottom-center toolbar with zoom/fit/undo/redo/auto-arrange/dry-run, built on `IconBar` where possible or styled to match it where extra grouping/styling is needed.
- **Node configuration drawer** — the absolute, collapsible right drawer described in §4.4. Owns the form layout inside it but delegates the form fields to existing primitives.
- **Trigger / action picker** — the categorized grid panel described in §7, rendered as a `Sheet` and as a `Popover` variant for inline insertion.
- **Variable picker / variable pill** — a small popover that lets the user pick a value from the trigger payload or any prior step's output. Powers field-level variable mapping (e.g., recipient = `{{response.contact.email}}`). Wraps `InputComboBox` or `AddVariablesDropdown` depending on context.
- **Node-specific config sections** — small composable drawer sections for action types that need structured editors, such as compute expressions, webhook headers, email recipients, branch outcomes, or future AI prompts. These sections should reuse primitives and tokens from this guide rather than inventing separate chrome.

### Status & state

- **Workflow status badge** — wrapper around `Badge` that maps `draft` / `active` / `disabled` to the right `type` and label so the same component is used in the list, header, and elsewhere.
- **Run status badge** — wrapper around `Badge` for `queued` / `running` / `completed` / `failed` / `canceled`, including the spinner for `running`.
- **Node run status decoration** — the small status dot/icon overlaid on a node header in Run Detail (§5.4).

### Dry run

- **Dry-run launcher** — the toolbar button + sheet that collects simulated trigger data and submits to the v3 dry-run endpoint. Form fields are auto-generated from the selected trigger's payload schema.
- **Dry-run result banner / overlay** — the `Alert variant="info"` banner shown at the top of a read-only canvas after a dry run completes.

### Run detail

- **Run timeline (canvas mode)** — the read-only canvas with status-decorated nodes (§5.4).
- **Run inspector panel** — the right-side `Sheet`-style panel with `Tabs` (Input / Output / Logs) inside.
- **Log line** — single log row with timestamp, severity dot, message, and an expander for stack traces or long payloads.

### Empty / first-time experiences

- **Empty canvas state** — visible when a new workflow has no nodes yet; centered illustration + "Choose a trigger" CTA that opens the picker filtered to the Trigger category.
- **First-run nudge** — a one-time inline `Alert` explaining how the canvas works (drag from handles, `+` between nodes, drawer on the right). Dismiss-and-remember pattern.

---

## 14. Tokens & Tailwind Usage

All workflow components should compose from the tokens below. **No literal hex values inside components.**

### 14.1 Background & surfaces

- Page / canvas: `bg-slate-50`
- Cards, drawer, picker, nodes: `bg-white`
- Subtle backdrop (toolbar, sticky chrome over canvas): `bg-white/95 backdrop-blur`
- Hover surfaces: `bg-slate-100`
- Dropdown rows hover: `bg-slate-100`
- Disabled surface: `opacity-60` on the original, no separate token

### 14.2 Borders

- Standard: `border-slate-200`
- Hover/active emphasis: `border-slate-300`
- Selection ring: `ring-2 ring-brand-dark ring-offset-2 ring-offset-slate-50`
- Error: `border-error` only on the chip itself, never on the whole card

### 14.3 Text

- Primary: `text-slate-800`
- Secondary / body: `text-slate-600`
- Muted / helper / category labels: `text-slate-500`
- Disabled / placeholder: `text-slate-400`
- Active or "you are here" text (the only place teal earns its way into ink): `text-brand-dark`

### 14.4 Brand teal

- `bg-brand-dark` — only on the active step in `SecondaryNavigation`, the active-nav marker, the Activate CTA (optional override of slate primary), node selection ring color, trigger category chip background (at 15% opacity).
- `bg-brand` — reserved for illustrations / logos. Don't reach for it in builder chrome.
- `bg-brandnew` — not used in workflows.

### 14.5 Semantic families

Use the _family_ shorthand, not the underlying Tailwind color:

| Use                                              | Token                                                          |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Flow chips, success pills, true-branch labels    | `bg-success-background text-success-foreground`                |
| Core action chips, failed pills                  | `bg-error-background text-error-foreground`                    |
| Human Input chips, warning banners               | `bg-warning-background text-warning-foreground`                |
| Info banners, "running" run pill, dry-run banner | `bg-info-background text-info-foreground`                      |
| Compute chips                                    | `bg-compute-background text-compute-foreground` _(new — §6.3)_ |
| AI chips                                         | `bg-ai-background text-ai-foreground` _(new — §6.3)_           |

### 14.6 Shadow

- Idle node: `shadow-card-sm`
- Hover node, drawer, floating toolbar, picker: `shadow-card-md`
- Modal / Sheet: existing modal shadows (do not override)

### 14.7 Animation

- Reuse existing `animate-fadeIn` / `animate-fadeOut` for drawer/picker entrance.
- Reuse `animate-ping-slow` for the "Running" status dot.
- Avoid layout-shifting transitions on nodes themselves — workflow builders feel broken when nodes wobble.

---

## 15. Spacing & Sizing Scale

Stay on Tailwind's stock 4px grid. Workflow-specific defaults:

| Element                                       | Size                                              |
| --------------------------------------------- | ------------------------------------------------- |
| Node card min-width                           | 280px                                             |
| Node card max-width                           | 360px                                             |
| Node header height                            | 36px                                              |
| Node body padding                             | `p-3` (12px)                                      |
| Vertical gap between nodes (auto-layout)      | 80px                                              |
| Horizontal gap between branches (auto-layout) | 64px                                              |
| Edge stroke width                             | 1.5px                                             |
| Edge label pill height                        | 24px                                              |
| Handle size                                   | 8×8px (16×16 hit target via padding)              |
| Drawer width                                  | 384px (`w-96`)                                    |
| Drawer collapsed rail                         | 32px (`w-8`)                                      |
| Floating toolbar height                       | 40px                                              |
| Floating toolbar icon button                  | 32×32                                             |
| Trigger/action picker grid card               | 88×88                                             |
| Run inspector width                           | 420px                                             |
| Status badge height                           | 20px (matches existing `Badge` small size)        |
| Category chip tile                            | 24×24 (`size-6 rounded-md`), inside a `gap-2` row |

For the **builder route**, override the standard `PageContentWrapper` `p-6` gutter so the canvas runs edge-to-edge. The drawer and toolbar then take care of their own insets via `absolute` positioning with their own 16px margins.

---

## 16. Accessibility & Keyboard

The canvas is the only piece of dashboard UI that isn't trivially keyboard-navigable. Plan for it from day one.

- **Tab order:** top strip → toolbar → canvas (selectable nodes in DOM order) → drawer (when open).
- **Node selection by keyboard:** arrow keys move focus between adjacent nodes; `Enter` opens the drawer; `Delete` opens the destructive confirmation.
- **Add affordance:** `Cmd/Ctrl + K` opens the trigger/action picker filtered by what's valid at the current focus.
- **Screen reader landmarks:** the canvas is `role="application"` (React Flow does this by default); each node has `aria-label` summarizing its category + title + summary line; status pills include `aria-label` with the verbose status.
- **Contrast:** every category chip combination already meets AA on white (`*-background` + `*-foreground` pairs are designed for it). Verify contrast before shipping.
- **Focus rings:** rely on `focus-visible` defaults from shadcn primitives; the canvas selection ring (`ring-brand-dark`) doubles as focus indicator on nodes.

---

## 17. MVP Disclosures

The milestone calls out several user-visible limitations. Surface them consistently so the user is never surprised:

- **Send Webhook / API Call**: above the URL field in the action drawer, an `Alert variant="warning"` reading something like "Custom headers are stored in plaintext. Don't put secrets in here yet." Plus a follow-up `Alert variant="info"` near the body field: "The request body is a fixed envelope — `{ response: <prev output> }`. Custom body templating is coming soon."
- **Versioning**: don't surface "version" controls at all in MVP. The internal data model knows about versions; the UI doesn't.
- **Scheduling**: omit the `Schedule` trigger from the picker, but reserve its slot with a `Soon` badge so users see what's coming.
- **Webhook Received trigger**: same — visible-but-disabled card in the picker with `Soon`.

All MVP disclosures use the existing `Alert` component with the appropriate variant. Do not invent new banner chrome.

---

## 18. Future Work (Not Now)

Captured here so they don't accidentally end up in MVP scope:

- **Variable templating in webhook bodies** (`$input.action_id`, `$input.response.score`) — requires a templating editor surface, probably a thin variant of `Editor` with `AddVariablesDropdown` constrained to known step outputs.
- **Loops / iterators**, **delays**, **human input** — placeholders in the picker; full design when the milestone unlocks them.
- **AI Agent action** — stretch in MVP. Drawer needs a prompt editor, model selector, and a structured-output schema picker. Use the AI chip palette (§6.3) already.
- **Versioning UI** — list of revisions, "restore this version", side-by-side diff. Schema readiness is the MVP work; UI is post-MVP.
- **Reusable condition presets / saved segments** — `LoadSegmentModal` / `SaveAsNewSegmentModal` already exist in the catalog if/when we expose this.
- **Dark mode** — globally not shipped. When it is, the category families need explicit dark equivalents (most semantic families already do; `compute` and `ai` will need dark counterparts added at the same time).

---

## Cross-references

- Product context: [`workbench/blueprint/epics/E001-workflows.md`](../epics/E001-workflows.md)
- MVP scope: [`workbench/blueprint/milestones/001-workflows-mvp.md`](../milestones/001-workflows-mvp.md)
- API-first contract: [`workbench/blueprint/decisions/001-workflows-api-first-backend-contract.md`](../decisions/001-workflows-api-first-backend-contract.md)
- Technical architecture: [`workbench/blueprint/decisions/002-workflows-tech.md`](../decisions/002-workflows-tech.md)
- Business rules & glossary: [`workbench/blueprint/business-rules/001-workflows-glossary-and-scope.md`](../business-rules/001-workflows-glossary-and-scope.md)
- Dashboard design system (parent): [`design-guidelines-dashboard.md`](./design-guidelines-dashboard.md)
- Dashboard component catalog: [`components-guide-dashboard.md`](./components-guide-dashboard.md)
- UI implementation plan: [`workbench/cowork/plans/001-006-dashboard-workflow-builder-ui.md`](../../cowork/plans/001-006-dashboard-workflow-builder-ui.md)
- Reference screenshots: [`workbench/research/images/`](../../research/images/) — illustrative fragments for density, placement, and interaction ideas, not complete implementation specs.
