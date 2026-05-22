# Design System Specification: The Quiet Stage

- **Theme:** The Quiet Stage
- **Product:** Formbricks Survey Runtime (`@formbricks/surveys`, `@formbricks/survey-ui`)
- **Framework:** Preact (`@formbricks/surveys` host) + React 19 (`@formbricks/survey-ui` components)
- **Styling:** Tailwind CSS v4 (CSS-based config via `@config` + `@theme`)
- **UI library:** shadcn/ui (new-york style) on Radix primitives — `@radix-ui/react-*`
- **Primary color:** `#64748b` (slate, default — every deployment overrides this via brand color)
- **Headline / ink color:** `#414b5a` (default, derived from brand × black @ 0.35)
- **Supported color schemes:** light (dark is not yet shipped — see "What this design is _not_")
- **Platform:** Web — embedded on third-party host pages (modal, inline, link), desktop and mobile

---

## 1. Overview & Creative North Star

**Creative North Star: One spotlight, one question, one host page that we never repaint.**

The survey runtime is not a product UI. It is a polite, scoped guest that appears on someone else's page — a blog, a SaaS app, a checkout flow — and asks one question at a time. The Quiet Stage metaphor: every question is a single act under a single spotlight. The host page is the dim audience hall. The survey honors its host (never repaints fonts, never leaks styles, never argues with the page reset) but commands its own small stage while it is performing. When the question is answered, the spotlight moves; the previous card slides into the wings.

Everything in this system serves that metaphor:

- **The stack** (see `stacked-cards-container.tsx`) is literally a stage with cards queued behind the one being acted. The card in the spotlight is the only one with full opacity.
- **The chrome recedes.** Default colors are slate. The default brand is `#64748b` because it has to look credible on _any_ host page — black, white, brand-purple, whatever. The runtime never tries to win the page; it tries to look at home on it.
- **The brand is a costume, not a body.** Every visual token is a CSS variable (`--fb-*`) that the embedder overrides at runtime. The same play, different staging.

What this design is _not_:

- Not a SaaS dashboard. There are no toolbars, breadcrumbs, sidebars, or settings panels in the survey runtime.
- Not a marketing site. There are no heroes, gradients, "Get started" splashes, or testimonial strips.
- Not a design language for the Formbricks app UI. That lives in a separate guide (see `workbench/blueprint/DESIGN.md`). The runtime guide governs only what end-users _see when they answer a Formbricks survey_.
- Not (yet) dark-mode-aware. The CSS variable system can carry a dark palette, but no dark surface roles are wired today. Treat dark surfaces as a future expansion, not an assumed capability.

---

## 2. Colors & Surface Philosophy

The runtime ships a slate-based default palette designed to disappear into almost any host page, then re-skins itself from a single brand color the embedder supplies. All color derives from a small set of CSS custom properties scoped to `#fbjs` (the runtime root) — never reach for arbitrary hex values in components; reach for the variable.

### The Themed-Variable Rule

**Never hardcode a color that an embedder might want to brand.** Every color a user can see — headline, label, input background, button background, option border, progress fill — must resolve from a `--fb-*` variable defined in `packages/survey-ui/src/styles/globals.css`. The single exception is rare neutral utility colors (`text-destructive`, `fill-emerald-300` on smiley ratings) where the meaning is universal and customer branding would harm clarity.

_Why:_ this is an embeddable widget. Hardcoded colors silently break every customer who themed their survey to match their brand. The variable layer is the contract; violating it is a design bug, not a style choice.

### Surface Hierarchy (default slate palette)

The runtime has a small number of layered surface roles. Use the named token, not the hex.

- **Host page** — outside `#fbjs`. We do not touch it.
- **Survey container (`--fb-survey-background-color`, default `#ffffff`)** — the modal / inline frame. Holds the stage. Full opacity for the current card; sibling stacked cards dim back via `opacity`.
- **Card border (`var(--fb-border-radius)` rounded, default 8px)** — applied via inline `border: 1px solid` from a `cardBorderColor` styling prop (see `stacked-cards-container.tsx`). The card is the spotlit surface. One border, never nested.
- **Input surface (`--fb-input-bg-color`, default `#f3f4f6`)** — soft, tinted background derived from brand × white @ 0.92. Inputs lift slightly off the card, never below it.
- **Option surface (`--fb-option-bg-color`, default `#f3f4f6`)** — same family as inputs; selected state shifts toward brand via `color-mix(in srgb, var(--fb-option-bg-color) 95%, black)`.
- **Progress track (`--fb-progress-track-bg-color`, default `#d9dbde`) / indicator (`--fb-progress-indicator-bg-color`, default `#414b5a`)** — the only persistent chrome above the stage.

