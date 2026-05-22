# Components Guide: Formbricks Dashboard

A field guide to the UI components in `apps/web` you are most likely to touch or reuse when building or reviewing dashboard features. This is a catalog with purpose — not exhaustive. The design rules these components enforce live in [`design-guidelines-dashboard.md`](./design-guidelines-dashboard.md).

> **Note on shadcn primitives.** The dashboard uses shadcn/ui (new-york style) on Radix primitives — `Button`, `Input`, `Card`, `Dialog`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `Tabs`, `Tooltip`, `Popover`, `DropdownMenu`, `Form`, `Label`, `Separator`, `Skeleton`, `Calendar`, `AlertDialog`, `Breadcrumb`, `Sheet`, `Sidebar`, `Command`, `Table`, `Tooltip`. They all live in [`apps/web/modules/ui/components/`](../../../apps/web/modules/ui/components/) and behave exactly as the upstream shadcn docs describe — this guide does not duplicate the shadcn docs. Use them when you need a generic primitive; reach for the higher-level components below when you need something Formbricks-specific.

---

## App Shell

These run the workspace layout (sidebar + top bar + content area). You will rarely build new ones here — but you will read them when wiring a new top-level route.

### `WorkspaceLayout`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/WorkspaceLayout.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/WorkspaceLayout.tsx>)
- **What:** the two-column shell — sidebar + (`TopControlBar` + content). Wraps every authenticated workspace route.
- **Important bits:** receives `TWorkspaceLayoutData` (no DB queries inside — the route's `layout.tsx` does that); renders `LimitsReachedBanner` + `PendingDowngradeBanner` above the shell; sets `#mainContent` as the scrollable `bg-slate-50` content area.

### `MainNavigation` (sidebar)

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/MainNavigation.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/MainNavigation.tsx>)
- **What:** the collapsible left sidebar. Holds the product nav (Surveys, Contacts, Analytics, Settings…), the user menu, the org/workspace switcher, the trial banner, and the upgrade prompts.
- **Important bits:** collapse state persists via cookie; uses `NavigationLink` for each item; reads `membershipRole` to gate items.

### `TopControlBar`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/TopControlBar.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/TopControlBar.tsx>)
- **What:** the top strip across the content column. Holds the org/workspace breadcrumb plus quick-action chrome.

### `NavigationLink`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/NavigationLink.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/NavigationLink.tsx>)
- **What:** single sidebar item — icon + label + active-state styling. Reuse this when extending the sidebar; don't roll your own.

### `workspace-and-org-switch`, `organization-breadcrumb`, `workspace-breadcrumb`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/>)
- **What:** the dropdowns and breadcrumb trail at the top of the shell.

### `SettingsSidebarContent`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/SettingsSidebarContent.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/SettingsSidebarContent.tsx>)
- **What:** secondary sidebar shown when the user enters the Settings area — workspace settings, organization settings, account, integrations, billing.

### `NoMobileOverlay`

- **Where:** [`apps/web/modules/ui/components/no-mobile-overlay/index.tsx`](../../../apps/web/modules/ui/components/no-mobile-overlay/index.tsx)
- **What:** the full-screen block shown on `<sm` viewports. The dashboard is intentionally desktop-only; this is the polite refusal.

---

## Page Skeleton (use these on every page)

The vast majority of dashboard pages compose from these three. Reach for them before writing layout code.

### `PageContentWrapper`

- **Where:** [`apps/web/modules/ui/components/page-content-wrapper/index.tsx`](../../../apps/web/modules/ui/components/page-content-wrapper/index.tsx)
- **What:** `min-h-full space-y-6 p-6` container. Owns the page gutter and vertical rhythm.
- **Important bits:** don't add padding inside it; let it own the gutter.

### `PageHeader`

