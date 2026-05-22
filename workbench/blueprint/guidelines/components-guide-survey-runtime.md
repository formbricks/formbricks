# Components Guide: Formbricks Survey Runtime

A field guide to the components in the survey runtime — what end-users see when they answer a Formbricks survey. The design rules these components enforce live in [`design-guidelines-survey-runtime.md`](./design-guidelines-survey-runtime.md).

The runtime lives in **two packages**, each with a different React flavor — keep them straight:

- **[`@formbricks/surveys`](../../../packages/surveys/)** — the embedding host. **Preact** (imports from `preact/hooks`, `preact/compat`). Owns the public render API, the survey-level state machine, the stacked-card orchestration, navigation between blocks, and the modal/inline mounting. This is the package the host page or the JS SDK actually calls.
- **[`@formbricks/survey-ui`](../../../packages/survey-ui/)** — the visual component library. **React 19** (imports from `react`). Ships the question-type renderers (`OpenText`, `Rating`, `NPS`, etc.) and the input primitives behind them. Designed to be consumed standalone by the dashboard's preview surface _and_ by the runtime host.

> **Note on Radix primitives.** The component library uses shadcn/ui (new-york style) on Radix — `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-slot`. These behave as the upstream Radix docs describe; this guide doesn't duplicate them. Reach for the higher-level Formbricks components below; only drop down to bare Radix when you genuinely need a new primitive.

---

## Public Render API (`@formbricks/surveys`)

Exported from [`packages/surveys/src/index.ts`](../../../packages/surveys/src/index.ts). This is what the JS SDK and the dashboard preview call into.

### `renderSurvey(props)`

- **Where:** [`packages/surveys/src/index.ts`](../../../packages/surveys/src/index.ts)
- **What:** the universal entry point. Mounts a survey in either `inline` (into `containerId`) or `modal` (into a fresh `#formbricks-modal-container` appended to `body`). Calls `addStylesToDom()` + `addCustomThemeToDom({ styling })` so the runtime's CSS lands once and the embedder's brand tokens are wired before render.
- **Important bits:** for `link` surveys, drops `placement`/`overlay`/`onClose`/`clickOutside` from the props — link surveys render full-page, no modal chrome. For `inline` of non-link surveys, keeps `placement` so the stacked-card animation honors it.

### `renderSurveyInline(props)` / `renderSurveyModal(props)`

- Convenience wrappers around `renderSurvey` that lock the mode to `inline` / `modal` respectively.

### `onFilePick(files)`

- **What:** dispatches the `FILE_PICK_EVENT` custom event with the picked files. Used when the host SDK has its own file picker UI (e.g., mobile) and needs to hand files into the runtime.

### `setStyleNonce(nonce)`

- **What:** sets a CSP nonce on every `<style>` element the runtime injects. Surfaced as `formbricksSurveys.setNonce` on `window`.

### `formbricksSurveys` on `window`

- The runtime publishes `window.formbricksSurveys = { renderSurveyInline, renderSurveyModal, renderSurvey, onFilePick, setNonce }` so the JS SDK can call into it without bundling Preact a second time.

---

## Shell & Orchestration (`@formbricks/surveys`)

These wire the survey end-to-end — they own the state machine, the container, the i18n context, and the navigation. You will read these when you change runtime-level behavior; you will rarely modify them in feature work.

### `RenderSurvey`

- **Where:** [`packages/surveys/src/components/general/render-survey.tsx`](../../../packages/surveys/src/components/general/render-survey.tsx)
- **What:** the outermost component the public API hands to Preact's `render()`. Computes the RTL direction from the survey + language, wires `onClose` with a 1000ms close delay, and renders `<SurveyContainer>` wrapping `<Survey>`.

### `Survey`

- **Where:** [`packages/surveys/src/components/general/survey.tsx`](../../../packages/surveys/src/components/general/survey.tsx)
- **What:** the survey-level state machine. Manages the block stack, the response data, TTC (time-to-completion) tracking, response variables, logic evaluation (`evaluateLogic`, `performActions`), recall interpolation, the response queue, offline storage / resume, and online status detection. The most consequential file in the runtime.
- **Important bits:** new feature work that adds a survey-level capability (auto-save, new logic operator, a new lifecycle hook) almost certainly touches this file. Read [`lib/survey-state.ts`](../../../packages/surveys/src/lib/survey-state.ts), [`lib/response-queue.ts`](../../../packages/surveys/src/lib/response-queue.ts), and [`lib/offline-storage.ts`](../../../packages/surveys/src/lib/offline-storage.ts) before changing anything in here.

