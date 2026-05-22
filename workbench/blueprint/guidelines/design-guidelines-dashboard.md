# Design System Specification: The Workshop

- **Theme:** The Workshop
- **Product:** Formbricks Dashboard (`apps/web`)
- **Framework:** Next.js 16 (App Router, RSC) + React 19
- **Styling:** Tailwind CSS v3 (config in [`apps/web/tailwind.config.js`](../../../apps/web/tailwind.config.js))
- **UI library:** shadcn/ui (new-york style) on Radix primitives — `@radix-ui/react-*`
- **Primary color:** `#0f172a` (slate-900) — the working surface ink. Brand teal `#00C4B8` / `#00E6CA` punctuates; it never dominates.
- **Accent / "brand":** `var(--formbricks-brand, #038178)` (`bg-brandnew`) for the embedder-brand surface, `#00C4B8` (`bg-brand-dark`) for in-app active states.
- **Supported color schemes:** light. Dark-mode CSS variables exist in [`apps/web/modules/ui/globals.css`](../../../apps/web/modules/ui/globals.css) but the app shell does not toggle the `dark` class today — treat dark as not yet shipped.
- **Platform:** Web, desktop-first. Mobile (`<sm` breakpoint) is intentionally blocked by the [`NoMobileOverlay`](../../../apps/web/modules/ui/components/no-mobile-overlay/index.tsx).

---

## 1. Overview & Creative North Star

**Creative North Star: Calm slate scaffolding, predictable tools, a single teal mark for "this is where you are."**

The Formbricks dashboard is the customer's workshop — the place they come to build surveys, read responses, configure integrations, manage teammates. A workshop is calm by design: every tool has a hook on the wall, every bench is the same height, nothing rattles. The product UI is _not_ trying to delight the user with motion or saturation; it is trying to disappear so the work can stand out.

That mental model decides almost every visual question:

- **Slate is the bench.** Nine out of ten surfaces are some shade of slate (`bg-slate-50` for the page, `bg-white` for cards, `text-slate-800` for ink, `text-slate-500` for muted, `border-slate-200` for hairlines). Brand teal appears in only two roles — the active-nav indicator and a handful of marketing/upgrade moments. The rest of the time, slate is the entire palette.
- **Cards are workbenches.** Each card holds one job: editing the organization name, configuring an integration, listing a survey. They are rounded, white, hairlined, slightly shadowed — never bordered twice, never gradient-filled, never nested deeper than two levels.
- **The teal accent is chalk.** The brand color marks the active tab, the active sidebar item, the "in progress" indicator. It says "you are here." It does not say "look at me." Reserve it.

What this design is _not_:

- Not a marketing site. There are no heroes, gradients, sales CTAs, or testimonial strips inside the app. (Marketing materials live in `apps/storybook` and the public-facing site, not here.)
- Not the survey runtime. The runtime — what end-users see when they answer — lives in a separate design language (`workbench/blueprint/guidelines/design-guidelines-survey-runtime.md`). The dashboard guide does not govern the runtime, and vice versa.
- Not a mobile app. The product is desktop-first by deliberate choice; small screens render the `NoMobileOverlay` instead.
- Not yet dark-mode-aware. The CSS variable layer carries dark values but the dashboard shell does not toggle `.dark`. Do not design assuming dark is live.

---

## 2. Colors & Surface Philosophy

The palette is a slate ramp plus a teal accent plus a small semantic set.

### The Slate Stack

The dashboard runs on Tailwind's stock slate ramp. Memorize the roles:

- **`bg-slate-50`** — the page background (inside the workspace shell, under `#mainContent`). The "shop floor" outside the cards.
- **`bg-white`** — cards, panels, modal content. The work surface.
- **`bg-slate-100`** — hover state for ghost buttons, sidebar item hover, dropdown row hover. The "almost selected" state.
- **`border-slate-200`** — every card border, every divider, every input border at rest. The hairline.
- **`text-slate-800`** — primary text and headings (`H1`–`H4` are all `text-slate-800`).
- **`text-slate-500`** — secondary / muted text, descriptions, helper text.
- **`text-slate-400`** — disabled text, placeholder ink.
- **`bg-slate-900` / `bg-primary`** — primary button surface. Yes, the primary CTA is slate-900, not brand teal. This is deliberate (see "The Quiet Primary" below).

