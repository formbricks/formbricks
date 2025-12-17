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

This package uses CSS variables for theming. You can customize the appearance by overriding CSS variables in your application. All CSS variables are prefixed with `--fb-` for Formbricks-specific tokens, or use standard design tokens.

### Base Design Tokens

These are the foundation tokens used throughout the design system:

```css
:root {
  /* Border radius */
  --radius: 0.625rem;
  
  /* Colors */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-muted: oklch(0.97 0.02 27.325);
  --border: oklch(0.922 0 0);
  --input: black;
  
  /* Slate colors */
  --slate-50: rgb(248, 250, 252);
  --slate-100: rgb(241 245 249);
  --slate-200: rgb(226 232 240);
}
```

### Survey Brand Colors

```css
:root {
  /* Primary brand color used throughout surveys */
  --fb-survey-brand-color: #64748b;
  
  /* Accent background colors */
  --fb-accent-background-color: var(--slate-200);
  --fb-accent-background-color-selected: var(--slate-100);
}
```

### Element Headline Tokens

Used for question headlines and main element titles:

```css
:root {
  --fb-element-headline-font-family: inherit;
  --fb-element-headline-font-weight: 400;
  --fb-element-headline-font-size: 1rem;
  --fb-element-headline-color: var(--input);
  --fb-element-headline-opacity: 1;
}
```

### Element Description Tokens

Used for descriptive text below headlines:

```css
:root {
  --fb-element-description-font-family: inherit;
  --fb-element-description-font-weight: 400;
  --fb-element-description-font-size: 0.875rem;
  --fb-element-description-color: var(--input);
  --fb-element-description-opacity: 1;
}
```

### Label Tokens

Used for form labels and secondary text:

```css
:root {
  --fb-label-font-family: inherit;
  --fb-label-font-weight: 400;
  --fb-label-font-size: 0.875rem;
  --fb-label-color: var(--foreground);
  --fb-label-opacity: 1;
}
```

### Button Tokens

Used for the custom button variant. Standard variants use Tailwind defaults:

```css
:root {
  --fb-button-height: 2.25rem;
  --fb-button-width: auto;
  --fb-button-font-size: 0.875rem;
  --fb-button-font-family: inherit;
  --fb-button-font-weight: 500;
  --fb-button-border-radius: var(--radius);
  --fb-button-bg-color: hsl(222.2 47.4% 11.2%);
  --fb-button-text-color: hsl(210 40% 98%);
  --fb-button-padding-x: 1rem;
  --fb-button-padding-y: 0.5rem;
}
```

### Input Tokens

Used for text inputs, textareas, and other form controls:

```css
:root {
  --fb-input-bg-color: var(--slate-50);
  --fb-input-border-color: var(--fb-survey-brand-color);
  --fb-input-border-radius: var(--radius);
  --fb-input-font-family: inherit;
  --fb-input-font-size: 0.875rem;
  --fb-input-font-weight: 400;
  --fb-input-color: var(--foreground);
  --fb-input-placeholder-color: var(--fb-input-color);
  --fb-input-placeholder-opacity: 0.5;
  --fb-input-width: 100%;
  --fb-input-height: 40px;
  --fb-input-padding-x: 16px;
  --fb-input-padding-y: 16px;
  --fb-input-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
```

### Option Tokens

Used for selectable options (radio, checkbox, multi-select). These inherit from input tokens by default:

```css
:root {
  --fb-option-bg-color: var(--fb-input-bg-color);
  --fb-option-label-color: var(--fb-input-color);
  --fb-option-border-radius: var(--fb-input-border-radius);
  --fb-option-padding-x: var(--fb-input-padding-x);
  --fb-option-padding-y: var(--fb-input-padding-y);
  --fb-option-font-family: var(--fb-input-font-family);
  --fb-option-font-size: var(--fb-input-font-size);
  --fb-option-font-weight: var(--fb-input-font-weight);
}
```

### Progress Tokens

Used for the Progress component track and indicator:

```css
:root {
  --fb-progress-track-height: 0.5rem;
  --fb-progress-track-bg-color: hsl(222.2 47.4% 11.2% / 0.2);
  --fb-progress-track-border-radius: var(--radius);
  --fb-progress-indicator-bg-color: hsl(222.2 47.4% 11.2%);
  --fb-progress-indicator-border-radius: var(--radius);
}
```

### Example: Custom Theme

```css
:root {
  /* Customize brand color */
  --fb-survey-brand-color: #3b82f6;
  
  /* Customize input styling */
  --fb-input-bg-color: #ffffff;
  --fb-input-border-color: #e5e7eb;
  --fb-input-border-radius: 0.5rem;
  
  /* Customize button styling */
  --fb-button-bg-color: #3b82f6;
  --fb-button-text-color: #ffffff;
  --fb-button-border-radius: 0.5rem;
  
  /* Customize typography */
  --fb-element-headline-font-size: 1.125rem;
  --fb-element-headline-font-weight: 600;
}
```

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
