# @formbricks/survey-ui

Reusable UI components package for Formbricks applications.

## Installation

This package is part of the Formbricks monorepo and is available as a workspace dependency.

## Usage

```tsx
import { Button } from "@formbricks/survey-ui";

function MyComponent() {
  return (
    <Button variant="default" size="default">
      Click me
    </Button>
  );
}
```

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev


# Lint
pnpm lint
```

## Structure

```text
src/
├── components/     # React components
├── lib/           # Utility functions
└── index.ts       # Main entry point
```

## Adding New Components

### Using shadcn CLI (Recommended)

This package is configured to work with shadcn/ui CLI. You can add components using:

```bash
cd packages/survey-ui
pnpm ui:add <component-name>
```

**Important**: After adding a component, reorganize it into a folder structure:

For example:
```bash
pnpm ui:add button
pnpm ui:organize button
```

Then export the component from `src/components/index.ts`.

### Manual Component Creation

1. Create a new component directory under `src/components/<component-name>/`
2. Create `index.tsx` inside that directory
3. Export the component from `src/components/index.ts`
4. The component will be available from the main package export

## Component Structure

Components follow this folder structure:

```text
src/components/
├── button.tsx
├── button.stories.tsx
```

## Theming

This package uses CSS variables for theming. The theme can be customized by modifying `src/styles/globals.css`.

Both light and dark modes are supported out of the box.

## CSS Scoping

By default, this package builds CSS scoped to `#fbjs` for use in the surveys package. This ensures proper specificity and prevents conflicts with preflight CSS.

To build unscoped CSS (e.g., for standalone usage or Storybook), set the `SURVEY_UI_UNSCOPED` environment variable:

```bash
SURVEY_UI_UNSCOPED=true pnpm build
```

**Note:** Storybook imports the source CSS directly and compiles it with its own Tailwind config, so it's not affected by this scoping setting.