### The Teal Accent

Two tokens to know, plus the embedder-brand:

- **`bg-brand-dark` (`#00C4B8`)** — active state on sidebar nav, active tab indicator on `SecondaryNavigation`, accent stripe under selected tabs in `ModalWithTabs`. This is the "you are here" mark.
- **`bg-brand` (`#00E6CA`)** — the lighter teal used rarely (logo, illustration accents). Don't reach for it in component design without a reason.
- **`bg-brandnew` (`var(--formbricks-brand, #038178)`)** — the _embedder's_ brand color, sourced from a CSS variable. Used only where we genuinely echo the customer's survey brand inside the dashboard (e.g., styling preview); never for app chrome.

### The Quiet Primary Rule

**The default primary button is slate-900, not brand-teal.** ([`Button`](../../../apps/web/modules/ui/components/button/index.tsx) `variant="default"` → `bg-primary text-primary-foreground`.)

_Why:_ a workshop full of teal buttons feels like a marketing landing page. Keeping the primary ink-dark means the brand color stays meaningful when it _does_ appear — on the active nav, the active tab, the in-progress indicator. If every button were teal, none of them would be.

The two exceptions:

- **Destructive:** `#FF6B6B` background, `#FFF5F5` foreground — a softer coral red than the stock destructive, calibrated to look serious without screaming.
- **Outline / ghost:** `border-input` outline on `bg-background`, hover to `bg-accent` (`#f4f6f8`). Use for secondary actions where the slate primary would over-promise.

### Semantic Color (info, warning, success, error)

Defined in [`tailwind.config.js`](../../../apps/web/tailwind.config.js) as full color families — `DEFAULT`, `foreground`, `muted`, `background`, `background-muted`:

- **info** → blue-600 / 900 / 50 / 100
- **warning** → amber-500 / 900 / 50 / 100
- **success** → green-600 / 900 / 50 / 100
- **error** → red-600 / 900 / 50 / 100

These are designed to work with the [`Alert`](../../../apps/web/modules/ui/components/alert/index.tsx) component's variants. Don't hand-mix semantic colors from other Tailwind ramps — reach for the named token.

### Surface Hierarchy

Two layers, occasionally three. Don't go deeper.

1. **Page (`bg-slate-50`)** — the workspace shell content area.
2. **Card (`bg-white`, `border-slate-200`, `rounded-xl`, `shadow-sm`)** — the standard panel. Cards do not nest inside cards; if you find yourself nesting, you're building a section. Use a thin divider (`border-slate-100`) instead.
3. **Modal / sheet content** — same `bg-white`, but with a darker overlay (`bg-black/80 backdrop-blur-sm`) underneath. Modals are not just bigger cards; they take focus away from the bench entirely.

### The One-Hairline Rule

Cards and inputs get one border, period. If you need to separate two regions inside a card, use spacing or a `border-slate-100` divider — never an outer ring _and_ an inner ring. _Why:_ the workshop reads as quiet because the eye isn't fighting concentric strokes. Two strokes always look like a bug.

---

## 3. Typography

A single-typeface system. The dashboard inherits the host font (typically Inter via `next/font` or the system stack) — there is no display face. The type system is a hierarchy of weights and sizes built around slate ink. Use the named components from [`typography/index.tsx`](../../../apps/web/modules/ui/components/typography/index.tsx) when they exist; don't reinvent.

### Hierarchy

