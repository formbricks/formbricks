# @formbricks/ui

Reusable UI components package for Formbricks applications.

## Installation

This package is part of the Formbricks monorepo and is available as a workspace dependency.

## Usage

```tsx
import { Button, cn } from "@formbricks/ui";

function MyComponent() {
  return (
    <Button variant="primary" size="md">
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

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint
pnpm lint
```

## Structure

```
src/
├── components/     # React components
├── lib/           # Utility functions
└── index.ts       # Main entry point
```

## Adding New Components

1. Create a new component directory under `src/components/`
2. Export the component from `src/components/index.ts`
3. The component will be available from the main package export

