# Accessibility Findings Log

Running log of WCAG issues surfaced by `apps/web/playwright/survey-accessibility.spec.ts` (axe-core 4.11).

Tags evaluated: `wcag2a/aa`, `wcag21a/aa`, `wcag22aa`, `best-practice`, `experimental`, `ACT`, `section508`, `EN-301-549`.

Status legend: `open` (needs fix), `fixed` (resolved in code), `wontfix` (intentional, with reason).

---

## Human-readable conclusion (read this first)

**5 bugs caught by axe + 1 bug axe physically can't see** on the kitchen-sink survey `s/cmpp5mvdj0001rk4pibtxpwc0`. Mapped to the actual user-facing behavior:

1. **The Matrix question is partially inaccessible to screen readers.** Its table's top-left corner header is empty (`<th>` with no text), so screen-reader users hear silence where row/column meaning should be announced. Source: [packages/survey-ui/src/components/elements/matrix.tsx:106](packages/survey-ui/src/components/elements/matrix.tsx#L106).

2. **The File Upload question breaks keyboard navigation.** A `<button>` is nested inside a `<label>` (both focusable), which axe rates `serious` — keyboard users can land in an ambiguous state and screen readers announce the wrong role. Source: [packages/survey-ui/src/components/elements/file-upload.tsx:171-185](packages/survey-ui/src/components/elements/file-upload.tsx#L171-L185).

3. **Every survey's Submit button steals tab order.** `SubmitButton` defaults to `tabIndex={1}`, which means it gets focused **before** the question inputs above it on the page. Keyboard users tab into the Submit button before they can reach the answer fields. Source: [packages/surveys/src/components/buttons/submit-button.tsx:15](packages/surveys/src/components/buttons/submit-button.tsx#L15).

4. **The whole survey page has no main landmark.** Screen-reader users can't jump to the survey content with the standard "go to main" shortcut — they have to tab through nav / branding first. Source: [apps/web/modules/survey/link/layout.tsx:12](apps/web/modules/survey/link/layout.tsx#L12) and [apps/web/modules/survey/link/components/link-survey-wrapper.tsx:77](apps/web/modules/survey/link/components/link-survey-wrapper.tsx#L77) both use `<div>` where a `<main>` would resolve this.

5. **Mobile respondents can't pinch-zoom.** The link-survey layout disables zoom (`userScalable: false, maximumScale: 1.0`), violating WCAG 1.4.4 (Resize Text). Low-vision users on phones are blocked. Source: [apps/web/modules/survey/link/layout.tsx:6-7](apps/web/modules/survey/link/layout.tsx#L6-L7).

6. **(Bonus — axe missed this; surfaced manually during investigation.) Validation errors are silent for screen-reader users.** When a respondent clicks Next on a required field that's empty, "Please fill out this field" appears visually — but the error component has no `aria-live` or `role="alert"`, so screen readers don't announce it. The user sits there waiting to know why nothing happened. Source: [packages/survey-ui/src/components/general/element-error.tsx:27](packages/survey-ui/src/components/general/element-error.tsx#L27). This is a WCAG 4.1.3 (Status Messages) failure.

### Most-likely-impacted question types

| Question type | Likely accessibility issue | When the bug bites |
|---|---|---|
| **Matrix** | Empty corner `<th>` | Screen-reader user reading row/column structure |
| **File Upload** | Nested `<button>` inside `<label>` | Keyboard user tabbing through upload control |
| **Address / Contact Info / any required Open-text** | Validation errors not announced | Screen-reader user submits empty required field |
| **All question types** | Submit button steals tab order (`tabIndex=1`) | Keyboard user tabbing — Submit is focused before the actual answer field |
| **All question types** | No `<main>` landmark; zoom disabled | Screen-reader user navigating by landmarks; mobile user zooming |

### Likely-still-broken question types we didn't test in this run

These were removed from the kitchen-sink survey during walker tuning. Earlier runs proved at least the date picker has its own bugs, and the others were never scanned.

| Question type | Suspected issue (needs re-test) |
|---|---|
| **Date picker** | `color-contrast` failures on out-of-month greyed-out days (confirmed in earlier run, code in `packages/survey-ui` date picker). |
| **CTA** | Untested. |
| **Cal.com Scheduler** | Outer wrapper untested; embedded iframe is third-party (`wontfix`). |

---

## Test matrix — 9 variants run

| # | Test | Raw violations |
|---|---|---|
| 1 | Desktop full walk (1280×720) | 11 |
| 2 | Desktop empty-submit (validation state) | 4 |
| 3 | Mobile full walk (390×844) | 11 |
| 4 | Mobile empty-submit | 4 |
| 5 | Tablet full walk (820×1180) | 11 |
| 6 | Forced-colors (Windows high-contrast simulation) | 11 |
| 7 | Reduced-motion | 11 |
| 8 | Dark color scheme | 11 |
| 9 | Back navigation (Next → Back) | 3 |
| **Total raw** | | **77** |
| **Unique WCAG rules** | | **5 (axe) + 1 (manual)** |

### What expanding the matrix taught us

- **Variants didn't surface new rules.** Forced-colors, reduced-motion, dark mode, tablet, mobile, and back-navigation — none added a sixth rule family. **Axe-core has hit its automated ceiling on this URL with the current question set.**
- **Empty-submit didn't surface new axe rules either** — but it DID let us see the validation error UI, which is how the manual aria-live bug was caught.
- **Back-navigation actually finds fewer violations** because it returns to a card without the matrix or file-upload questions, so those specific bugs aren't re-rendered.

---

## Full violation table (deduped — 5 rule families)

| Status | Impact | Rule | Where (CSS) | Source file |
|---|---|---|---|---|
| open | serious | `nested-interactive` | `.py-6` | [packages/survey-ui/src/components/elements/file-upload.tsx:171-185](packages/survey-ui/src/components/elements/file-upload.tsx#L171-L185) |
| open | serious | `tabindex` (positive) | `.border-submit-button-border` | [packages/surveys/src/components/buttons/submit-button.tsx:15](packages/surveys/src/components/buttons/submit-button.tsx#L15) |
| open | moderate | `meta-viewport` | `meta[name="viewport"]` | [apps/web/modules/survey/link/layout.tsx:6-7](apps/web/modules/survey/link/layout.tsx#L6-L7) |
| open | moderate | `region` | `.min-h-dvh.flex-col.…`, `img` | [apps/web/modules/survey/link/layout.tsx:12](apps/web/modules/survey/link/layout.tsx#L12), [apps/web/modules/survey/link/components/link-survey-wrapper.tsx:77](apps/web/modules/survey/link/components/link-survey-wrapper.tsx#L77) |
| open | minor | `empty-table-header` | `thead > tr > th:nth-child(1)` | [packages/survey-ui/src/components/elements/matrix.tsx:106](packages/survey-ui/src/components/elements/matrix.tsx#L106) |
| open | serious | (manual) error messages not announced | n/a — dynamic | [packages/survey-ui/src/components/general/element-error.tsx:27](packages/survey-ui/src/components/general/element-error.tsx#L27) |

---

## Where additional findings are still likely hiding (axe can't see these)

| Where | Why it's invisible | How to surface |
|---|---|---|
| Removed question types: **Date picker, File upload, Cal.com Scheduler, CTA**. | Date picker is the only one currently in the survey (file upload is in but isn't fully exercised by the walker). Cal/CTA/date were removed earlier in this session. Date picker already proved (in earlier runs) to have `color-contrast` violations on out-of-month days. | Build a second survey with these question types and re-run. |
| **Validation error announcements** for screen readers. | Caught manually this session via page snapshot inspection. Axe is a static scanner — it sees the error text exists, can't tell if SRs will announce it. | Already documented above. Fix at [packages/survey-ui/src/components/general/element-error.tsx:27](packages/survey-ui/src/components/general/element-error.tsx#L27). |
| Whether alt text is *meaningful* (not just present). | Axe only checks presence. | Manual review of each `<img>` alt. |
| Heading-order *logic* vs structure. | Axe checks order, not whether the structure makes sense. | Manual review. |
| Screen-reader announcements on dynamic changes (Next click, loading spinner, card transitions). | Axe is a static scanner. | Manual NVDA / VoiceOver pass. |
| Focus order matches visual order (beyond positive `tabindex`). | Axe catches positive tabindex (caught above) but not the actual focus path after interactions. | Manual keyboard pass: Tab through every card, confirm focus is visible and lands in expected order. |
| Color as sole conveyor of meaning. | Axe catches some patterns (link-in-text-block) but not all. | Manual review. |
| Theme variants (branded color palettes, multi-language, RTL). | Not tested here. | Add URL variants when surveys support them. |
| Per Deque: **axe catches ~30–40% of WCAG issues automatically.** The remaining 60–70% need a human with NVDA / VoiceOver. | | Manual SR pass on this same survey. |

---

## Walker / spec improvements applied this session

| Improvement | File |
|---|---|
| Walker scans every visible checkbox (not just first). | [apps/web/playwright/survey-accessibility.spec.ts:73-79](apps/web/playwright/survey-accessibility.spec.ts#L73-L79) |
| Walker picks a picture-select choice. | [apps/web/playwright/survey-accessibility.spec.ts:90-96](apps/web/playwright/survey-accessibility.spec.ts#L90-L96) |
| Walker picks a calendar date. | [apps/web/playwright/survey-accessibility.spec.ts:98-108](apps/web/playwright/survey-accessibility.spec.ts#L98-L108) |
| Stuck/error state always scanned before bailing. | [apps/web/playwright/survey-accessibility.spec.ts:135-141](apps/web/playwright/survey-accessibility.spec.ts#L135-L141) |
| End-of-survey state always scanned. | [apps/web/playwright/survey-accessibility.spec.ts:131-134](apps/web/playwright/survey-accessibility.spec.ts#L131-L134), [156-159](apps/web/playwright/survey-accessibility.spec.ts#L156-L159) |
| Walker waits for first card to mount before scanning. | [apps/web/playwright/survey-accessibility.spec.ts:119-122](apps/web/playwright/survey-accessibility.spec.ts#L119-L122) |
| Axe tags expanded to 10 tag families (was 4). | [apps/web/playwright/survey-accessibility.spec.ts:10-21](apps/web/playwright/survey-accessibility.spec.ts#L10-L21) |
| 6 new test variants added (mobile empty-submit, tablet, forced-colors, reduced-motion, dark, back-nav). | [apps/web/playwright/survey-accessibility.spec.ts:182-291](apps/web/playwright/survey-accessibility.spec.ts#L182-L291) |

---

## How to run

```bash
# All 9 tests (requires CI=1 to bypass the local maxFailures=1 setting)
CI=1 SURVEY_URL="http://localhost:3000/s/your-survey-id" pnpm test:e2e survey-accessibility
pnpm exec playwright show-report
```