- **`H1`** — `text-4xl font-bold tracking-tight text-slate-800` — full-page hero headlines. Rare; most pages start at H2 or use `PageHeader`.
- **`PageHeader` title** — `text-3xl font-bold text-slate-800` with a `border-b border-slate-200` underline. The standard "this is the page" mark inside `PageContentWrapper`. Use this 95% of the time instead of bare `H1`/`H2`.
- **`H2`** — `text-3xl font-semibold tracking-tight text-slate-800` with `border-b pb-2` — section header inside a page. Underlines on purpose.
- **`H3`** — `text-lg font-medium text-slate-800` — sub-section header.
- **`H4`** — `text-base tracking-tight text-slate-800` — used as the card title in [`SettingsCard`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard.tsx>).
- **`Header`** — `text-4xl font-medium text-slate-800` centered, with optional `text-slate-500` subtitle — reserved for full-page splashes (onboarding, empty-state pages). Not for in-page section headers.
- **`Lead` / `P` / `Large` / `Base`** — body type. `P` is `leading-7`; `Large` is `text-lg`; `Base` is `text-base`. Use whichever fits.
- **`Small`** — `text-sm leading-none`, with `color="muted"` (`text-slate-500`) variant. The standard helper-text / sub-label.
- **`Muted`** — inline `text-muted-foreground text-sm` for descriptive notes inside a sentence.
- **`InlineCode`** — `bg-muted rounded font-mono text-sm font-semibold` for keys, env vars, IDs.

### Type Rules

- **One bold per scope.** A `SettingsCard` has one bold title; everything else inside it is regular or medium. A page has one `PageHeader`; section titles are `H3` or `H4`.
- **Slate-800 is the only "primary" ink.** Slate-900 exists for the primary button and the modal overlay; for type, prefer slate-800. (`H1`–`H4` all use slate-800 by default.)
- **`text-slate-500` is the only "muted" ink.** Don't reach for slate-400 / slate-600 to "balance hierarchy" — slate-500 is the muted token. Slate-400 is for disabled.
- **Tracking is `tight` for big headings, default everywhere else.** Don't widen letter-spacing for "premium" feel; that's a different design language.

---

## 4. Iconography

