# UI & Design

Read before designing, mocking up, or building a new screen, flow, or component.

## Reuse before inventing

- Look for the pattern in the product first: `apps/web/modules/ui/components`, then the Storybook in `apps/storybook`. Reuse what exists, and match how neighbouring screens use it.
- Add a new component only when no existing one can carry the interaction. Say why in the plan and the PR.
- Use the terms in `GLOSSARY.md` for all UI copy, and add every user-facing string to `apps/web/locales/en-US.json`.

## Reference research

When a Mobbin MCP is connected, check how comparable products solve the interaction before settling on a layout, especially for UX flows and states. Use it to improve a design that already fits Formbricks, not to replace Formbricks patterns with someone else's.

## Mocks

Check a mock or prototype against the existing patterns above before building it. Where it departs from one, name the departure and decide whether it earns a new component.