### The Derived-Palette Rule

The default palette is _generated_ from the brand color by `getSuggestedColors()` in `apps/web/lib/styling/constants.ts`. Headline = brand × black @ 0.35. Input bg = brand × white @ 0.92. Card bg = brand × white @ 0.97. **Do not introduce a new visible color in a runtime component without either (a) sourcing it from `getSuggestedColors`, or (b) wiring a new `--fb-*` variable and a derivation rule in that file.** A "pretty grey we added in one component" is the kind of drift that breaks branded surveys six months later.

### One Border, Maximum

Cards have at most one border. Inputs and options carry their own subtle border (`--fb-input-border-color`, `--fb-option-border-color` — both derived from the brand). Don't double up: an option inside a card does not get a second outer ring. If you need separation, lean on the background tint difference between card and input, not a second stroke. _Why:_ in a small, modal-sized stage, every extra hairline reads as visual noise and makes the surface feel like a form on a 1998 webpage.

### Status Colors

- **Error (`text-destructive`, `bg-destructive`, default `oklch(0.577 0.245 27.325)`)** — used by `ElementError` with a 4px left bar plus inline message. Errors are never colored backgrounds across whole cards; they are bars and inline text on the same card.
- **Smiley rating** uses semantic emerald/orange/rose at 100/300 opacities. These are explicitly _not_ themed by the brand — a "very happy" face should not turn purple because someone set brand purple.

---

## 3. Typography

A single-typeface system: **`inherit`**. Every type token (`--fb-element-headline-font-family`, `--fb-input-font-family`, `--fb-button-font-family`, …) defaults to `inherit`. This is deliberate: the runtime adopts the host page's typeface unless the embedder explicitly chooses to override it.

When the embedder overrides, they set _all_ the font tokens together. We do not invent a fallback display face.

### Hierarchy

- **Headline (`label-headline`, `--fb-element-headline-*`)** — 16px / weight 600 / color `#414b5a` (default). The voice of the question. One per card.
- **Description (`label-description`, `--fb-element-description-*`)** — 14px / weight 400 / same ink as headline. Subordinate context, not a second question.
- **Label (`label-default`, `--fb-label-*`)** — 14px / weight 400. Option labels, helper text.
- **Upper label / required marker (`label-card`, `--fb-element-upper-label-*`)** — 12px / weight 400 / opacity 0.6. Quiet meta — "Required", scale endpoints, etc.
- **Input text (`--fb-input-font-size`, default 14px)** and **button text (`--fb-button-font-size`, default 16px)** — buttons sit one step _above_ input text in size; the primary CTA is the loudest type on the card by a hair.

### Hierarchy as Brand

The headline is the only weight-600 element on the card. Everything else is 400 or 500. _Why:_ a single bold makes the question feel like a question. Two bolds make it feel like a form.

### Rich Text in Questions

Headlines and descriptions accept HTML (`isValidHTML` → `DOMPurify.sanitize`). Inline `style` attributes are stripped to prevent CSP violations and to keep embedder-controlled type tokens authoritative. **Do not** allow inline color or font-family inside headline content — the design rule is enforced by the sanitizer.

---

## 4. Iconography

