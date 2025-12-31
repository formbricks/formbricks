# Create New Question Element

Use this command to scaffold a new question element component in `packages/survey-ui/src/elements/`.

## Usage

When creating a new question type (e.g., `single-select`, `rating`, `nps`), follow these steps:

1. **Create the component file** `{question-type}.tsx` with this structure:

```typescript
import * as React from "react";
import { ElementHeader } from "../components/element-header";
import { useTextDirection } from "../hooks/use-text-direction";
import { cn } from "../lib/utils";

interface {QuestionType}Props {
    /** Unique identifier for the element container */
    elementId: string;
    /** The main question or prompt text displayed as the headline */
    headline: string;
    /** Optional descriptive text displayed below the headline */
    description?: string;
    /** Unique identifier for the input/control group */
    inputId: string;
    /** Current value */
    value?: {ValueType};
    /** Callback function called when the value changes */
    onChange: (value: {ValueType}) => void;
    /** Whether the field is required (shows asterisk indicator) */
    required?: boolean;
    /** Error message to display */
    errorMessage?: string;
    /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
    dir?: "ltr" | "rtl" | "auto";
    /** Whether the controls are disabled */
    disabled?: boolean;
    // Add question-specific props here
}

function {QuestionType}({
    elementId,
    headline,
    description,
    inputId,
    value,
    onChange,
    required = false,
    errorMessage,
    dir = "auto",
    disabled = false,
    // ... question-specific props
}: {QuestionType}Props): React.JSX.Element {
    // Ensure value is always the correct type (handle undefined/null)
    const currentValue = value ?? {defaultValue};
    
    // Detect text direction from content
    const detectedDir = useTextDirection({
        dir,
        textContent: [headline, description ?? "", /* add other text content from question */],
    });

    return (
        <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
            {/* Headline */}
            <ElementHeader 
                headline={headline} 
                description={description} 
                required={required} 
                htmlFor={inputId} 
            />

            {/* Question-specific controls */}
            {/* TODO: Add your question-specific UI here */}

            {/* Error message */}
            {errorMessage && (
                <div className="text-destructive flex items-center gap-1 text-sm" dir={detectedDir}>
                    <span>{errorMessage}</span>
                </div>
            )}
        </div>
    );
}

export { {QuestionType} };
export type { {QuestionType}Props };
```

2. **Create the Storybook file** `{question-type}.stories.tsx`:

