import type { Decorator, Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { OpenText, type OpenTextProps } from "./open-text";

// Styling options for the StylingPlayground story
interface StylingOptions {
  // Label styling
  questionHeadlineFontFamily: string;
  questionHeadlineFontSize: string;
  questionHeadlineFontWeight: string;
  questionHeadlineColor: string;
  questionDescriptionFontFamily: string;
  questionDescriptionFontWeight: string;
  questionDescriptionFontSize: string;
  questionDescriptionColor: string;
  // Input styling
  inputWidth: string;
  inputHeight: string;
  inputBgColor: string;
  inputBorderColor: string;
  inputBorderRadius: string;
  inputFontSize: string;
  inputColor: string;
  inputPlaceholderColor: string;
  inputPaddingX: string;
  inputPaddingY: string;
}

type StoryProps = OpenTextProps & Partial<StylingOptions>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/OpenText",
  component: OpenText,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete open text question element that combines headline, description, and input/textarea components. Supports short and long answers, validation, character limits, and RTL text direction.",
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
    placeholder: {
      control: "text",
      description: "Placeholder text for the input field",
      table: { category: "Content" },
    },
    value: {
      control: "text",
      description: "Current input value",
      table: { category: "State" },
    },
    required: {
      control: "boolean",
      description: "Whether the field is required",
      table: { category: "Validation" },
    },
    longAnswer: {
      control: "boolean",
      description: "Use textarea for long-form answers instead of input",
      table: { category: "Layout" },
    },
    inputType: {
      control: { type: "select" },
      options: ["text", "email", "url", "phone", "number"],
      description: "Type of input field (only used when longAnswer is false)",
      table: { category: "Validation" },
    },
    charLimit: {
      control: "object",
      description: "Character limit configuration {min?, max?}",
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
    rows: {
      control: { type: "number", min: 1, max: 20 },
      description: "Number of rows for textarea (only when longAnswer is true)",
      table: { category: "Layout" },
    },
    disabled: {
      control: "boolean",
      description: "Whether the input is disabled",
      table: { category: "State" },
    },
    onChange: {
      action: "changed",
      table: { category: "Events" },
    },
  },
  render: function Render(args: StoryProps) {
    const [value, setValue] = useState(args.value);

    useEffect(() => {
      setValue(args.value);
    }, [args.value]);

    return (
      <OpenText
        {...args}
        value={value}
        onChange={(v) => {
          setValue(v);
          args.onChange?.(v);
        }}
      />
    );
  },
};

export default meta;
type Story = StoryObj<StoryProps>;

// Decorator to apply CSS variables from story args
const withCSSVariables: Decorator<StoryProps> = (Story, context) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Storybook's Decorator type doesn't properly infer args type
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
    inputWidth,
    inputHeight,
    inputBgColor,
    inputBorderColor,
    inputBorderRadius,
    inputFontSize,
    inputColor,
    inputPlaceholderColor,
    inputPaddingX,
    inputPaddingY,
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
    "--fb-input-width": inputWidth,
    "--fb-input-height": inputHeight,
    "--fb-input-bg-color": inputBgColor,
    "--fb-input-border-color": inputBorderColor,
    "--fb-input-border-radius": inputBorderRadius,
    "--fb-input-font-size": inputFontSize,
    "--fb-input-color": inputColor,
    "--fb-input-placeholder-color": inputPlaceholderColor,
    "--fb-input-padding-x": inputPaddingX,
    "--fb-input-padding-y": inputPaddingY,
  };

  return (
    <div style={cssVarStyle} className="w-[600px]">
      <Story />
    </div>
  );
};

export const StylingPlayground: Story = {
  args: {
    headline: "What's your feedback?",
    description: "Please share your thoughts with us",
    placeholder: "Type your answer here...",
    // Default styling values
    questionHeadlineFontFamily: "system-ui, sans-serif",
    questionHeadlineFontSize: "1.125rem",
    questionHeadlineFontWeight: "600",
    questionHeadlineColor: "#1e293b",
    questionDescriptionFontFamily: "system-ui, sans-serif",
    questionDescriptionFontSize: "0.875rem",
    questionDescriptionFontWeight: "400",
    questionDescriptionColor: "#64748b",
    inputWidth: "100%",
    inputHeight: "2.5rem",
    inputBgColor: "#ffffff",
    inputBorderColor: "#e2e8f0",
    inputBorderRadius: "0.5rem",
    inputFontSize: "0.875rem",
    inputColor: "#1e293b",
    inputPlaceholderColor: "#94a3b8",
    inputPaddingX: "0.75rem",
    inputPaddingY: "0.5rem",
  },
  argTypes: {
    // Question styling
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
    // Input styling
    inputWidth: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputHeight: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputBgColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputBorderColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputBorderRadius: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputFontSize: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputPlaceholderColor: {
      control: "color",
      table: { category: "Input Styling" },
    },
    inputPaddingX: {
      control: "text",
      table: { category: "Input Styling" },
    },
    inputPaddingY: {
      control: "text",
      table: { category: "Input Styling" },
    },
  },
  decorators: [withCSSVariables],
};

