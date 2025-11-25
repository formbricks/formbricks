## Overview

The `@formbricks/survey-core` package provides React-authored survey UI components. These components are written using standard React APIs (hooks, JSX, etc.) for maximum familiarity and ecosystem compatibility.

## Purpose

This package serves as the source of truth for survey UI components that are used across:

- **Storybook** (React) - Component documentation and visual testing
- **Next.js web app** (React) - Main application UI
- **Embed bundle** (Preact) - Compiled via `@formbricks/surveys` using `preact/compat`

## Architecture

### React-First Development

All components are authored using standard React patterns:
- React hooks (`useState`, `useEffect`, etc.)
- JSX syntax
- React Context API
- Standard React component patterns

### Build Strategy

- **survey-core**: React components, treated as a normal React library
- **surveys**: Build step aliases `react` → `preact/compat`, producing a small Preact-powered widget
- **Web app + Storybook**: Continue using real React with no changes

## Features

- **React Developer Experience**: Familiar React patterns for all contributors
- **Type Safety**: Full TypeScript support
- **Testing**: Comprehensive test coverage with Vitest
- **Single Component Codebase**: Same UI code works everywhere

## File Structure

```text
packages/survey-core/
├── src/
│   ├── components/        # React survey components
│   │   ├── buttons/       # Survey navigation buttons
│   │   ├── general/       # Core survey components
│   │   ├── i18n/          # i18n provider component
│   │   ├── icons/         # Icon components
│   │   ├── questions/     # Question type components
│   │   └── wrappers/      # Layout wrappers
│   ├── lib/               # Utilities and helpers
│   ├── styles/            # CSS styles
│   └── types/             # TypeScript types
└── package.json
```

## Development

### Scripts

- `pnpm dev` - Start development build with watch mode
- `pnpm build` - Build for production
- `pnpm test` - Run tests
- `pnpm test:coverage` - Run tests with coverage
- `pnpm lint` - Lint and fix code

## Usage

### In React Applications

```tsx
import { SurveyComponent } from "@formbricks/survey-core";

function App() {
  return <SurveyComponent {...props} />;
}
```

### In Storybook

Components from this package are automatically available in Storybook for visual testing and documentation.

### In Embed Bundle

The `@formbricks/surveys` package imports from this package and compiles it to Preact for lightweight embeds.