### `SurveyContainer` (wrapper)

- **Where:** [`packages/surveys/src/components/wrappers/survey-container.tsx`](../../../packages/surveys/src/components/wrappers/survey-container.tsx)
- **What:** the root `<div id="fbjs">` plus the modal/inline frame. Modal mode adds the overlay (`light` → `bg-slate-400/50`, `dark` → `bg-slate-700/80`), `role="dialog" aria-modal="true"`, a focus trap (`useFocusTrap`), Escape-to-close, and optional click-outside dismissal.
- **Important bits:** the `id="fbjs"` is _the_ scoping ID for every CSS rule in the runtime. Don't add a parallel root.

### `I18nProvider`

- **Where:** [`packages/surveys/src/components/i18n/provider.tsx`](../../../packages/surveys/src/components/i18n/provider.tsx)
- **What:** mounts `react-i18next` with the resolved language. Wraps `RenderSurvey` so every translation call (`useTranslation()`) inside the runtime has a context. Translations themselves live in [`packages/surveys/locales/`](../../../packages/surveys/locales/).

---

## Card Stack & Wrappers (`@formbricks/surveys`)

The "Quiet Stage" metaphor in code. These manage what's on stage right now, what's queued behind, and how the active card lifts vs the dimmed sibling cards.

### `StackedCardsContainer`

- **Where:** [`packages/surveys/src/components/wrappers/stacked-cards-container.tsx`](../../../packages/surveys/src/components/wrappers/stacked-cards-container.tsx)
- **What:** the stage. Renders up to 4 cards at once — previous, current, next, next+1 — with offset-based transforms. Two arrangements: `"simple"` (a single bare card, no stack) and `"straight"`/`"casual"` (the default — the spotlight metaphor with the inactive cards behind).
- **Important bits:** the active card's border is applied via inline `border: 1px solid` from `highlightBorderColor` (app surveys) or `cardBorderColor` (link surveys) — _not_ via a Tailwind class. Resizes are observed (`ResizeObserver`) so the stage height tracks the active card content.

### `StackedCard`

- **Where:** [`packages/surveys/src/components/wrappers/stacked-card.tsx`](../../../packages/surveys/src/components/wrappers/stacked-card.tsx)
- **What:** a single card in the stack. Owns its offset, opacity, transform, and the ref reported back to the container for sizing.

### `ScrollableContainer`

- **Where:** [`packages/surveys/src/components/wrappers/scrollable-container.tsx`](../../../packages/surveys/src/components/wrappers/scrollable-container.tsx)
- **What:** vertical scroller used inside a card when content exceeds the container height — the welcome card with long media, an open-text card with long character limits, etc.

### `AutoCloseWrapper`

- **Where:** [`packages/surveys/src/components/wrappers/auto-close-wrapper.tsx`](../../../packages/surveys/src/components/wrappers/auto-close-wrapper.tsx)
- **What:** wraps the survey when `survey.autoClose` is set. Starts a countdown; pauses on user interaction (`hasInteracted` flag from `Survey`). Renders `AutoCloseProgressBar` to visualize the countdown.

---

## Card Content (`@formbricks/surveys`)

The card variants and the conditional rendering glue. These sit between the stack and the question elements.

### `WelcomeCard`

- **Where:** [`packages/surveys/src/components/general/welcome-card.tsx`](../../../packages/surveys/src/components/general/welcome-card.tsx)
- **What:** the opening card. Optional media (image/video), headline, subheader, optional CTA (defaults to `t("common.start")`), optional time-to-complete + response-count badges (the bespoke `TimerIcon` / `UsersIcon` SVGs live in this file).
- **Important bits:** auto-focuses its CTA when `autoFocusEnabled`.

### `EndingCard`

- **Where:** [`packages/surveys/src/components/general/ending-card.tsx`](../../../packages/surveys/src/components/general/ending-card.tsx)
- **What:** the closing card. Supports the `"endScreen"` variant (headline + subheader + optional CTA) and the `"redirectToUrl"` variant (auto-redirects after a short delay). Handles the "Create your own" Formbricks branding link on the final card.

### `BlockConditional`