- **Where:** [`apps/web/modules/ui/components/page-header/index.tsx`](../../../apps/web/modules/ui/components/page-header/index.tsx)
- **What:** the page title (`text-3xl font-bold text-slate-800`) + optional `cta` slot, underlined with `border-b border-slate-200`. `children` slot below the title is where `SecondaryNavigation` belongs.

### `SecondaryNavigation`

- **Where:** [`apps/web/modules/ui/components/secondary-navigation/index.tsx`](../../../apps/web/modules/ui/components/secondary-navigation/index.tsx)
- **What:** tab strip with a 2px `bg-brand-dark` indicator under the active item. Supports disabled tabs (with optional popover tooltip), loading state, and link or button items.
- **Important bits:** pass `navigation: TSecondaryNavItem[]` + `activeId`. Items hidden via `hidden: true` are filtered out.

### `Header`

- **Where:** [`apps/web/modules/ui/components/header/index.tsx`](../../../apps/web/modules/ui/components/header/index.tsx)
- **What:** full-page splash header (centered, `text-4xl font-medium`, optional subtitle). Reserved for onboarding pages and full-screen empty states — _not_ for in-page section headers.

### `GoBackButton`

- **Where:** [`apps/web/modules/ui/components/go-back-button/index.tsx`](../../../apps/web/modules/ui/components/go-back-button/index.tsx)
- **What:** consistent back-link with arrow icon.

### `Breadcrumb`

- **Where:** [`apps/web/modules/ui/components/breadcrumb/index.tsx`](../../../apps/web/modules/ui/components/breadcrumb/index.tsx)
- **What:** shadcn-style breadcrumb trail. Use for nested settings areas where the org/workspace breadcrumb in the top bar isn't enough.

---

## Settings Surface

### `SettingsCard`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard.tsx>) _(lives in the app, not in `modules/ui`)_
- **What:** the standard settings bench — title (H4 + optional `beta`/`soon` Badge) + description + optional CTA button on the right + children body. `max-w-4xl`, `rounded-xl border border-slate-200 bg-white shadow-sm`.
- **Important bits:** pass `buttonInfo` for a header button or pass a fully custom `cta` ReactNode; `noPadding` removes the body inset for cards that own their own padding (e.g., tables).

### `AdvancedOptionToggle`

- **Where:** [`apps/web/modules/ui/components/advanced-option-toggle/index.tsx`](../../../apps/web/modules/ui/components/advanced-option-toggle/index.tsx)
- **What:** labeled `Switch` + description + optional disclosed children. The pattern for "enable feature X, then show its config." Used heavily across survey settings and integration config.

### `OptionsSwitch`

- **Where:** [`apps/web/modules/ui/components/options-switch/index.tsx`](../../../apps/web/modules/ui/components/options-switch/index.tsx)
- **What:** segmented control with an animated highlight that slides under the active option. Used for inline two-or-three-way pickers (file vs link, image vs video, etc.).

### `StylingTabs`

- **Where:** [`apps/web/modules/ui/components/styling-tabs/index.tsx`](../../../apps/web/modules/ui/components/styling-tabs/index.tsx)
- **What:** large tab selector with optional icons — used in styling and theme panels.

### `TabToggle`, `TabBar`, `TabNav`

- **Where:** [`apps/web/modules/ui/components/tab-toggle/`](../../../apps/web/modules/ui/components/tab-toggle/), [`tab-bar/`](../../../apps/web/modules/ui/components/tab-bar/), [`tab-nav/`](../../../apps/web/modules/ui/components/tab-nav/)
- **What:** smaller tab variants for inline contexts. Note these are distinct from the shadcn `Tabs` primitive — Formbricks ships several tab patterns because different surfaces have different density needs.

---

## Modals & Dialogs

### `ConfirmationModal`

- **Where:** [`apps/web/modules/ui/components/confirmation-modal/index.tsx`](../../../apps/web/modules/ui/components/confirmation-modal/index.tsx)
- **What:** the standard "are you sure?" dialog. Icon (default `CircleAlert`) + title + description + body + destructive primary + cancel. Supports an optional `secondaryButton` for three-way confirms.
- **Important bits:** always use this instead of building a bespoke confirm dialog. Default `buttonVariant` is `destructive`; default description copy is `t("workspace.general.this_action_cannot_be_undone")`.