```typescript
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React from "react";
import { {QuestionType}, type {QuestionType}Props } from "./{question-type}";

// Styling options for the StylingPlayground story
interface StylingOptions {
    // Question styling
    questionHeadlineFontFamily: string;
    questionHeadlineFontSize: string;
    questionHeadlineFontWeight: string;
    questionHeadlineColor: string;
    questionDescriptionFontFamily: string;
    questionDescriptionFontWeight: string;
    questionDescriptionFontSize: string;
    questionDescriptionColor: string;
    // Add component-specific styling options here
}

type StoryProps = {QuestionType}Props & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
    title: "UI-package/Elements/{QuestionType}",
    component: {QuestionType},
    parameters: {
        layout: "centered",
        docs: {
            description: {
                component: "A complete {question type} question element...",
            },
        },
    },
    tags: ["autodocs"],
    argTypes: {
        headline: {
            control: "text",
            description: "The main question text",
            table: { category: "Content" },
        },
        description: {
            control: "text",
            description: "Optional description or subheader text",
            table: { category: "Content" },
        },
        value: {
            control: "object",
            description: "Current value",
            table: { category: "State" },
        },
        required: {
            control: "boolean",
            description: "Whether the field is required",
            table: { category: "Validation" },
        },
        errorMessage: {
            control: "text",
            description: "Error message to display",
            table: { category: "Validation" },
        },
        dir: {
            control: { type: "select" },
            options: ["ltr", "rtl", "auto"],
            description: "Text direction for RTL support",
            table: { category: "Layout" },
        },
        disabled: {
            control: "boolean",
            description: "Whether the controls are disabled",
            table: { category: "State" },
        },
        onChange: {
            action: "changed",
            table: { category: "Events" },
        },
        // Add question-specific argTypes here
    },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
    const args = context.args as StoryProps;
    const {
        questionHeadlineFontFamily,
        questionHeadlineFontSize,
        questionHeadlineFontWeight,
        questionHeadlineColor,
        questionDescriptionFontFamily,
        questionDescriptionFontSize,
        questionDescriptionFontWeight,
        questionDescriptionColor,
        // Extract component-specific styling options
    } = args;

    const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {
        "--fb-question-headline-font-family": questionHeadlineFontFamily,
        "--fb-question-headline-font-size": questionHeadlineFontSize,
        "--fb-question-headline-font-weight": questionHeadlineFontWeight,
        "--fb-question-headline-color": questionHeadlineColor,
        "--fb-question-description-font-family": questionDescriptionFontFamily,
        "--fb-question-description-font-size": questionDescriptionFontSize,
        "--fb-question-description-font-weight": questionDescriptionFontWeight,
        "--fb-question-description-color": questionDescriptionColor,
        // Add component-specific CSS variables
    };

    return (
        <div style={cssVarStyle} className="w-[600px]">
            <Story />
        </div>
    );
};

export const StylingPlayground: Story = {
    args: {
        headline: "Example question?",
        description: "Example description",
        // Default styling values
        questionHeadlineFontFamily: "system-ui, sans-serif",
        questionHeadlineFontSize: "1.125rem",
        questionHeadlineFontWeight: "600",
        questionHeadlineColor: "#1e293b",
        questionDescriptionFontFamily: "system-ui, sans-serif",
        questionDescriptionFontSize: "0.875rem",
        questionDescriptionFontWeight: "400",
        questionDescriptionColor: "#64748b",
        // Add component-specific default values
    },
    argTypes: {
        // Question styling argTypes
        questionHeadlineFontFamily: {
            control: "text",
            table: { category: "Question Styling" },
        },
        questionHeadlineFontSize: {
            control: "text",
            table: { category: "Question Styling" },
        },
        questionHeadlineFontWeight: {
            control: "text",
            table: { category: "Question Styling" },
        },
        questionHeadlineColor: {
            control: "color",
            table: { category: "Question Styling" },
        },
        questionDescriptionFontFamily: {
            control: "text",
            table: { category: "Question Styling" },
        },
        questionDescriptionFontSize: {
            control: "text",
            table: { category: "Question Styling" },
        },
        questionDescriptionFontWeight: {
            control: "text",
            table: { category: "Question Styling" },
        },
        questionDescriptionColor: {
            control: "color",
            table: { category: "Question Styling" },
        },
        // Add component-specific argTypes
    },
    decorators: [withCSSVariables],
};

export const Default: Story = {
    args: {
        headline: "Example question?",
        // Add default props
    },
};

export const WithDescription: Story = {
    args: {
        headline: "Example question?",
        description: "Example description text",
    },
};

export const Required: Story = {
    args: {
        headline: "Example question?",
        required: true,
    },
};

export const WithError: Story = {
    args: {
        headline: "Example question?",
        errorMessage: "This field is required",
        required: true,
    },
};

export const Disabled: Story = {
    args: {
        headline: "Example question?",
        disabled: true,
    },
};

export const RTL: Story = {
    args: {
        headline: "مثال على السؤال؟",
        description: "مثال على الوصف",
        // Add RTL-specific props
    },
};
```

3. **Add CSS variables** to `packages/survey-ui/src/styles/globals.css` if needed:

```css
/* Component-specific CSS variables */
--fb-{component}-{property}: {default-value};
```

4. **Export from** `packages/survey-ui/src/index.ts`:

```typescript
export { {QuestionType}, type {QuestionType}Props } from "./elements/{question-type}";
```

## Key Requirements

- ✅ Always use `ElementHeader` component for headline/description
- ✅ Always use `useTextDirection` hook for RTL support
- ✅ Always handle undefined/null values safely (e.g., `Array.isArray(value) ? value : []`)
- ✅ Always include error message display if applicable
- ✅ Always support disabled state if applicable
- ✅ Always add JSDoc comments to props interface
- ✅ Always create Storybook stories with styling playground
- ✅ Always export types from component file
- ✅ Always add to index.ts exports

## Examples

- `open-text.tsx` - Text input/textarea question (string value)
- `multi-select.tsx` - Multiple checkbox selection (string[] value)

## Checklist

When creating a new question element, verify:

- [ ] Component file created with proper structure
- [ ] Props interface with JSDoc comments for all props
- [ ] Uses `ElementHeader` component (don't duplicate header logic)
- [ ] Uses `useTextDirection` hook for RTL support
- [ ] Handles undefined/null values safely
- [ ] Storybook file created with styling playground
- [ ] Includes common stories: Default, WithDescription, Required, WithError, Disabled, RTL
- [ ] CSS variables added to `globals.css` if component needs custom styling
- [ ] Exported from `index.ts` with types
- [ ] TypeScript types properly exported
- [ ] Error message display included if applicable
- [ ] Disabled state supported if applicable