- **Where:** [`packages/surveys/src/components/general/block-conditional.tsx`](../../../packages/surveys/src/components/general/block-conditional.tsx)
- **What:** renders a survey block based on logic evaluation — picks the right question / multi-question element to display for the current block.

### `ElementConditional`

- **Where:** [`packages/surveys/src/components/general/element-conditional.tsx`](../../../packages/surveys/src/components/general/element-conditional.tsx)
- **What:** the dispatcher that maps an element type (`openText`, `multipleChoiceSingle`, `nps`, `rating`, etc.) to the corresponding `@formbricks/survey-ui` component. **This is the file you add a `case` to when introducing a new question type.**

---

## Question Element Renderers (`@formbricks/survey-ui`)

The visual component for each question type. These are the React 19 components shipped from the component library — the runtime imports them through `ElementConditional`, and the dashboard's preview surface uses them directly. Every renderer composes `ElementHeader` + (optional `ElementError`) + an input primitive.

### `OpenText`

- **Where:** [`packages/survey-ui/src/components/elements/open-text.tsx`](../../../packages/survey-ui/src/components/elements/open-text.tsx)
- **What:** single-line `Input` or multi-line `Textarea`. Five `inputType`s — `text`, `email`, `url`, `phone`, `number`. Supports `charLimit.min/max` with a live count badge.

### `SingleSelect`

- **Where:** [`packages/survey-ui/src/components/elements/single-select.tsx`](../../../packages/survey-ui/src/components/elements/single-select.tsx)
- **What:** radio-group or dropdown variant of a single-choice question. Above the `SEARCH_THRESHOLD` option count the dropdown surfaces a search field (`DropdownSearchInput`). Supports an "Other" option with an inline custom input.

### `MultiSelect`

- **Where:** [`packages/survey-ui/src/components/elements/multi-select.tsx`](../../../packages/survey-ui/src/components/elements/multi-select.tsx)
- **What:** checkbox list. Same "Other"-option semantics as `SingleSelect`. Manages selection order so analytics can rebuild it.

### `Rating`

- **Where:** [`packages/survey-ui/src/components/elements/rating.tsx`](../../../packages/survey-ui/src/components/elements/rating.tsx)
- **What:** rating scale at ranges 3, 4, 5, 6, 7, or 10. Three visual scales — `number` (joined pill segments), `star` (yellow-400 fill, left-to-right), `smiley` (bespoke `Smileys` SVGs). Optional `colorCoding` tints with emerald/orange/rose semantically.
- **Important bits:** keyboard nav is `ArrowLeft`/`ArrowRight` + `Enter`/`Space`. Use `getRTLScaleOptionClasses` from `lib/utils` if you ever build a similar scale — don't hand-roll RTL border math.

### `NPS`

- **Where:** [`packages/survey-ui/src/components/elements/nps.tsx`](../../../packages/survey-ui/src/components/elements/nps.tsx)
- **What:** the standard 0–10 Net Promoter Score scale with detractor / passive / promoter color coding. Distinct from `Rating` because NPS has its own canonical semantics (0–10, fixed labels).

### `PictureSelect`

- **Where:** [`packages/survey-ui/src/components/elements/picture-select.tsx`](../../../packages/survey-ui/src/components/elements/picture-select.tsx)
- **What:** image-grid choice — supports single or multi-select. Each option is an image with an optional alt label.

### `Ranking`

- **Where:** [`packages/survey-ui/src/components/elements/ranking.tsx`](../../../packages/survey-ui/src/components/elements/ranking.tsx)
- **What:** drag-and-drop ranking of options. Animates reorder via `@formkit/auto-animate`.

### `Matrix`

- **Where:** [`packages/survey-ui/src/components/elements/matrix.tsx`](../../../packages/survey-ui/src/components/elements/matrix.tsx)
- **What:** the matrix grid — rows × columns with single-select per row. Used for Likert-style multi-question batteries.

### `DateElement`

- **Where:** [`packages/survey-ui/src/components/elements/date.tsx`](../../../packages/survey-ui/src/components/elements/date.tsx)
- **What:** date picker built on `react-day-picker`. Uses `getDateFnsLocale()` (also exported from the package) to localize the calendar.

### `FileUpload`

- **Where:** [`packages/survey-ui/src/components/elements/file-upload.tsx`](../../../packages/survey-ui/src/components/elements/file-upload.tsx)
- **What:** file uploader with drag-drop, preview, and progress. Handshake with the host page goes through the `FILE_PICK_EVENT` custom event (see `onFilePick` in the public API).