### `DeleteDialog`

- **Where:** [`apps/web/modules/ui/components/delete-dialog/index.tsx`](../../../apps/web/modules/ui/components/delete-dialog/index.tsx)
- **What:** a slimmer "delete this thing" variant. Reach for `ConfirmationModal` when you need the body / secondary-button surface; `DeleteDialog` for compact deletes.

### `ModalWithTabs`

- **Where:** [`apps/web/modules/ui/components/modal-with-tabs/index.tsx`](../../../apps/web/modules/ui/components/modal-with-tabs/index.tsx)
- **What:** a tabbed dialog — slate-900 active title with a `border-b-2 border-brand-dark` indicator. Used in places like the "share & embed" modal and integration setup flows.

### `Dialog`, `AlertDialog`, `Sheet`

- **Where:** [`dialog/`](../../../apps/web/modules/ui/components/dialog/), [`alert-dialog/`](../../../apps/web/modules/ui/components/alert-dialog/), [`sheet/`](../../../apps/web/modules/ui/components/sheet/)
- **What:** shadcn primitives. `Dialog` has three widths (`narrow` 512px, `default` 720px, `wide` responsive); `Sheet` slides in from any side. Compose `DialogHeader`/`Body`/`Footer` or `SheetHeader`/`Content`/etc.

---

## Alerts, Banners, Toasts

### `Alert`

- **Where:** [`apps/web/modules/ui/components/alert/index.tsx`](../../../apps/web/modules/ui/components/alert/index.tsx)
- **What:** semantic inline alert. Variants: `default`, `error`, `warning`, `info`, `success`, `outbound`. Sizes: `default`, `small`. Composes with `AlertTitle`, `AlertDescription`, and a contextual `AlertButton`.
- **Important bits:** the variant decides border color, icon, and (for buttons inside) the inline CTA chrome — all driven by the semantic color families in `tailwind.config.js`.

### `LimitsReachedBanner`

- **Where:** [`apps/web/modules/ui/components/limits-reached-banner/index.tsx`](../../../apps/web/modules/ui/components/limits-reached-banner/index.tsx)
- **What:** full-width banner above the shell when the org has hit a billing limit. Only renders on Formbricks Cloud.

### `PendingDowngradeBanner`

- **Where:** [`apps/web/modules/ui/components/pending-downgrade-banner/index.tsx`](../../../apps/web/modules/ui/components/pending-downgrade-banner/index.tsx)
- **What:** banner shown when a downgrade is queued. Triggered by license state.

### `ToasterClient` (react-hot-toast)

- **Where:** [`apps/web/modules/ui/components/toaster-client/index.tsx`](../../../apps/web/modules/ui/components/toaster-client/index.tsx)
- **What:** the global toast container; mounted once in `(app)/layout.tsx`. Custom classes `formbricks__toast__success` / `formbricks__toast__error` carry styling.
- **Important bits:** to dispatch a toast: `import toast from "react-hot-toast"; toast.success(...)`. Don't introduce a second toast library.

### `UpgradePrompt`

- **Where:** [`apps/web/modules/ui/components/upgrade-prompt/index.tsx`](../../../apps/web/modules/ui/components/upgrade-prompt/index.tsx)
- **What:** the centered "upgrade to unlock X" splash — key icon, title, description, primary + secondary CTA. Fires a PostHog `upgrade_cta_clicked` event when the primary is clicked.

### `StorageNotConfiguredToast`

- **Where:** [`apps/web/modules/ui/components/storage-not-configured-toast/`](../../../apps/web/modules/ui/components/storage-not-configured-toast/)
- **What:** the standard nudge shown to self-hosters who haven't configured storage. Use `showStorageNotConfiguredToast()` from its `lib/utils`.

