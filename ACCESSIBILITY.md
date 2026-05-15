# Accessibility

Formbricks is committed to making our experience management platform usable by everyone, including people who rely on assistive technologies. This document describes our current accessibility posture, the standards we're working toward, and how you can help.

This is a living document. We just completed our first internal audit of the survey runtime and have started landing fixes — expect this page to evolve as work progresses.

## Goals

We aim to conform to the following standards:

- **[WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/)** — the web content baseline procurement teams typically require.
- **[EN 301 549](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/)** — the European harmonised standard referenced by the **European Accessibility Act (EAA)**, which applies to Formbricks as an EU-based company.
- **Section 508** — for users in US public-sector contexts.

Priority areas where we're focused first:

- **Keyboard navigation** for the survey runtime and admin app — every interactive control reachable and operable without a mouse.
- **Screen reader support** — correct semantics, landmark roles, and live regions for status messages.
- **Visible focus** — every focusable element has a clearly visible focus indicator.
- **Color and contrast** — text and meaningful UI meet AA contrast ratios across themes.
- **Forms and errors** — labels are programmatically associated; validation errors are announced.

## Current Status

We are **not yet fully WCAG 2.1 AA conformant**. A static accessibility audit of `packages/surveys` on **2026-04-28** identified 14 findings (3 Critical, 7 Major, 4 Minor). Remediation is in progress:

- [#7927](https://github.com/formbricks/formbricks/pull/7927)
- [#7936](https://github.com/formbricks/formbricks/pull/7936)
- [#7939](https://github.com/formbricks/formbricks/pull/7939)

A formal VPAT / EN 301 549 conformance statement will be published once the survey runtime and admin app reach a stable AA baseline.

### Known Limitations

- Modal surveys do not yet expose a `role="dialog"` and do not trap keyboard focus.
- The language switcher in surveys is not yet reachable by keyboard.
- Several status messages (network errors, validation, progress) are not announced to screen readers.
- Color contrast has not been verified across all themes — themes are user-configurable and need per-theme review.
- The admin app (`apps/web`) has not yet been audited.

See the [open accessibility issues](https://github.com/formbricks/formbricks/labels/accessibility) for the live list.

## Supported Environments

- **Survey runtime** (`packages/surveys`) — embedded in customer websites and rendered as link surveys. Primary accessibility focus.
- **Admin app** (`apps/web`) — survey creation, response analysis, and team management. Audit pending.
- **Browsers** — latest two versions of Chrome, Firefox, Safari, and Edge.
- **Assistive technologies** — we test against VoiceOver (macOS/iOS), NVDA (Windows), and TalkBack (Android). Other AT may work but is not actively validated.

## Contributor Requirements

If you are contributing UI changes, please:

1. **Use semantic HTML first.** A `<button>` beats a `<div role="button">`. Reach for ARIA only when native semantics don't fit.
2. **Keyboard test your change.** Tab through it. Activate every control with Enter/Space. Esc should close overlays.
3. **Preserve focus.** Don't add `tabIndex={-1}` to interactive elements. Move focus deliberately when content changes (e.g. on modal open).
4. **Label every control.** Inputs need a programmatically associated `<label>` or `aria-label`. Icon-only buttons need an `aria-label`.
5. **Announce status changes.** Use `role="alert"` for errors and `role="status"` / `aria-live="polite"` for non-urgent updates. Don't wrap large regions in `aria-live` — scope it tightly.
6. **Don't rely on color alone** to convey meaning (errors, required fields, status).
7. **Check contrast.** Text against its background should meet 4.5:1 (3:1 for large text and UI components).
8. **Run [axe DevTools](https://www.deque.com/axe/devtools/) or Lighthouse** on the page you changed before opening a PR.

PRs that touch UI should mention accessibility considerations in the description.

## Reporting Accessibility Issues

If you find an accessibility barrier, please [open an issue](https://github.com/formbricks/formbricks/issues/new?labels=accessibility&template=accessibility.yml) using the accessibility template.

Include:

- The page or component affected
- Expected vs. actual behavior
- Steps to reproduce
- Browser, OS, and assistive technology (e.g. NVDA 2024.1 on Firefox 124)
- Severity from your perspective (blocker vs. inconvenience)

For issues that block you from completing a task — especially in a procurement or compliance context — email **[hola@formbricks.com](mailto:hola@formbricks.com)** so we can prioritise appropriately.

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [EN 301 549 (v3.2.1)](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/)
- [European Accessibility Act overview](https://ec.europa.eu/social/main.jsp?catId=1202)
- [GitHub's Accessibility Best Practices guide](https://opensource.guide/accessibility-best-practices-for-your-project/)
- [MDN Accessibility Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
