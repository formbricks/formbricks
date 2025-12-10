# Storybook Stories Guide

This guide explains how to create and maintain Storybook stories for survey UI elements using the shared utilities in `story-helpers.ts`.

## Overview

To reduce code duplication, we've created shared utilities for common patterns in story files:

- **Styling options interfaces** for consistent prop types
- **Common argTypes** for props that appear across all elements
- **CSS variable decorators** for styling playground stories
- **Stateful render functions** for elements with controlled values

## Quick Start

### Basic Story Structure

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { MyElement, type MyElementProps } from "./my-element";
import {
  type BaseStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  inputStylingArgTypes,
  surveyStylingArgTypes,
} from "./story-helpers";

type StoryProps = MyElementProps & Partial<BaseStylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/MyElement",
  component: MyElement,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "Description of your element",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
    // Add any element-specific argTypes here
  },
  render: createStatefulRender(MyElement),
};

export default meta;
type Story = StoryObj<StoryProps>;

export const StylingPlayground: Story = {
  args: {
    // Your default args
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...inputStylingArgTypes,
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};

// Individual story variants...
export const Default: Story = {
  /* ... */
};
```

## Available Utilities

### Styling Option Interfaces

Import these to define your `StoryProps` type:

- **`BaseStylingOptions`** - Element headline, description, input colors, brand color
- **`LabelStylingOptions`** - Label font family, size, weight, color, opacity
- **`ExtendedInputStylingOptions`** - Additional input styling (width, height, border radius, padding, placeholder)
- **`OptionStylingOptions`** - Option styling for select elements
- **`ButtonStylingOptions`** - Button styling for CTA elements
- **`CheckboxInputStylingOptions`** - Checkbox-specific styling

### Common argTypes

**`commonArgTypes`** - Includes:

- `headline`
- `description`
- `required`
- `errorMessage`
- `dir` (RTL support)
- `disabled`
- `onChange`

### Styling argTypes

Pre-configured argTypes for styling properties:

- **`elementStylingArgTypes`** - Element headline and description styling
- **`inputStylingArgTypes`** - Basic input styling (bg, border, color, font)
- **`extendedInputStylingArgTypes`** - Extended input styling (includes all input + dimensions, padding, placeholder)
- **`labelStylingArgTypes`** - Label styling
- **`optionStylingArgTypes`** - Option styling for select components
- **`buttonStylingArgTypes`** - Button styling
- **`checkboxInputStylingArgTypes`** - Checkbox input styling
- **`surveyStylingArgTypes`** - Brand color

### CSS Variables Decorator

**`createCSSVariablesDecorator<T>(width?: string, additionalMappings?: Record<string, string>)`**

Creates a decorator that automatically maps story args to CSS variables.

```typescript
decorators: [createCSSVariablesDecorator<StoryProps>()],
// Or with custom width:
decorators: [createCSSVariablesDecorator<StoryProps>("800px")],
```

### Stateful Render Function

**`createStatefulRender<TProps>(Component: React.ComponentType<TProps>)`**

Creates a render function that manages controlled component state (value/onChange).

```typescript
render: createStatefulRender(MyElement),
```

**Note:** For components with custom state logic (e.g., `otherValue` in multi-select), you'll need to write a custom render function.

## Common Patterns

### Element with Basic Styling

```typescript
import {
  type BaseStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  inputStylingArgTypes,
  surveyStylingArgTypes,
} from "./story-helpers";

type StoryProps = MyElementProps & Partial<BaseStylingOptions>;
```

### Element with Labels (Rating, NPS)

```typescript
import {
  type BaseStylingOptions,
  type LabelStylingOptions,
  elementStylingArgTypes,
  inputStylingArgTypes,
  labelStylingArgTypes,
  surveyStylingArgTypes,
} from "./story-helpers";

type StoryProps = MyElementProps & Partial<BaseStylingOptions & LabelStylingOptions>;
```

### Element with Extended Input Styling (Open Text, File Upload)

```typescript
import {
  type BaseStylingOptions,
  type ExtendedInputStylingOptions,
  elementStylingArgTypes,
  extendedInputStylingArgTypes,
  surveyStylingArgTypes,
} from "./story-helpers";

type StoryProps = MyElementProps & Partial<BaseStylingOptions & ExtendedInputStylingOptions>;
```

### Select Elements with Options (Multi-Select, Single-Select)

```typescript
import {
  type BaseStylingOptions,
  type CheckboxInputStylingOptions,
  type LabelStylingOptions,
  type OptionStylingOptions,
  checkboxInputStylingArgTypes,
  elementStylingArgTypes,
  labelStylingArgTypes,
  optionStylingArgTypes,
  surveyStylingArgTypes,
} from "./story-helpers";

type StoryProps = MyElementProps &
  Partial<BaseStylingOptions & LabelStylingOptions & OptionStylingOptions & CheckboxInputStylingOptions>;
```

### CTA with Button Styling

```typescript
import {
  type BaseStylingOptions,
  type ButtonStylingOptions,
  buttonStylingArgTypes,
  elementStylingArgTypes,
} from "./story-helpers";

type StoryProps = MyElementProps & Partial<BaseStylingOptions & ButtonStylingOptions>;
```

### Element Without Controlled State (CTA)

```typescript
// Don't use createStatefulRender for elements without controlled values
const meta: Meta<StoryProps> = {
  // ... other config
  // No render function needed - Storybook will use the default
};
```

### Custom Render Function (Multi-Select with otherValue)

```typescript
render: function Render(args: StoryProps) {
  const [value, setValue] = useState(args.value);
  const [otherValue, setOtherValue] = useState(args.otherValue);

  const handleOtherValueChange = (v: string) => {
    setOtherValue(v);
    args.onOtherValueChange?.(v);
  };

  useEffect(() => {
    setValue(args.value);
  }, [args.value]);

  return (
    <MyElement
      {...args}
      value={value}
      onChange={(v) => {
        setValue(v);
        args.onChange?.(v);
      }}
      otherValue={otherValue}
      onOtherValueChange={handleOtherValueChange}
    />
  );
},
```

## StylingPlayground Story

Every element should have a `StylingPlayground` story that allows designers to experiment with styling:

```typescript
export const StylingPlayground: Story = {
  args: {
    // Provide realistic default content
    headline: "Your Element Headline",
    description: "A description of what this element does",
    // ... other content args
  },
  argTypes: {
    // Include all relevant styling argTypes
    ...elementStylingArgTypes,
    ...inputStylingArgTypes,
    ...surveyStylingArgTypes,
    // Add any custom styling argTypes if needed
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
};
```

## Adding New Styling Options

If you need new styling options not covered by the existing interfaces:

1. **For shared options** - Add to `story-helpers.ts`:

```typescript
// Add to interfaces
export interface MyNewStylingOptions {
  myNewProperty: string;
}

// Add to argTypes
export const myNewStylingArgTypes = {
  myNewProperty: {
    control: "text",
    table: { category: "My New Styling" },
  },
};

// Add to CSS_VAR_MAP
const CSS_VAR_MAP: CSSVarMapping = {
  // ... existing mappings
  myNewProperty: "--fb-my-new-property",
};
```

2. **For element-specific options** - Add inline in your story file:

```typescript
argTypes: {
  ...elementStylingArgTypes,
  mySpecificOption: {
    control: "text",
    description: "Special option for this element only",
    table: { category: "Custom Styling" },
  },
},
```

## Best Practices

1. **Always use shared utilities** when possible to maintain consistency
2. **Don't duplicate argTypes** - use the spreads (`...commonArgTypes`)
3. **Keep story files focused** - individual stories should be concise
4. **Add meaningful descriptions** to any custom argTypes
5. **Test the StylingPlayground** to ensure CSS variables are working
6. **Follow naming conventions** from existing stories
7. **Keep imports organized** - group by category (types, utilities, styling)

## Migration Checklist

When converting an existing story file:

- [ ] Replace local `StylingOptions` interface with imports from `story-helpers`
- [ ] Replace `argTypes` with `commonArgTypes` spread
- [ ] Replace `render` function with `createStatefulRender()` (if applicable)
- [ ] Replace custom CSS variable decorator with `createCSSVariablesDecorator()`
- [ ] Replace styling argTypes in `StylingPlayground` with spreads
- [ ] Test that all existing stories still work
- [ ] Verify StylingPlayground controls are functioning

## Examples

See these files for reference implementations:

- **Basic element**: `consent.stories.tsx`
- **With extended input**: `open-text.stories.tsx`
- **With labels**: `rating.stories.tsx`, `nps.stories.tsx`
- **With options**: `multi-select.stories.tsx`, `single-select.stories.tsx`
- **Without controlled state**: `cta.stories.tsx`
- **Custom render**: `multi-select.stories.tsx`

## Questions?

If you're unsure about how to implement a story, check the existing stories for similar patterns or consult this guide.