---

## Forms & Inputs

### `Form` (react-hook-form bridge)

- **Where:** [`apps/web/modules/ui/components/form/index.tsx`](../../../apps/web/modules/ui/components/form/index.tsx)
- **What:** the standard form composition — `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`. Wraps `react-hook-form`'s `Controller`.
- **Important bits:** pair with zod via `@hookform/resolvers`. Don't `Controller`-by-hand when this bridge exists.

### `Input`

- **Where:** [`apps/web/modules/ui/components/input/index.tsx`](../../../apps/web/modules/ui/components/input/index.tsx)
- **What:** the basic text input. Accepts `isInvalid` for the red-border error state.

### `PasswordInput`

- **Where:** [`apps/web/modules/ui/components/password-input/index.tsx`](../../../apps/web/modules/ui/components/password-input/index.tsx)
- **What:** password field with show/hide toggle. Use this instead of `Input type="password"`.

### `OTPInput`

- **Where:** [`apps/web/modules/ui/components/otp-input/index.tsx`](../../../apps/web/modules/ui/components/otp-input/index.tsx)
- **What:** segmented one-time-password input — used in 2FA / email verification flows.

### `InputComboBox`

- **Where:** [`apps/web/modules/ui/components/input-combo-box/index.tsx`](../../../apps/web/modules/ui/components/input-combo-box/index.tsx)
- **What:** combobox with both a free-text input and a dropdown of options. Used heavily by `ConditionsEditor` for picking question/variable/operator/value combos.

### `TagsCombobox`

- **Where:** [`apps/web/modules/ui/components/tags-combobox/index.tsx`](../../../apps/web/modules/ui/components/tags-combobox/index.tsx)
- **What:** multi-select combobox that creates and removes tag chips inline. Used in response tagging.

### `DropdownSelector`, `MultiSelect`, `ShuffleOptionSelect`

- **Where:** [`dropdown-selector/`](../../../apps/web/modules/ui/components/dropdown-selector/), [`multi-select/`](../../../apps/web/modules/ui/components/multi-select/), [`shuffle-option-select/`](../../../apps/web/modules/ui/components/shuffle-option-select/)
- **What:** specialized selectors used by the survey editor and analysis filters.

### `ColorPicker`

- **Where:** [`apps/web/modules/ui/components/color-picker/index.tsx`](../../../apps/web/modules/ui/components/color-picker/index.tsx)
- **What:** hex color input with swatch preview. Used in survey styling.

### `DatePicker`, `Calendar`

- **Where:** [`date-picker/`](../../../apps/web/modules/ui/components/date-picker/), [`calendar/`](../../../apps/web/modules/ui/components/calendar/)
- **What:** Radix popover + `react-day-picker` calendar. Pair them; don't render Calendar alone.

### `FileInput`

- **Where:** [`apps/web/modules/ui/components/file-input/index.tsx`](../../../apps/web/modules/ui/components/file-input/index.tsx)
- **What:** file/image/video uploader. Wires into the storage module (`handleFileUpload`), shows previews, handles error toasts (including `storage-not-configured`), supports image vs video tabs via `OptionsSwitch`.
- **Important bits:** pass `allowedFileExtensions: TAllowedFileExtension[]` and `workspaceId`; the component handles upload, progress, and preview.

---

## Empty & Loading States

### `EmptyState`

- **Where:** [`apps/web/modules/ui/components/empty-state/index.tsx`](../../../apps/web/modules/ui/components/empty-state/index.tsx)
- **What:** two variants — `default` (three stacked slate rectangles bracketing the message — implies "rows would appear here") and `simple` (single small card). Use to fill a section that has no data yet.

### `LoadingSpinner`

- **Where:** [`apps/web/modules/ui/components/loading-spinner/index.tsx`](../../../apps/web/modules/ui/components/loading-spinner/index.tsx)
- **What:** the animated SVG spinner (`text-slate-700`). Wrap in a centered container that owns its own height.

