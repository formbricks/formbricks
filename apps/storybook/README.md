# Storybook

Renders the reusable UI pieces from `packages/survey-ui` for review, on React + TypeScript + Vite.

```bash
pnpm storybook
```

Lint runs from the repo root (`pnpm lint:code`). This app composes the shared `react` tier from
`@formbricks/config-oxlint` in `oxlint.config.ts`, adds the Storybook plugin's rules for story files, and
raises every warning to an error, so it stays warning-free.
