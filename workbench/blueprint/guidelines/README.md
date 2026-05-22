# Guidelines

AI and Human Development Guidelines

This directory contains the durable guidelines that AI and human development processes should follow when working on Formbricks. It expands on [`AGENTS.md`](../../../AGENTS.md) with concrete rules, design language, and component catalogs for each surface of the product.

## Index

### Survey Runtime — what end-users see when answering a Formbricks survey

1. [Survey Runtime Design Guidelines](./design-guidelines-survey-runtime.md) — the "Quiet Stage" design language for `@formbricks/surveys` (Preact host) and `@formbricks/survey-ui` (React 19 component library). Covers the `--fb-*` themeable token layer, the stacked-card model, and the embedding / accessibility contract.
2. [Survey Runtime Components Guide](./components-guide-survey-runtime.md) — field guide to the components in both runtime packages: the public render API, the survey-level shell, the card stage, the question-type renderers, the input primitives, and the internal lib.

### Dashboard (`apps/web`) — what survey creators and admins see

3. [Dashboard Design Guidelines](./design-guidelines-dashboard.md) — the "Workshop" design language for the Formbricks dashboard. Covers the slate-with-teal-accent palette, the page skeleton pattern (`PageContentWrapper` + `PageHeader` + `SecondaryNavigation` + `SettingsCard`), elevation, typography, and the accessibility contract.
4. [Dashboard Components Guide](./components-guide-dashboard.md) — catalog of the higher-level Formbricks-specific components in `apps/web` (app shell, page primitives, modals, alerts, forms, tables, the survey editor surface, segments, integrations). Skips the bare shadcn primitives.

## How to use these

- **Designing or building UI** — read the relevant design guide before the components guide. The design guide carries the rules; the components guide points to what already exists.
- **Reviewing a PR** — cite specific rules from the matching guide ("this violates the One-Hairline Rule in `design-guidelines-dashboard.md`") rather than restating principles in the review.
- **Generating code with an AI agent** — point the agent at the matching guide for the surface it's editing. The Implementation Notes section in each design guide is written for that audience.
- **Adding a new guide** — add the file under `workbench/blueprint/guidelines/` using the same naming convention (`design-guidelines-<surface>.md` / `components-guide-<surface>.md`) and link it from this index and from [`workbench/blueprint/DESIGN.md`](../DESIGN.md).