### `CTA`

- **Where:** [`packages/survey-ui/src/components/elements/cta.tsx`](../../../packages/survey-ui/src/components/elements/cta.tsx)
- **What:** call-to-action card — a single button that links out or dismisses. Used for "Book a demo" / "Learn more" survey flows.

### `Consent`

- **Where:** [`packages/survey-ui/src/components/elements/consent.tsx`](../../../packages/survey-ui/src/components/elements/consent.tsx)
- **What:** a checkbox-gated agreement. Renders an HTML body (sanitized) plus a "I agree" checkbox that must be checked before submit.

### `FormField`

- **Where:** [`packages/survey-ui/src/components/elements/form-field.tsx`](../../../packages/survey-ui/src/components/elements/form-field.tsx)
- **What:** generic labeled-field wrapper used by composite elements (contact-info, address) that need multiple labeled inputs inside a single question. Lets the renderer build a multi-input card without each input owning its own header.

---

## Headers, Errors, Media (`@formbricks/survey-ui`)

The shared scaffolding every element composes. If you build a new question type, you build it _around_ these — don't reinvent.

### `ElementHeader`

- **Where:** [`packages/survey-ui/src/components/general/element-header.tsx`](../../../packages/survey-ui/src/components/general/element-header.tsx)
- **What:** the standard question header — optional media, optional "Required" upper label, headline via `<Label variant="headline">`, optional description via `<Label variant="description">`. Accepts HTML in headline/description; sanitizes via `DOMPurify`, strips inline `style` for CSP safety.

### `ElementError`

- **Where:** [`packages/survey-ui/src/components/general/element-error.tsx`](../../../packages/survey-ui/src/components/general/element-error.tsx)
- **What:** the standard inline error display — a 4px destructive bar on the inline edge plus an `AlertCircle` icon and message above the input. Returns `null` when there's no error.

### `ElementMedia`

- **Where:** [`packages/survey-ui/src/components/general/element-media.tsx`](../../../packages/survey-ui/src/components/general/element-media.tsx)
- **What:** image or video preview at the top of a question card. Supports the `imageUrl` / `videoUrl` mutually-exclusive contract (`ElementHeader` enforces it). Lazy loads where possible.

### `Headline`, `Subheader` (`@formbricks/surveys` flavor)

- **Where:** [`packages/surveys/src/components/general/headline.tsx`](../../../packages/surveys/src/components/general/headline.tsx), [`subheader.tsx`](../../../packages/surveys/src/components/general/subheader.tsx)
- **What:** the Preact-side headline/subheader pair used by `WelcomeCard` and `EndingCard`. Distinct from `ElementHeader` because welcome/ending cards don't have an `htmlFor` target — they're not question prompts.

### `Label`

- **Where:** [`packages/survey-ui/src/components/general/label.tsx`](../../../packages/survey-ui/src/components/general/label.tsx)
- **What:** the typed label primitive — variants `default`, `headline`, `description`, `card`. Each variant maps to a `--fb-*` token group (font, weight, size, color, opacity). Accepts HTML content; sanitizes.

---

## Buttons (both packages)

### `Button` (component library)

