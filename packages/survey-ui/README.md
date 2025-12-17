# @formbricks/survey-ui

A React UI component library for building survey interfaces. This package provides reusable form elements and survey-specific components built with Radix UI and Tailwind CSS.

## Installation

```bash
# npm
npm install @formbricks/survey-ui

# pnpm
pnpm add @formbricks/survey-ui

# yarn
yarn add @formbricks/survey-ui
```

## Peer Dependencies

This package requires React 19:

```bash
npm install react@^19.0.0 react-dom@^19.0.0
```

## Quick Start

### 1. Import Styles

**Important:** You must import the CSS file for components to render correctly:

```tsx
import "@formbricks/survey-ui/styles";
```

### 2. Wrap Components

**Important:** All components must be wrapped in a container with `id="fbjs"` for styles to apply correctly:

```tsx
import { Button } from "@formbricks/survey-ui";
import "@formbricks/survey-ui/styles";

function App() {
  return (
    <div id="fbjs">
      <Button variant="default" size="default">
        Click me
      </Button>
    </div>
  );
}
```

## Components

### General Components

- **Button** - Button component with multiple variants and sizes
- **Input** - Text input component
- **DropdownMenu** - Dropdown menu component with sub-components
- **ElementHeader** - Header component for form elements
- **ElementMedia** - Media display component for form elements

### Form Elements

- **OpenText** - Open-ended text input element
- **SingleSelect** - Single choice selection element
- **MultiSelect** - Multiple choice selection element
- **Matrix** - Matrix/table selection element
- **DateElement** - Date picker element
- **PictureSelect** - Image-based selection element
- **FileUpload** - File upload element
- **Rating** - Rating/star selection element
- **NPS** - Net Promoter Score element
- **Ranking** - Ranking/drag-and-drop element
- **CTA** - Call-to-action button element
- **Consent** - Consent/checkbox element
- **FormField** - Generic form field wrapper component

## Usage Examples

### Basic Button

```tsx
import { Button } from "@formbricks/survey-ui";
import "@formbricks/survey-ui/styles";

function MyComponent() {
  return (
    <div id="fbjs">
      <Button variant="default" size="default">
        Submit
      </Button>
    </div>
  );
}
```

### Form Elements

```tsx
import { OpenText, SingleSelect, Rating } from "@formbricks/survey-ui";
import "@formbricks/survey-ui/styles";

function SurveyForm() {
  return (
    <div id="fbjs">
      <OpenText
        label="What's your name?"
        placeholder="Enter your name"
        onChange={(value) => console.log(value)}
      />
      
      <SingleSelect
        label="Choose an option"
        options={[
          { value: "1", label: "Option 1" },
          { value: "2", label: "Option 2" },
        ]}
        onChange={(value) => console.log(value)}
      />
      
      <Rating
        label="Rate your experience"
        max={5}
        onChange={(value) => console.log(value)}
      />
    </div>
  );
}
```

## Theming

This package uses CSS variables for theming. You can customize the appearance by overriding CSS variables in your application:

```css
:root {
  /* Brand color */
  --fb-survey-brand-color: #64748b;
  
  /* Input styling */
  --fb-input-bg-color: #f8fafc;
  --fb-input-border-color: var(--fb-survey-brand-color);
  --fb-input-border-radius: 0.625rem;
  
  /* Button styling */
  --fb-button-bg-color: hsl(222.2 47.4% 11.2%);
  --fb-button-text-color: hsl(210 40% 98%);
  
  /* And many more... */
}
```

See `dist/survey-ui.css` for the complete list of available CSS variables.

## CSS Scoping

This package uses CSS scoped to `#fbjs` to ensure proper specificity and prevent conflicts with other stylesheets. This is why you must wrap components in `<div id="fbjs">`.

## TypeScript Support

This package is written in TypeScript and includes type definitions. All components export their prop types:

```tsx
import { Button, type ButtonProps } from "@formbricks/survey-ui";
import { OpenText, type OpenTextProps } from "@formbricks/survey-ui";
```

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint
```

## License

MIT

## Repository

[https://github.com/formbricks/formbricks](https://github.com/formbricks/formbricks)