### `Skeleton`, `SkeletonLoader`

- **Where:** [`skeleton/`](../../../apps/web/modules/ui/components/skeleton/), [`skeleton-loader/`](../../../apps/web/modules/ui/components/skeleton-loader/)
- **What:** slate-200 pulse blocks. Prefer skeletons over spinners for content-shaped loading.

### `NavbarLoading`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/NavbarLoading.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/NavbarLoading.tsx>)
- **What:** sidebar-shaped placeholder for the workspace shell during route transitions.

---

## Data & Charts

### `DataTable*` (TanStack Table v8)

- **Where:** [`apps/web/modules/ui/components/data-table/`](../../../apps/web/modules/ui/components/data-table/)
- **What:** the shared exports for building tables — `DataTableHeader`, `DataTableToolbar`, `DataTableSettingsModal`, `getSelectionColumn`. Tables themselves are composed per surface (responses, surveys, contacts, members) using `@tanstack/react-table`.
- **Important bits:** the selection column helper handles bulk-action checkboxes; the toolbar holds filters and the column settings modal handles show/hide column persistence.

### `Chart` (Recharts wrapper)

- **Where:** [`apps/web/modules/ui/components/chart/index.tsx`](../../../apps/web/modules/ui/components/chart/index.tsx)
- **What:** the shared `ChartContainer` + tooltip + legend conventions for Recharts. Survey analytics widgets compose on top of this.

### `Table` (shadcn primitive)

- **Where:** [`apps/web/modules/ui/components/table/index.tsx`](../../../apps/web/modules/ui/components/table/index.tsx)
- **What:** the unstyled-table primitive shadcn ships. Use only for short static tables; for paginated, sortable, filterable data use the `DataTable*` exports above.

---

## Survey-Specific Components

### `PreviewSurvey`

- **Where:** [`apps/web/modules/ui/components/preview-survey/index.tsx`](../../../apps/web/modules/ui/components/preview-survey/index.tsx)
- **What:** a live preview of a survey inside the editor — runs the `@formbricks/surveys` runtime in modal or inline mode against the current draft. Used in the survey editor's right pane.

### `ThemeStylingPreviewSurvey`

- **Where:** [`apps/web/modules/ui/components/theme-styling-preview-survey/index.tsx`](../../../apps/web/modules/ui/components/theme-styling-preview-survey/index.tsx)
- **What:** the preview shown in the workspace-level styling settings. Same idea, scoped to theme tokens rather than a specific survey.

### `StackedCardsContainer`

- **Where:** [`apps/web/modules/ui/components/stacked-cards-container/index.tsx`](../../../apps/web/modules/ui/components/stacked-cards-container/index.tsx)
- **What:** the stacked-card animation used in preview flows. Mirrors the runtime's stack pattern.

### `Survey`

- **Where:** [`apps/web/modules/ui/components/survey/index.tsx`](../../../apps/web/modules/ui/components/survey/index.tsx)
- **What:** thin React wrapper around the `@formbricks/surveys` web component for mounting a survey in dashboard contexts.

### `SurveyStatusIndicator`

- **Where:** [`apps/web/modules/ui/components/survey-status-indicator/index.tsx`](../../../apps/web/modules/ui/components/survey-status-indicator/index.tsx)
- **What:** the colored pill (`draft` / `inProgress` / `paused` / `completed` / `scheduled`) shown next to a survey title.

### Survey Editor — `apps/web/modules/survey/editor/components/`

