# Accessibility

Formbricks is committed to making our platform usable by everyone, including people who rely on assistive technologies.

## Standards

We aim to conform to:

- **[WCAG 2.1 Level AA](https://www.w3.org/TR/WCAG21/)** — the web content baseline.
- **[EN 301 549](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/)** — the European harmonised standard referenced by the **European Accessibility Act (EAA)**, applicable to us as a Germany-based company.
- **Section 508** — for users in US public-sector contexts.

## Priorities

1. **End-user surveys** (`packages/surveys`) — everything respondents see and interact with. This is our highest priority because survey takers don't choose Formbricks; the organisations running surveys choose for them.
2. **Admin app** (`apps/web`) — survey creation, response analysis, and team management used by Formbricks customers.

In both areas we focus on:

- Keyboard navigation with a clearly visible focus indicator
- Screen reader support through semantic HTML and correctly scoped ARIA
- Sufficient color and contrast
- Programmatically associated labels and announced status messages

## Supported Environments

- Latest two versions of Chrome, Firefox, Safari, and Edge
- VoiceOver (macOS/iOS), NVDA (Windows), and TalkBack (Android)

## Contributing

When contributing UI changes:

- Prefer semantic HTML over ARIA.
- Tab through your change end-to-end and confirm focus is visible at every stop.
- Label every control. Don't convey meaning by color alone.
- Run [axe DevTools](https://www.deque.com/axe/devtools/) or Lighthouse on the page you changed.

## Reporting Accessibility Issues

If you encounter an accessibility barrier, please [open an issue](https://github.com/formbricks/formbricks/issues/new?labels=accessibility&template=accessibility.yml) using the accessibility template. For blocking issues in a procurement or compliance context, email **[hola@formbricks.com](mailto:hola@formbricks.com)**.

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [EN 301 549](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/)
- [European Accessibility Act overview](https://ec.europa.eu/social/main.jsp?catId=1202)
- [MDN Accessibility Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