- **Source:** [Lucide React](https://lucide.dev) — `lucide-react@0.577.0`, used in 60+ places across the UI components. This is the only icon set. Do not import from `react-icons`, `heroicons`, `phosphor-icons`, or Material icons.
- **Style:** outlined, 1.5px stroke, square. No mixed filled/outlined sets.
- **Sizes:**
  - `size-4` (16px) — default inside text, inline with labels, inside buttons. The `Button` component enforces `[&_svg]:size-4`.
  - `size-5` (20px) — primary nav, sidebar links.
  - `size-6` and up — illustration moments (empty states, upgrade prompts), not inline UI.
- **Color:** icons inherit `currentColor` from the parent's `text-*` class. Don't hand-color icons with `text-slate-500` unless the icon is being intentionally muted relative to the surrounding text.
- **Brand-tinted icons** are rare — the active nav uses `text-brand-dark` via the indicator strip, not on the icon itself.
- **Avatars:** people / orgs use [`boring-avatars`](https://github.com/boringdesigners/boring-avatars) via `ProfileAvatar` (bauhaus variant) and `PersonAvatar` (beam variant). Don't roll a custom avatar system.

---

## 5. Elevation & Depth

The workshop is mostly flat. Cards have a hint of lift; modals and dropdowns have more. The dashboard's elevation tokens are bespoke and named — use them, don't reach for stock Tailwind `shadow-*` when you have a card.

### The Elevation Scale

From [`tailwind.config.js`](../../../apps/web/tailwind.config.js):

- **`shadow-sm`** (Tailwind default) — standard cards, `SettingsCard`, content panels.
- **`shadow-card-sm`** — `0px 0.5px 12px -5px rgba(30,41,59,0.20)`. The "barely there" lift — onboarding cards, marketing-adjacent surfaces.
- **`shadow-card-md`** — slightly more presence; floating panels.
- **`shadow-card-lg`** — pricing tiles, billing surfaces.
- **`shadow-card-xl`** — emphasized cards in dialogs.
- **`shadow-sm` on the survey container in the runtime** — _that's a runtime token, not a dashboard token._ Don't mix.
- **`shadow-lg`** — modals, dropdowns, popovers. The "lifted into the air" elevation.

### Rules

- **Cards get `shadow-sm` by default.** If you need more, climb the `shadow-card-*` ladder one step. Don't jump to `shadow-xl` for a routine card.
- **Modals and dropdowns get `shadow-lg` plus a `backdrop-blur-sm` overlay** (for modals only). The overlay is `bg-black/80` — heavy on purpose, because modals take the user out of the workshop temporarily.
- **One shadow per surface.** Don't stack a shadow on a card that's inside a card that's inside a sheet. Each layer carries the lift it owns; nested children stay flat.
- **No glow / no neon.** No `ring-2 ring-brand` "active card" tricks. The brand stays in chalk, not in atmospheric lighting.

---

## 6. Components

The dashboard is composed almost entirely from `apps/web/modules/ui/components/*` plus a few app-shell components in `apps/web/app/(app)/.../components/`. The catalog with file paths is in `workbench/blueprint/guidelines/components-guide-dashboard.md` — this section locks in the _rules_ for the most-touched surfaces.

### App Shell (sidebar + top bar)

The workspace shell is two columns: a vertical [`MainNavigation`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/MainNavigation.tsx>) sidebar (collapsible between `w-sidebar-collapsed` and `w-sidebar-expanded`) plus a [`TopControlBar`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/TopControlBar.tsx>) running across the content area. The content area (`#mainContent`) is `bg-slate-50` and scrolls; the sidebar and top bar stay pinned.

- **Sidebar items** use [`NavigationLink`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/components/NavigationLink.tsx>) — icon + label + active state. Active state is a slate background plus the brand-tinted left rail.
- **Top bar** holds the workspace + org breadcrumb, the workspace switcher, and quick actions.
- **Don't add a third nav layer.** If a page needs sub-navigation, use `SecondaryNavigation` _inside_ the page header, not a new global bar.

### Page Skeleton (`PageContentWrapper` + `PageHeader` + `SecondaryNavigation`)

Every workspace page should be assembled from these three. The pattern:

```tsx
<PageContentWrapper>
  <PageHeader pageTitle={t("...")}>
    <SecondaryNavigation navigation={...} activeId="..." />
  </PageHeader>
  {/* content */}
</PageContentWrapper>
```

- **`PageContentWrapper`** → `min-h-full space-y-6 p-6`. Sets the page padding and vertical rhythm. Don't pad inside it; let it own the gutter.
- **`PageHeader`** → `text-3xl font-bold text-slate-800` title, optional CTA on the right, `border-b border-slate-200` underline. `children` slot below the title is where `SecondaryNavigation` goes.
- **`SecondaryNavigation`** → flat tab strip with a 2px brand-tinted indicator under the active item. No pill backgrounds.

### Settings Card

[`SettingsCard`](<../../../apps/web/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard.tsx>) is the bench. Title + description in the header (with a `border-b border-slate-200` divider), CTA / button in the top-right, children below. Max width `max-w-4xl`. Use it for every settings panel; don't roll your own.

### Modals (Dialog, ConfirmationModal, ModalWithTabs)

All modals share the same chassis: `shadow-lg` content on a `bg-black/80 backdrop-blur-sm` overlay, opens at the page bottom on mobile (which doesn't exist) and centers on desktop.

- **[`Dialog`](../../../apps/web/modules/ui/components/dialog/index.tsx)** is the primitive — three widths (`narrow` 512px, `default` 720px, `wide` 720→960px responsive). Compose `DialogHeader` / `DialogBody` / `DialogFooter`.
- **[`ConfirmationModal`](../../../apps/web/modules/ui/components/confirmation-modal/index.tsx)** wraps Dialog for destructive confirms — defaults the icon to `CircleAlert`, the button variant to `destructive`, the cancel text to `t("common.cancel")`. Use this instead of building a bespoke "are you sure" every time.
- **[`ModalWithTabs`](../../../apps/web/modules/ui/components/modal-with-tabs/index.tsx)** is the standard tabbed dialog — slate-900 active title with a `border-b-2 border-brand-dark` indicator. Use for multi-step settings flows.

### Alerts & Banners

- **[`Alert`](../../../apps/web/modules/ui/components/alert/index.tsx)** comes in `default`, `error`, `warning`, `info`, `success`, `outbound`. Two sizes (`default` and `small`). Use the variant for semantic meaning; don't hand-color a generic `<div>` to look like an alert.
- **`LimitsReachedBanner` / `PendingDowngradeBanner`** sit _above_ the workspace shell, full-width. Reserve top-bar real estate for these.
- **Toaster** (`ToasterClient`) uses [`react-hot-toast`](https://react-hot-toast.com). Class names `formbricks__toast__success` / `formbricks__toast__error` carry the styling. Don't ship a second toast library.

### Forms

- **Form bridge:** [`Form`](../../../apps/web/modules/ui/components/form/index.tsx) wraps `react-hook-form` — `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`. Use this set; don't hand-wire `Controller` per field.
- **Validation:** zod via `@hookform/resolvers`. Schemas live alongside the form, not in shared util files.
- **Input focus state:** `focus:border-brand-dark focus:ring-2 focus:ring-slate-400 focus:ring-offset-2`. Don't override.
- **Error state:** `isInvalid` prop on [`Input`](../../../apps/web/modules/ui/components/input/index.tsx) → `border-red-500`. Pair with a `FormMessage` below.

### Empty & Loading States

- **[`EmptyState`](../../../apps/web/modules/ui/components/empty-state/index.tsx)** — two variants: `default` (three stacked slate rectangles bracketing the message — implies "this is where rows will appear") and `simple` (single small card).
- **[`LoadingSpinner`](../../../apps/web/modules/ui/components/loading-spinner/index.tsx)** — animated SVG, `text-slate-700`. Wrap in a centered container that owns its own height; the spinner doesn't size itself.
- **[`Skeleton`](../../../apps/web/modules/ui/components/skeleton/index.tsx) / `SkeletonLoader`** — slate-200 pulse blocks. Prefer skeletons over spinners for content-shaped loading.

---

## 7. Accessibility & UX Quality Bar

The non-negotiables. If a PR ships against these, it's a bug.

- **Keyboard:** every interactive element is reachable by tab; focus moves in visual order. Custom click-on-div is never acceptable — use `<button>` or `<a>` or wrap in `asChild`.
- **Focus rings:** every button uses `focus-visible:ring-1 focus-visible:ring-ring` (defined globally). Inputs use `focus:ring-2 focus:ring-slate-400 focus:ring-offset-2`. Never `outline: none` without a replacement.
- **Contrast:** body text on white must clear 4.5:1. `text-slate-800` on white passes; `text-slate-500` on white passes for large/secondary use. `text-slate-400` is reserved for disabled.
- **Touch targets:** desktop-first, but icon buttons should still be at least `h-9 w-9` (32px) — the `Button` `size="icon"` default.
- **Dialog semantics:** Radix dialog wraps modals — role, focus trap, Escape-to-close, return-focus are all handled by the primitive. Don't replace with a custom modal.
- **Screen readers:** every icon-only button must have `aria-label` or be wrapped in `TooltipRenderer` (which sets the accessible name). `IconBar` enforces this.
- **i18n:** every visible string flows through `react-i18next`'s `useTranslation()`. Strings live in `apps/web/locales/*`. Never hardcode user-facing copy.
- **`prefers-reduced-motion`:** Tailwind animations (`animate-shake`, `fadeIn`, `surveyLoading`) should be conditional on user preference where they're decorative. The runtime preview animations are exempt.
- **Color is never the only signal:** alerts pair icon + color + text; error inputs pair red border + `FormMessage` text.
- **Mobile:** the app is desktop-first by design. Any responsive choice below `sm` should fall through to the `NoMobileOverlay` rather than rendering a broken layout.

---

## 8. Implementation Notes for LLMs

When generating new pages, settings panels, or UI in `apps/web`:

- **Compose the existing components first.** The vast majority of pages are `PageContentWrapper` + `PageHeader` + (optional `SecondaryNavigation`) + a stack of `SettingsCard`. Don't invent a page layout — reach for these.
- **Use `@/modules/ui/components/*` for primitives.** Path alias: `@/modules/ui/components/button`, `@/modules/ui/components/input`, etc. Components are shadcn/ui new-york style on Radix; new primitives can be added via `npx shadcn@latest add <name>` per `components.json`.
- **Pick the right semantic component:**
  - Destructive confirm? → `ConfirmationModal`, not a hand-rolled dialog.
  - Page-level warning? → `Alert variant="warning"`, not a yellow `<div>`.
  - Tabbed dialog? → `ModalWithTabs`.
  - Settings panel? → `SettingsCard`.
- **Use `react-hook-form` + `zod` via the `Form` bridge.** Don't manage form state by hand.
- **Use `react-i18next` for every visible string.** `const { t } = useTranslation()` in client components; `getTranslate()` in server components.
- **Toasts come from `react-hot-toast`.** `import toast from "react-hot-toast"` and call `toast.success(...)` / `toast.error(...)`. Don't add a second toast library.
- **Charts are Recharts.** `apps/web/modules/ui/components/chart/index.tsx` is the wrapper; survey analytics charts compose from there.
- **Tables are TanStack Table v8.** `DataTable*` exports in `apps/web/modules/ui/components/data-table` provide headers, toolbar, settings modal, and a selection column.
- **Icons are Lucide.** Always. `import { ChevronRight } from "lucide-react"`.
- **Don't reach for libraries that aren't installed.** No Headless UI, no Material UI, no React-Aria-Components, no styled-components.
- **Server vs client:** App Router with `rsc: true` in `components.json`. Default to server components; add `"use client"` only when you need state, refs, or browser APIs.
- **Brand color sparingly.** Use `bg-brand-dark` for active state, `bg-primary` (slate-900) for the default CTA. If you find yourself adding `bg-brand` in a third place, stop and check the rule.
- **Dark mode is not wired.** Don't add `dark:` variants speculatively — they aren't toggled by the app shell and will only confuse future maintainers.

---

## 9. Do's and Don'ts

### Do

- **Do** assemble pages from `PageContentWrapper` + `PageHeader` + `SettingsCard`. It's the workshop's standard bench layout.
- **Do** use `text-slate-800` for primary text and `text-slate-500` for secondary. Slate-700, slate-600, slate-400-for-non-disabled are all drift.
- **Do** reserve `bg-brand-dark` for "you are here" — active nav, active tab, active step. Use it elsewhere and the signal blurs.
- **Do** use the named semantic color (`info`/`warning`/`success`/`error`) families, not raw blue/amber/green/red.
- **Do** wrap icon-only buttons in `TooltipRenderer` or set `aria-label`. Both are accessible; one is just nicer.
- **Do** prefer `ConfirmationModal`, `ModalWithTabs`, `SettingsCard`, `EmptyState`, and the `Alert` variants over hand-rolled equivalents.

### Don't

- **Don't** color a primary button teal. The default primary is slate-900 on purpose — see "The Quiet Primary."
- **Don't** stack two borders on the same surface. One hairline per card, one per input.
- **Don't** invent a new shadow value. The five `shadow-card-*` tokens plus `shadow-sm`/`shadow-lg` cover everything.
- **Don't** add a third level of nav. Top bar + sidebar is the global navigation. Page-level use `SecondaryNavigation` _inside_ `PageHeader`, not a new bar.
- **Don't** swap `react-hot-toast` for `sonner` (or any other toast library), and don't invent a new toast pattern.
- **Don't** ship `dark:` variants on a feature that doesn't already opt into dark — there is no `dark` class toggled on the shell.
- **Don't** import an icon from anything other than `lucide-react`.
- **Don't** write user-facing strings without `t()`. The app ships in many locales.
- **Don't** assume mobile works. If a flow has to work on a phone, it has to override `NoMobileOverlay` deliberately — which is almost never the right answer.

---

## Director's Closing Note

The Formbricks dashboard is a workshop, not a stage. The customer comes here to build, configure, and read — not to be wowed. Every design rule above exists to keep the chrome quiet so the work can be loud: slate scaffolding, one teal mark for "you are here," cards with a single hairline, headings in slate-800, and a primary button that doesn't beg. When you're tempted to add a gradient, a glow, a second border, or a teal CTA, ask: would the workshop be calmer or noisier with this in it? If the answer is noisier, leave it on the bench.