export const Default: Story = {
  args: {
    headline: "What's your feedback?",
    placeholder: "Type your answer here...",
  },
};

export const WithDescription: Story = {
  args: {
    headline: "What did you think of our service?",
    description: "We'd love to hear your honest feedback to help us improve",
    placeholder: "Share your thoughts...",
  },
};

export const Required: Story = {
  args: {
    headline: "What's your email address?",
    description: "We'll use this to contact you",
    placeholder: "email@example.com",
    required: true,
    inputType: "email",
  },
};

export const LongAnswer: Story = {
  args: {
    headline: "Tell us about your experience",
    description: "Please provide as much detail as possible",
    placeholder: "Write your detailed response here...",
    longAnswer: true,
    rows: 5,
  },
};

export const LongAnswerWithCharLimit: Story = {
  args: {
    headline: "Share your story",
    description: "Maximum 500 characters",
    placeholder: "Tell us your story...",
    longAnswer: true,
    rows: 6,
    charLimit: {
      max: 500,
    },
  },
};

export const EmailInput: Story = {
  args: {
    headline: "What's your email?",
    inputType: "email",
    placeholder: "email@example.com",
    required: true,
  },
};

export const PhoneInput: Story = {
  args: {
    headline: "What's your phone number?",
    description: "Include country code",
    inputType: "phone",
    placeholder: "+1 (555) 123-4567",
  },
};

export const URLInput: Story = {
  args: {
    headline: "What's your website?",
    inputType: "url",
    placeholder: "https://example.com",
  },
};

export const NumberInput: Story = {
  args: {
    headline: "How many employees does your company have?",
    inputType: "number",
    placeholder: "0",
  },
};

export const WithError: Story = {
  args: {
    headline: "What's your email address?",
    inputType: "email",
    placeholder: "email@example.com",
    value: "invalid-email",
    errorMessage: "Please enter a valid email address",
    required: true,
  },
};

export const WithValue: Story = {
  args: {
    headline: "What's your name?",
    placeholder: "Enter your name",
    value: "John Doe",
  },
};

export const Disabled: Story = {
  args: {
    headline: "This field is disabled",
    description: "You cannot edit this field",
    placeholder: "Disabled input",
    disabled: true,
  },
};

export const DisabledWithValue: Story = {
  args: {
    headline: "Submission ID",
    value: "SUB-2024-001",
    disabled: true,
  },
};

export const RTL: Story = {
  args: {
    headline: "ما هو تقييمك؟",
    description: "يرجى مشاركة أفكارك معنا",
    placeholder: "اكتب إجابتك هنا...",
  },
};

export const RTLLongAnswer: Story = {
  args: {
    headline: "أخبرنا عن تجربتك",
    description: "يرجى تقديم أكبر قدر ممكن من التفاصيل",
    placeholder: "اكتب ردك التفصيلي هنا...",
    longAnswer: true,
    rows: 5,
  },
};

export const WithErrorAndRTL: Story = {
  args: {
    headline: "ما هو بريدك الإلكتروني؟",
    inputType: "email",
    placeholder: "email@example.com",
    errorMessage: "يرجى إدخال عنوان بريد إلكتروني صالح",
    required: true,
  },
};

export const MultipleQuestions: Story = {
  render: () => (
    <div className="w-[600px] space-y-8">
      <OpenText
        elementId="name"
        inputId="name"
        headline="What's your name?"
        placeholder="Enter your name"
        required
        onChange={() => {}}
      />
      <OpenText
        elementId="email"
        inputId="email"
        headline="What's your email?"
        inputType="email"
        placeholder="email@example.com"
        required
        onChange={() => {}}
      />
      <OpenText
        elementId="bio"
        inputId="bio"
        headline="Tell us about yourself"
        description="Optional: Share a bit about your background"
        placeholder="Your bio..."
        longAnswer
        rows={4}
        onChange={() => {}}
      />
    </div>
  ),
};