- **Where:** [`apps/web/modules/survey/editor/components/`](../../../apps/web/modules/survey/editor/components/)
- **What:** the full editor surface — `BlockCard`, `BlockMenu`, `BlocksDroppable`, `EditorCardMenu`, `AddElementButton`, `ConditionalLogic`, `EditWelcomeCard`, `EditEndingCard`, `EndScreenForm`, per-element forms (`OpenTextForm`, `NpsForm`, `RatingForm`, `MatrixForm`, etc.), `AutoSaveIndicator`, `AnimatedSurveyBg`, `ColorSurveyBg`, `BulkEditOptionsModal`, `AddActionModal`.
- **Important bits:** this is the largest single surface in `apps/web`. Each element type has its own form; the block list uses `@formkit/auto-animate` for reorder animations. Reach for these when editing the editor itself, not as general-purpose primitives.

### Survey Response Renderers

- **Where:** [`array-response/`](../../../apps/web/modules/ui/components/array-response/), [`rating-response/`](../../../apps/web/modules/ui/components/rating-response/), [`ranking-response/`](../../../apps/web/modules/ui/components/ranking-response/), [`picture-selection-response/`](../../../apps/web/modules/ui/components/picture-selection-response/), [`file-upload-response/`](../../../apps/web/modules/ui/components/file-upload-response/), [`response-badges/`](../../../apps/web/modules/ui/components/response-badges/)
- **What:** small renderers that turn a single response value into a styled chip / row / star bar / image strip — used in the response table and the response detail view.

### `ProgressBar`

- **Where:** [`apps/web/modules/ui/components/progress-bar/index.tsx`](../../../apps/web/modules/ui/components/progress-bar/index.tsx)
- **What:** the standard horizontal progress bar in slate / brand-dark. Used in onboarding, quotas, and upload progress.

---

## Segments & Targeting

### `ConditionsEditor`

- **Where:** [`apps/web/modules/ui/components/conditions-editor/index.tsx`](../../../apps/web/modules/ui/components/conditions-editor/index.tsx)
- **What:** the recursive nested-conditions builder — used by segment targeting, quota rules, conditional logic in the survey editor, and survey filters. Supports condition groups (AND/OR), drag-reorder via `@formkit/auto-animate`, and a dropdown menu per row (copy, delete, wrap in group).
- **Important bits:** very generic — driven by `config` + `callbacks`. Read [`types.ts`](../../../apps/web/modules/ui/components/conditions-editor/types.ts) to wire a new caller; don't fork the component.

### `SegmentTitle`, `LoadSegmentModal`, `SaveAsNewSegmentModal`, `ConfirmDeleteSegmentModal`

- **Where:** [`segment-title/`](../../../apps/web/modules/ui/components/segment-title/), [`load-segment-modal/`](../../../apps/web/modules/ui/components/load-segment-modal/), [`save-as-new-segment-modal/`](../../../apps/web/modules/ui/components/save-as-new-segment-modal/), [`confirm-delete-segment-modal/`](../../../apps/web/modules/ui/components/confirm-delete-segment-modal/)
- **What:** the segment-saving UX. Reuse these for any segment-aware feature.

### `TargetingIndicator`

- **Where:** [`apps/web/modules/ui/components/targeting-indicator/index.tsx`](../../../apps/web/modules/ui/components/targeting-indicator/index.tsx)
- **What:** the compact pill that summarizes "this survey targets X people" — shown on the survey list and dashboard.

### `ElementToggleTable`

- **Where:** [`apps/web/modules/ui/components/element-toggle-table/index.tsx`](../../../apps/web/modules/ui/components/element-toggle-table/index.tsx)
- **What:** a checkbox grid for toggling element visibility per language / channel.

---

## Identity & Branding

### `ProfileAvatar`, `PersonAvatar`