- **Where:** [`packages/survey-ui/src/components/general/button.tsx`](../../../packages/survey-ui/src/components/general/button.tsx)
- **What:** the standalone button. Variants `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, **`custom`**. Sizes `default`, `sm`, `lg`, `icon`, `custom`. The `custom` variant applies the `.button-custom` class which pulls every property from `--fb-button-*` — **use this for primary CTAs in production runtime**, not `default`.

### `SubmitButton` (runtime)

- **Where:** [`packages/surveys/src/components/buttons/submit-button.tsx`](../../../packages/surveys/src/components/buttons/submit-button.tsx)
- **What:** the per-card "Next" / "Finish" CTA. Reads all visual properties from `--fb-button-*` CSS variables via inline `style`. Throttles to 300ms to prevent double-submit. Also wires Cmd/Ctrl+Enter as a global submit shortcut.

### `BackButton` (runtime)

- **Where:** [`packages/surveys/src/components/buttons/back-button.tsx`](../../../packages/surveys/src/components/buttons/back-button.tsx)
- **What:** the quieter "Back" counterpart. Defaults to ghost / outline; sits to the left (or right in RTL) of the submit button.

### `SurveyCloseButton` (runtime)

- **Where:** [`packages/surveys/src/components/general/survey-close-button.tsx`](../../../packages/surveys/src/components/general/survey-close-button.tsx)
- **What:** the modal-mode close X. Only renders for modal-mode app surveys (not link); positioned absolute at the top-right of the survey container. Uses the bespoke `CloseIcon` from `components/icons/`.

---

## Input Primitives (`@formbricks/survey-ui`)

The bare inputs the question renderers compose. Every visual property is tokenized — see the design guide's "Themed-Variable Rule."

### `Input`

- **Where:** [`packages/survey-ui/src/components/general/input.tsx`](../../../packages/survey-ui/src/components/general/input.tsx)
- **What:** single-line input. All visual properties via `--fb-input-*` tokens: `w-input`, `bg-input-bg`, `border-input-border`, `rounded-input`, `font-input`, `text-input-text`, `shadow-input`, `px-input-x py-input-y`. 3px brand-tinted focus ring. `aria-invalid` flips border to destructive.

### `Textarea`

- **Where:** [`packages/survey-ui/src/components/general/textarea.tsx`](../../../packages/survey-ui/src/components/general/textarea.tsx)
- **What:** auto-growing textarea via `field-sizing: content`. Same token surface as `Input`.

### `RadioGroup`, `RadioGroupItem`

- **Where:** [`packages/survey-ui/src/components/general/radio-group.tsx`](../../../packages/survey-ui/src/components/general/radio-group.tsx)
- **What:** Radix `RadioGroup` primitive themed via `--fb-*`. The indicator dot uses `fill-brand stroke-brand` so it inherits the deployment's brand color.

### `Checkbox`

- **Where:** [`packages/survey-ui/src/components/general/checkbox.tsx`](../../../packages/survey-ui/src/components/general/checkbox.tsx)
- **What:** Radix `Checkbox` themed via `--fb-*`. Used by `MultiSelect` and `Consent`.

### `Popover`, `DropdownMenu`, `DropdownSearchInput`, `Calendar`, `Alert`

- **Where:** [`packages/survey-ui/src/components/general/`](../../../packages/survey-ui/src/components/general/)
- **What:** Radix-backed primitives shared by the elements — popovers anchor the date picker, the dropdown menu drives the dropdown variant of `SingleSelect`/`MultiSelect`, the search input is the typeahead inside long dropdowns (`SEARCH_THRESHOLD` triggers it), the calendar drives `DateElement`, the alert is the inline notice surface.

### `Smileys`

- **Where:** [`packages/survey-ui/src/components/general/smileys.tsx`](../../../packages/survey-ui/src/components/general/smileys.tsx)
- **What:** the bespoke 10-face SVG smiley set used by `Rating scale="smiley"`. Each smiley accepts a `className` so `Rating` can pass `fill-emerald-300` / `fill-orange-300` / `fill-rose-300` for color-coded smileys. Not Lucide — this is illustration, not icons.

---

## Progress & Chrome (`@formbricks/surveys`)

### `ProgressBar`

- **Where:** [`packages/surveys/src/components/general/progress-bar.tsx`](../../../packages/surveys/src/components/general/progress-bar.tsx)
- **What:** the top-of-survey progress chrome. Computes progress as `(block_index + 1) / total_blocks` — block index, not weighted question count.

### `Progress` (bar primitive)

- **Where:** [`packages/surveys/src/components/general/progress.tsx`](../../../packages/surveys/src/components/general/progress.tsx)
- **What:** the visual primitive — 8px track styled by `--fb-progress-track-*` and `--fb-progress-indicator-*`. Animates width transitions over 500ms.

### `AutoCloseProgressBar`

- **Where:** [`packages/surveys/src/components/general/auto-close-progress-bar.tsx`](../../../packages/surveys/src/components/general/auto-close-progress-bar.tsx)
- **What:** the shrinking bar shown under the survey when auto-close is active. Uses the `shrink-width-to-zero` keyframe defined in `global.css`.

### `LanguageSwitch`

- **Where:** [`packages/surveys/src/components/general/language-switch.tsx`](../../../packages/surveys/src/components/general/language-switch.tsx)
- **What:** the language dropdown in the survey's top-right corner. Only renders when the survey has multiple languages. Uses the bespoke `LanguageIcon`, handles RTL flip, and re-renders the survey on language change via the parent's `setSelectedLanguageCode`.

---

## Branding (`@formbricks/surveys`)

### `FormbricksBranding`

- **Where:** [`packages/surveys/src/components/general/formbricks-branding.tsx`](../../../packages/surveys/src/components/general/formbricks-branding.tsx)
- **What:** the "Powered by Formbricks" footer. Rendered when `isBrandingEnabled` is true (controlled by the workspace plan). Opacity 0.6, `text-xs` — acknowledgment, not advertisement.

### `RecaptchaBranding`

- **Where:** [`packages/surveys/src/components/general/recaptcha-branding.tsx`](../../../packages/surveys/src/components/general/recaptcha-branding.tsx)
- **What:** the reCAPTCHA legal-notice footer. Required by Google's terms when the survey uses reCAPTCHA verification.

---

## Errors & Boundaries (`@formbricks/surveys`)

### `ErrorComponent`

- **Where:** [`packages/surveys/src/components/general/error-component.tsx`](../../../packages/surveys/src/components/general/error-component.tsx)
- **What:** the fallback card shown when survey setup itself fails (bad config, missing survey). Renders a generic "Something went wrong" card inside the standard chassis so the failure still looks intentional.

### `ResponseErrorComponent`

- **Where:** [`packages/surveys/src/components/general/response-error-component.tsx`](../../../packages/surveys/src/components/general/response-error-component.tsx)
- **What:** the variant shown when submitting a response fails after several retries. Surfaces the specific `TResponseErrorCodesEnum` value so the host page can react.

---

## Loading & Misc (`@formbricks/surveys`)

### `LoadingSpinner`

- **Where:** [`packages/surveys/src/components/general/loading-spinner.tsx`](../../../packages/surveys/src/components/general/loading-spinner.tsx)
- **What:** the in-card spinner used during async transitions (network response, file upload finalization). Distinct from the dashboard's spinner — this one is sized for the small survey card surface.

### `CalEmbed`

- **Where:** [`packages/surveys/src/components/general/cal-embed.tsx`](../../../packages/surveys/src/components/general/cal-embed.tsx)
- **What:** embeds a [Cal.com](https://cal.com) booking widget inline as a question type. Loads the Cal embed script on demand and listens for booking confirmation events to advance the survey.

---

## Icons

The runtime mixes two icon sources by design.

### Bespoke SVGs in `@formbricks/surveys`

- **Where:** [`packages/surveys/src/components/icons/`](../../../packages/surveys/src/components/icons/)
- **What:** the small set of chrome icons that are part of the survey-card brand:
  - `chevron-down-icon.tsx` — used by `LanguageSwitch` and dropdowns.
  - `close-icon.tsx` — modal close X.
  - `expand-icon.tsx` — full-screen toggle for inline mode.
  - `image-down-icon.tsx` — placeholder when an image fails.
  - `language-icon.tsx` — the globe in `LanguageSwitch`.
  - `link-icon.tsx` — used in `CTA` for outbound links.
- **Why bespoke:** these icons need to inherit `--fb-*` brand color through `currentColor`, and several are wordmark-adjacent. Don't replace them with Lucide.

### Lucide in `@formbricks/survey-ui`

- **What:** [Lucide React](https://lucide.dev) (`lucide-react@0.577.0`) for everything else — `Star` in `Rating`, `ChevronDown` in `SingleSelect`, `AlertCircle` in `ElementError`, etc. Outlined, 1.5px stroke, `size-4` inline default. Don't import a second icon set.

### `Smileys` (illustration, not icons)

- See the "Input Primitives" section. Filled bespoke SVGs used only by `Rating scale="smiley"` — explicitly not part of the icon system.

---

## Internals (`@formbricks/surveys/src/lib/`)

Not components, but you will read these when changing component behavior. Worth knowing where they live.

- **[`styles.ts`](../../../packages/surveys/src/lib/styles.ts)** — `addStylesToDom()` (injects the bundled CSS once) and `addCustomThemeToDom({ styling })` (overrides `--fb-*` tokens from the workspace styling object). Both are called by the public render API.
- **[`survey-state.ts`](../../../packages/surveys/src/lib/survey-state.ts)** — the `SurveyState` class. Carries `responseId`, `displayId`, `userId`, `contactId`, `singleUseId`, plus the `responseAcc` accumulator.
- **[`response-queue.ts`](../../../packages/surveys/src/lib/response-queue.ts)** — queue that flushes responses to the API with retry logic. Hooks into online/offline status.
- **[`offline-storage.ts`](../../../packages/surveys/src/lib/offline-storage.ts)** — persists in-progress responses to `localStorage` so a reopened survey can resume. Read by `Survey` on mount.
- **[`logic.ts`](../../../packages/surveys/src/lib/logic.ts)** — `evaluateLogic()` and `performActions()`. The survey-level conditional logic engine.
- **[`recall.ts`](../../../packages/surveys/src/lib/recall.ts)** — `parseRecallInformation()` and `replaceRecallInfo()`. Interpolates previous answers into question text ("Why did you choose `@PREVIOUS_ANSWER`?").
- **[`use-focus-trap.ts`](../../../packages/surveys/src/lib/use-focus-trap.ts)** — the focus trap hook used by `SurveyContainer` in modal mode.
- **[`utils.ts`](../../../packages/surveys/src/lib/utils.ts)** — `findBlockByElementId`, `getDefaultLanguageCode`, `getElementsFromSurveyBlocks`, `isRTLLanguage`, `cn`.
- **[`html-utils.ts`](../../../packages/surveys/src/lib/html-utils.ts)** — `isValidHTML()` and `stripInlineStyles()`. The CSP-safe sanitization helpers used by `Headline`, `Subheader`, `Label`, `ElementHeader`.

The matching helpers in `@formbricks/survey-ui` live in [`packages/survey-ui/src/lib/`](../../../packages/survey-ui/src/lib/) — notably `getRTLScaleOptionClasses` in [`utils.ts`](../../../packages/survey-ui/src/lib/utils.ts) for RTL-aware connected pill segments, and `getDateFnsLocale` in [`locale.ts`](../../../packages/survey-ui/src/lib/locale.ts).

---

## Where to start when…

- **"I need to add a new question type."** → Build the renderer in `packages/survey-ui/src/components/elements/<your-type>.tsx` composing `ElementHeader` + `ElementError` + the appropriate input primitives. Export from [`survey-ui/src/index.ts`](../../../packages/survey-ui/src/index.ts). Then add a `case` to [`element-conditional.tsx`](../../../packages/surveys/src/components/general/element-conditional.tsx) wiring your new component. Add the matching types in `@formbricks/types/surveys/elements`. Don't forget the story file and a test.
- **"I need to add a new survey-level option (e.g., auto-save, post-submit hook)."** → That lives in [`survey.tsx`](../../../packages/surveys/src/components/general/survey.tsx). Read [`survey-state.ts`](../../../packages/surveys/src/lib/survey-state.ts) and [`response-queue.ts`](../../../packages/surveys/src/lib/response-queue.ts) first; the state machine is dense.
- **"I need a new theme token."** → Add the variable to [`packages/survey-ui/src/styles/globals.css`](../../../packages/survey-ui/src/styles/globals.css) (the React-side default) _and_ to [`packages/surveys/src/styles/global.css`](../../../packages/surveys/src/styles/global.css) (the runtime-side default). Wire the derivation rule in [`apps/web/lib/styling/constants.ts`](../../../apps/web/lib/styling/constants.ts) so `getSuggestedColors()` produces a sensible default from the brand color. Update `tailwind.config.ts` if you want a class name (`bg-foo`).
- **"I need to support a new language."** → Add the locale file under [`packages/surveys/locales/`](../../../packages/surveys/locales/). Use existing keys; don't introduce new ones unless the new feature genuinely needs them.
- **"I need a new icon."** → If it's chrome that needs to inherit the brand color, add an SVG to [`packages/surveys/src/components/icons/`](../../../packages/surveys/src/components/icons/). If it's a generic glyph inside a question element, import from `lucide-react` in `@formbricks/survey-ui`.
- **"I need to render an RTL scale."** → Use [`getRTLScaleOptionClasses`](../../../packages/survey-ui/src/lib/utils.ts) from the lib. The `Rating` component is the reference.
- **"I need to embed the survey somewhere new."** → Call `renderSurvey` (or the inline/modal aliases) from the public API. The host gets a Preact-rendered `#fbjs` root; everything else is internal.
- **"A response is failing in production."** → Start at [`response-queue.ts`](../../../packages/surveys/src/lib/response-queue.ts) and [`ResponseErrorComponent`](../../../packages/surveys/src/components/general/response-error-component.tsx). The error codes are in `@/types/response-error-codes`.
