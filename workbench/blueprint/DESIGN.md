# Design

This file is the index of design guidelines for the Formbricks codebase. Each surface that has its own visual and
interaction language gets its own opinionated guide. This page is the table of contents — not the place to put new
rules.

## Guides

- **[Survey Runtime](./guidelines/design-guidelines-survey-runtime.md)** — the design system for the embedded
  survey runtime that end-users see when they answer a Formbricks survey. Covers `@formbricks/surveys` (Preact host)
  and `@formbricks/survey-ui` (React 19 component library), the `--fb-*` themeable token layer, the stacked-card
  "Quiet Stage" model, and the accessibility and embedding contract.
- **[Survey Runtime Components Guide](./guidelines/components-guide-survey-runtime.md)** — companion catalog to
  the runtime design guide. Field guide to the components in `@formbricks/surveys` and `@formbricks/survey-ui` —
  the public render API, the survey-level shell, the stacked-card stage, the question-type renderers, the input
  primitives, and the internal lib. Skips the bare Radix primitives.
- **[Dashboard (apps/web)](./guidelines/design-guidelines-dashboard.md)** — the design system for the Formbricks
  web app: workspace shell, settings pages, the survey editor, response analysis, and everything else inside
  `apps/web`. Covers the "Workshop" theme, the slate-with-teal-accent palette, the page skeleton pattern
  (`PageContentWrapper` + `PageHeader` + `SecondaryNavigation` + `SettingsCard`), and the elevation / typography
  / accessibility contracts.
- **[Dashboard Components Guide](./guidelines/components-guide-dashboard.md)** — companion catalog to the dashboard
  design guide. Field guide to the higher-level Formbricks-specific components in `apps/web` (app shell, page
  primitives, modals, alerts, forms, tables, the survey editor surface, segments, integrations). Skips the bare
  shadcn primitives — when you need a generic primitive, the upstream shadcn docs apply.
- **[Workflows Builder](./guidelines/design-guidelines-workflows.md)** — design blueprint for the Workflows feature
  inside `apps/web`: the React Flow canvas, node anatomy, the category color system (Trigger, Flow, Data, Core,
  Compute, AI, Human Input), the collapsible config drawer, list and run pages, status pills, and the explicit
  reuse map against the dashboard catalog plus the small set of net-new components needed.

## Conventions

- One design guide per surface. The runtime guide does not govern the dashboard, and vice versa. If a rule applies
  to both, it belongs in a shared section (added explicitly here) — not duplicated across guides.
- Guides are opinionated. Each one carries a creative north star, a token system, and concrete component rules.
  Vague guidelines get ignored; specific ones shape the product.
- Component catalogs sit next to their design guide and link back to it. Catalogs are inventories, not rule books —
  the rules they enforce live in the design guide.
- This index stays short. Add a new line here when a new guide ships; keep detail in the guide itself.