- **Where:** [`apps/web/modules/ui/components/avatars/index.tsx`](../../../apps/web/modules/ui/components/avatars/index.tsx)
- **What:** generated avatars via [`boring-avatars`](https://github.com/boringdesigners/boring-avatars). `ProfileAvatar` uses the `bauhaus` variant for users; `PersonAvatar` uses `beam` for contacts. Both seed from the ID, so the same user always gets the same picture.

### `Badge`, `IdBadge`, `DefaultTag`, `Tag`

- **Where:** [`badge/`](../../../apps/web/modules/ui/components/badge/), [`id-badge/`](../../../apps/web/modules/ui/components/id-badge/), [`default-tag/`](../../../apps/web/modules/ui/components/default-tag/), [`tag/`](../../../apps/web/modules/ui/components/tag/)
- **What:**
  - `Badge` — colored pill with `warning` / `success` / `error` / `gray` types and three sizes; used for status labels.
  - `IdBadge` — copy-to-clipboard chip showing an ID; used in settings (org ID, workspace ID).
  - `DefaultTag` — the gray "Default" tag used in language settings.
  - `Tag` — the deletable response tag chip (`bg-slate-600 text-slate-100 rounded-full`).

### `FormbricksLogo`, `Logo`, `ClientLogo`

- **Where:** [`formbricks-logo/`](../../../apps/web/modules/ui/components/formbricks-logo/), [`logo/`](../../../apps/web/modules/ui/components/logo/), [`client-logo/`](../../../apps/web/modules/ui/components/client-logo/)
- **What:** the various logo lockups. Use the named component, not a raw `<Image src=".../logo.svg">`.

### `WidgetStatusIndicator`

- **Where:** [`apps/web/app/(app)/workspaces/[workspaceId]/components/WidgetStatusIndicator.tsx`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/WidgetStatusIndicator.tsx>)
- **What:** the small "is your JS widget connected?" indicator surfaced in the workspace.

---

## Editor (rich text)

### `Editor`

- **Where:** [`apps/web/modules/ui/components/editor/`](../../../apps/web/modules/ui/components/editor/) — exported from `index.ts`
- **What:** the Lexical-based rich-text editor used in survey headlines/descriptions, end screens, follow-up emails. Ships its own `styles-editor.css` and `styles-editor-frontend.css`.
- **Important bits:** also exports `AddVariablesDropdown` for surfaces that need variable insertion (recall info, response data tokens). Originally adapted from cal.com's editor.

### `CodeBlock`

- **Where:** [`apps/web/modules/ui/components/code-block/index.tsx`](../../../apps/web/modules/ui/components/code-block/index.tsx)
- **What:** syntax-highlighted code snippet (used in API key / install instructions / dev docs surfaces).

### `HighlightedText`

- **Where:** [`apps/web/modules/ui/components/highlighted-text/index.tsx`](../../../apps/web/modules/ui/components/highlighted-text/index.tsx)
- **What:** wraps matched substrings in a highlight span — used in search results.

---

## Utility Chrome

### `IconBar`

- **Where:** [`apps/web/modules/ui/components/iconbar/index.tsx`](../../../apps/web/modules/ui/components/iconbar/index.tsx)
- **What:** a horizontal toolbar of icon buttons (each wrapped in `TooltipRenderer`). Used wherever you need a row of compact actions — survey editor card menu, response table row actions.
- **Important bits:** every action requires a `tooltip` string — that's what becomes the accessible name.

### `Tooltip`, `TooltipRenderer`

- **Where:** [`apps/web/modules/ui/components/tooltip/`](../../../apps/web/modules/ui/components/tooltip/)
- **What:** Radix tooltip primitive plus a render-prop wrapper that's the easiest path for "wrap this trigger and show this content."

### `SearchBar`

- **Where:** [`apps/web/modules/ui/components/search-bar/index.tsx`](../../../apps/web/modules/ui/components/search-bar/index.tsx)
- **What:** the standard search input with leading icon and clear button.

### `Confetti`

- **Where:** [`apps/web/modules/ui/components/confetti/index.tsx`](../../../apps/web/modules/ui/components/confetti/index.tsx)
- **What:** celebratory confetti burst — reserved for the rare "you did it" moment (onboarding completion, first response). Don't sprinkle this everywhere.

### `ResetProgressButton`, `DecrementQuotasCheckbox`

- **Where:** [`reset-progress-button/`](../../../apps/web/modules/ui/components/reset-progress-button/), [`decrement-quotas-checkbox/`](../../../apps/web/modules/ui/components/decrement-quotas-checkbox/)
- **What:** purpose-built controls for the response panel.

### `ClientLogout`

- **Where:** [`apps/web/modules/ui/components/client-logout/index.tsx`](../../../apps/web/modules/ui/components/client-logout/index.tsx)
- **What:** the client component that signs the user out and redirects — used by `(app)/layout.tsx` when an account is deactivated.

### `ErrorComponent`

- **Where:** [`apps/web/modules/ui/components/error-component/index.tsx`](../../../apps/web/modules/ui/components/error-component/index.tsx)
- **What:** the page-level fallback shown by Next.js `error.tsx` boundaries. Use it as the default for new error boundaries.

### `Typography` (H1–H4, P, Small, Muted, InlineCode, List, Quote)

- **Where:** [`apps/web/modules/ui/components/typography/index.tsx`](../../../apps/web/modules/ui/components/typography/index.tsx)
- **What:** the named type components. Reach for them so type stays consistent across pages — see the typography section of the design guide for the hierarchy.

---

## Integrations

### `IntegrationCard`, `ConnectIntegration`, `AdditionalIntegrationSettings`

- **Where:** [`integration-card/`](../../../apps/web/modules/ui/components/integration-card/), [`connect-integration/`](../../../apps/web/modules/ui/components/connect-integration/), [`additional-integration-settings/`](../../../apps/web/modules/ui/components/additional-integration-settings/)
- **What:** the standard tile and settings frame for an integration (Slack, Notion, Google Sheets, Airtable, etc.). When adding a new integration, compose from these — don't roll a bespoke page.

---

## Onboarding & Marketing-adjacent

### `MediaBackground`, `client-logo`, `OptionCard`

- **Where:** [`media-background/`](../../../apps/web/modules/ui/components/media-background/), [`client-logo/`](../../../apps/web/modules/ui/components/client-logo/), [`option-card/`](../../../apps/web/modules/ui/components/option-card/)
- **What:** the marketing-adjacent surfaces inside the app — used by setup and onboarding flows. `OptionCard` is the large clickable card used during template / use-case selection.

---

## Where to start when…

A few common starting points so you don't have to scan the catalog:

- **"I need a new settings page."** → `PageContentWrapper` + `PageHeader` + `SettingsCard` + `Form`/`react-hook-form` for the fields. Save action triggers a `react-hot-toast` success/error. Destructive sub-actions use `ConfirmationModal`.
- **"I need to confirm a destructive action."** → `ConfirmationModal`. Never roll your own.
- **"I need an inline warning above some content."** → `Alert variant="warning"` (or `error`/`info`/`success`).
- **"I need a banner above the whole app."** → it almost certainly already exists (`LimitsReachedBanner`, `PendingDowngradeBanner`). If not, follow their pattern of mounting inside `WorkspaceLayout` above the shell.
- **"I need tabs inside a page."** → `SecondaryNavigation` inside `PageHeader`. For tabs _inside_ a card or dialog, `Tabs` (shadcn) or `TabToggle`.
- **"I need a multi-select / typeahead."** → `InputComboBox` or `TagsCombobox`, depending on whether you're creating chips.
- **"I need to render a table of rows."** → `DataTable*` exports on top of `@tanstack/react-table`.
- **"I need to show 'no data yet'."** → `EmptyState` (`variant="default"` for table-shaped emptiness, `variant="simple"` for a quick one-liner).
- **"I need a chart."** → `Chart` wrapper around Recharts.
- **"I need to gate a feature behind a paywall."** → `UpgradePrompt`.
- **"I need a rich-text field."** → `Editor` (Lexical). For monospace code, `CodeBlock`.
- **"I need to build conditional logic / segment rules."** → `ConditionsEditor`.