- **Source:** [Lucide React](https://lucide.dev) — `lucide-react@0.577.0`. This is the only icon set. Do not import from Heroicons, Phosphor, or react-icons.
- **Style:** outlined, 1.5px stroke, square. We do not mix filled and outlined in the same surface.
- **Default size:** `size-4` (16px) inline next to text, `size-5` (20px) for primary interaction targets. Buttons set their icons via the `[&_svg]:size-4` shorthand in `button.tsx` — don't override unless the design literally calls for a bigger glyph.
- **Color:** icons inherit `currentColor` from the surrounding text. The error icon (`AlertCircle` in `ElementError`) is the one place we intentionally tint via `text-destructive`. The smiley icons are a bespoke SVG set (`smileys.tsx`); they are _not_ Lucide and are the only filled illustration the system ships.
- **Stars and smileys are illustration, not icons.** Their color rules (yellow-400 fill on stars, semantic emerald/orange/rose tints on smileys) are governed by the Rating component, not by the icon system.

---

## 5. Elevation & Depth

The Quiet Stage has shallow depth on purpose. We have exactly three elevation roles:

- **Page / host surface** — flat. We don't add a backdrop unless `mode === "modal"` with an `overlay` set, and even then the overlay is a single `bg-slate-700/80` (dark) or `bg-slate-400/50` (light) wash, never a blur.
- **Survey card** — sits on the survey container with a 1px border and `var(--fb-border-radius)` (default 8px). No shadow on the card itself in inline mode.
- **Modal frame** — gets `shadow-lg` from Tailwind (`survey-container.tsx`). This is the only shadow in the runtime. Inputs and buttons get a hairline `box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)` (`--fb-input-shadow`) — a single pixel of presence, no more.

### The Stack as Depth

Stacked cards (`cardArrangement: "straight" | "casual"`) are the runtime's signature elevation move. Previous and upcoming cards sit _behind_ the current one with a small translate and opacity drop. The depth is suggested by overlap and motion, not by drop shadows. **Do not add `shadow-md` or `shadow-xl` to "make the active card pop"** — the stack does that work. Stacking extra shadow on top reads as a generic SaaS modal.

### When a stroke is genuinely required

If you must separate two same-tone surfaces and tint isn't an option, use the existing border tokens (`--fb-input-border-color`, `--fb-option-border-color`) — never `border-gray-200` direct. Strokes are tinted from brand, so they recolor when the embedder rebrands.

---

## 6. Components

The runtime is question-shaped. Components fall into three buckets: **structure** (containers, headers, progress), **elements** (the survey question types themselves), and **chrome** (buttons, language switch, branding).

All component files live in `packages/survey-ui/src/components/{general,elements}/` (React 19, shipped to consumers) and `packages/surveys/src/components/{general,buttons,wrappers}/` (Preact, the embedding host that orchestrates the stack and navigation).

### Survey Container (`survey-container.tsx`)

- **Visuals:** root `<div id="fbjs">` is the only place the runtime injects an ID. All Tailwind utilities are scoped to `#fbjs` via the `important: "#fbjs"` setting in both tailwind configs — this is what keeps host-page CSS from leaking in and our CSS from leaking out.
- **Modes:** `inline` (full width/height of mounting node) or `modal` (anchored to `bottomRight`/`topRight`/`topLeft`/`bottomLeft`/`center`; `sm:max-w-sm` ceiling on desktop).
- **Overlay:** `none` (pointer-events-none chrome), `light` (`bg-slate-400/50`), `dark` (`bg-slate-700/80`). One overlay token, three settings — do not invent new opacities.
- **Focus trap:** modals trap focus and dismiss on Escape via `useFocusTrap`. Click-outside dismissal is opt-in (`clickOutside`) and requires an overlay.

### Stacked Cards (`stacked-cards-container.tsx`, `stacked-card.tsx`)

- **Visuals:** the active card is full opacity, full size. Up to 4 cards render at once: previous, current, next, next+1, with offset-based transforms.
- **Arrangement:** `"simple"` (single card, no stack) or `"straight"/"casual"` (default — the spotlight metaphor). The simple arrangement is for accessibility / dense embeds.
- **Border:** the card's border is set via inline style from `highlightBorderColor` (for `app` surveys) or `cardBorderColor` (for `link` surveys) — _not_ via Tailwind classes. This is because the border color is per-survey-settings, not a theme token.
- **Width:** the card fills its container. The container constrains width via `sm:max-w-sm` in modal mode and via the embedder's layout in inline mode. Do not set fixed widths inside the card.

### Element Header (`element-header.tsx`)

Every question starts with an `<ElementHeader>` containing: optional media (image/video), an optional "Required" upper label, a Label-as-headline, and an optional description. Build new question types around this — do not invent a parallel headline pattern.

### Buttons (`button.tsx` in survey-ui; `submit-button.tsx` / `back-button.tsx` in surveys)

- **Variants:** `default` (primary, themed via `--fb-button-*`), `outline`, `secondary`, `ghost`, `link`, `destructive`, `custom`.
- **The custom variant is the runtime contract.** In live surveys, the host page's brand color drives the button via the `.button-custom` class, which reads `--fb-button-bg-color`, `--fb-button-text-color`, `--fb-button-border-radius`, etc. Always offer `custom` for production runtime buttons; the other variants are for the storybook / preview surfaces.
- **States:** focus uses a 3px ring (`focus-visible:ring-ring/50 focus-visible:ring-[3px]`) — never `outline: none` without a replacement. Disabled drops opacity to 0.5 and disables pointer events.
- **Primary CTA placement:** "Next" / "Submit" lives bottom-right of the card (LTR) / bottom-left (RTL). Back is its quieter sibling — outline or ghost, no shadow.
- **Submit throttling:** `submit-button.tsx` debounces double-clicks for 300ms. Keep this. Survey responses are expensive to debounce after the fact.

### Input (`input.tsx`) and Textarea (`textarea.tsx`)

- **Visuals:** `w-input`, `bg-input-bg`, `border-input-border`, `rounded-input`, `font-input`, `text-input-text`, `shadow-input`. Every property is a themed token. Padding is `px-input-x py-input-y` (default 8/8).
- **Focus:** 3px brand-tinted ring, never a raw outline.
- **Error state:** `aria-invalid:ring-destructive/20 aria-invalid:border-destructive` — the `ElementError` component renders the message above the input plus a 4px destructive bar on the inline edge.
- **`field-sizing: content`** on textarea — auto-grows by content. Don't replace with manual `rows` math.

### Single Select / Multi Select / Picture Select / Ranking

- **Option visuals:** `bg-option-bg`, `rounded-option`, `px-option-x py-option-y`. Selected state shifts to `option-selected-bg` (5% darker via `color-mix`). Hover state matches.
- **Radio / checkbox indicators:** Radix primitives (`RadioGroupPrimitive`, `CheckboxPrimitive`). The indicator dot/check uses `fill-brand stroke-brand` so it inherits the deployment's brand color. Do not replace with bespoke `<svg>` shapes.
- **"Other" option:** when enabled, renders an inline `<Input>` directly inside the selected option container. Don't pop a modal for the "other" field.

### Rating (`rating.tsx`)

The runtime supports three rating scales — number, star, smiley — at ranges 3, 4, 5, 6, 7, or 10. The number scale uses connected pill segments (`-ml-[1px]` joins them; first/last get rounded corners via `getRTLScaleOptionClasses`). The star scale fills left-to-right with yellow-400. The smiley scale uses bespoke `smileys.tsx` SVGs with optional semantic color coding (`addColors`).

Color coding (`colorCoding={true}`) tints option backgrounds emerald/orange/rose by position. This is the _one_ place semantic color overrides the brand — a "5/5" should feel positive regardless of brand purple.

### Progress (`progress.tsx`, `progress-bar.tsx`)

- **Visuals:** 8px-tall track, `--fb-progress-track-bg-color`, `--fb-progress-indicator-bg-color`, no border. Width is `floor(progress * 100)%` with a 500ms width transition.
- **Placement:** top of the survey container, above the active card.
- **Rule:** progress reflects block index, not weighted question count. Don't try to weight by question type — predictability beats accuracy here.

### Welcome / Ending Cards (`welcome-card.tsx`, `ending-card.tsx`)

Welcome and ending share the question card chassis but have no input. They are full-card editorial moments: optional media, headline, subheader, optional CTA. Treat them as the "lights up" / "lights down" of the stage.

### Branding (`formbricks-branding.tsx`, `recaptcha-branding.tsx`)

Footer, opacity 0.6, `text-xs`, never `text-brand`. Branding is acknowledgment, not advertisement.

---

## 7. Accessibility & UX Quality Bar

These are not aspirations. They are the contract.

- **Keyboard:** every interactive element is reachable and operable by keyboard. Rating uses ArrowLeft/ArrowRight + Enter/Space; Submit accepts Ctrl/Cmd+Enter globally. Tab order matches visual order in LTR _and_ RTL.
- **Focus rings are mandatory.** All buttons, inputs, options use `focus-visible:ring-[3px]` with a brand-tinted ring. Never `outline: none` without a replacement.
- **Contrast:** the default ink (`#414b5a` on `#ffffff`) passes WCAG AA. Branded deployments must not drop below 4.5:1 body / 3:1 large; `getForeground()` in `tailwind.config.ts` does a luminance check to pick `#000` or `#fff` for `brand-foreground`. Don't bypass it.
- **Touch targets:** 44×44pt minimum. Number-scale rating buttons have `min-h-[41px]` (rounded up by padding on touch); smiley targets have `min-h-9` with a `max-h-16` ceiling.
- **Screen readers:** radio/checkbox inputs are real `<input type="radio">` / `type="checkbox">` with `sr-only` plus a generated `aria-label` like `"Rate 4 out of 10"`. Don't replace with `role="button"` divs.
- **Dialog semantics:** modal mode uses `role="dialog" aria-modal="true"` plus `aria-label={t("common.survey_dialog")}`; focus is trapped and restored.
- **RTL:** `dir="auto"` is the default on every text container. Use `getRTLScaleOptionClasses()` (in `lib/utils.ts`) for direction-aware border/radius placement — don't hand-roll `mr-`/`ml-`.
- **`prefers-reduced-motion`:** card stack animation must honor it. Long-distance transforms get shortened or skipped; the spotlight still moves, the theatrics dim.
- **Color is never the only signal.** Required fields show the "Required" upper label. Errors show an icon + a bar + a message — never a red border alone.
- **i18n:** all visible strings flow through `react-i18next`. Never hardcode "Next" / "Submit" / "Required" — use `t("common.next")` etc.

---

## 8. Implementation Notes for LLMs

When generating new components, question types, or styling for the survey runtime:

- **Reach for existing components first.** Question types should compose `ElementHeader` + `ElementError` + an input primitive (`Input`, `Textarea`, `RadioGroup`, `Button`). If you find yourself writing a second headline component or a second submit button, stop — the existing one almost certainly fits.
- **Stay on the token surface.** Every visible color, radius, font, padding, and shadow must resolve from a `--fb-*` CSS variable defined in `packages/survey-ui/src/styles/globals.css` (or its `surveys` package twin `global.css`). If a value you want doesn't have a variable, add one to that file and to the derivation rule in `apps/web/lib/styling/constants.ts` — _both_ — before using it.
- **Scope every selector to `#fbjs`.** The tailwind configs (`packages/survey-ui/tailwind.config.ts`, `packages/surveys/tailwind.config.cjs`) set `important: "#fbjs"`. Don't add global selectors; don't ship a stylesheet that bleeds outside the survey root.
- **Use Lucide for icons, Radix for primitives.** Lucide React for outlined icons. Radix UI (`@radix-ui/react-radio-group`, `@radix-ui/react-checkbox`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`) for interaction primitives. The `@formbricks/survey-ui` package is shadcn/ui new-york style on top of Radix — don't reach for Base UI or Headless UI.
- **Preact in `packages/surveys`, React 19 in `packages/survey-ui`.** Imports from `preact/hooks` vs `react` must match the package you're editing. The components shipped from `survey-ui` must be Preact-compatible at the prop surface (no Suspense, no React server components — `"rsc": false` in `components.json`).
- **Honor Section 7 by default.** A new question type without keyboard support, a visible focus ring, an `aria-label`, and an i18n string is a bug, not a feature.
- **Don't `dir="ltr"` anything.** Default is `dir="auto"`. The only places that hardcode `dir` are RTL-aware computations in `lib/utils.ts`.
- **Don't introduce a shadow.** If you think you need one, you don't — re-read Section 5.
- **Don't `font-bold` outside `label-headline`.** One bold per card.
- **If you must add a new visible color, you are adding it to the wrong place.** Color belongs in the variable layer, not in a component.

---

## 9. Do's and Don'ts

### Do

- **Do** drive every color, font, radius, padding, and shadow from a `--fb-*` CSS variable. The variable is the contract with the embedder.
- **Do** scope every selector under `#fbjs`. The runtime is a guest; it doesn't repaint the host page.
- **Do** compose new question types from `ElementHeader` + `ElementError` + an existing input primitive.
- **Do** use Radix primitives plus Lucide icons. Lucide for icons, Radix for behavior.
- **Do** make focus visible on every interactive element — 3px brand-tinted ring, every time.
- **Do** route every visible string through `react-i18next` and accept `dir="auto"`.
- **Do** treat the stacked card as the elevation system; suggest depth with overlap and motion, not with `shadow-md`.

### Don't

- **Don't** hardcode a hex value, a font family, or a radius — embedders rebrand all of these and your hardcoded value will silently break them.
- **Don't** add a second border to a surface that already has one. One border per card; one border per input; tint, not stroke, for separation.
- **Don't** add a drop shadow to the active card — the stack provides the depth, an extra shadow makes it look like a generic SaaS modal.
- **Don't** stack two bold weights on the same card. Bold belongs to the headline.
- **Don't** invent a new icon set, primitive layer, or animation library. Lucide, Radix, CSS transitions, full stop.
- **Don't** ship `outline: none` without a replacement focus ring. There is no scenario in which a survey question should have an invisible focus state.
- **Don't** assume dark mode is wired. It isn't. If you need a dark surface, propose extending the variable layer first.
- **Don't** branch off the `surveys` package to add React-only patterns. The host is Preact. Imports must match.

---

## Director's Closing Note

The survey runtime is the polite stranger at the door of someone else's website. It arrives in slate, asks one question, and leaves before it wears out its welcome. Every design rule here exists to keep it that way — the variable system so the embedder's brand can dress it; the scoped `#fbjs` root so it never repaints the host; the single bold, single border, single shadow so the question is the loudest thing on the card. When you are tempted to add chrome, ask: would a quiet guest do this? If the answer is no, leave it off the stage.
