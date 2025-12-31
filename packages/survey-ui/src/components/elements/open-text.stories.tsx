import type { Meta, StoryObj } from "@storybook/react";
import {
  type BaseStylingOptions,
  type InputLayoutStylingOptions,
  commonArgTypes,
  createCSSVariablesDecorator,
  createStatefulRender,
  elementStylingArgTypes,
  inputStylingArgTypes,
  pickArgTypes,
  surveyStylingArgTypes,
} from "../../lib/story-helpers";
import { OpenText, type OpenTextProps } from "./open-text";

type StoryProps = OpenTextProps &
  Partial<BaseStylingOptions & InputLayoutStylingOptions> &
  Record<string, unknown>;

const meta: Meta<StoryProps> = {
  title: "UI-package/Elements/OpenText",
  component: OpenText,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A complete open text element that combines headline, description, and input/textarea components. Supports short and long answers, validation, character limits, and RTL text direction.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    ...commonArgTypes,
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
    rows: {
      control: { type: "number", min: 1, max: 20 },
      description: "Number of rows for textarea (only when longAnswer is true)",
      table: { category: "Layout" },
    },
  },
  render: createStatefulRender(OpenText),
};

export default meta;
type Story = StoryObj<StoryProps>;

export const StylingPlayground: Story = {
  args: {
    headline: "What's your feedback?",
    description: "Please share your thoughts with us",
    placeholder: "Type your answer here...",
  },
  argTypes: {
    ...elementStylingArgTypes,
    ...pickArgTypes(inputStylingArgTypes, [
      "inputBgColor",
      "inputBorderColor",
      "inputColor",
      "inputFontSize",
      "inputFontWeight",
      "inputWidth",
      "inputHeight",
      "inputBorderRadius",
      "inputPlaceholderColor",
      "inputPaddingX",
      "inputPaddingY",
    ]),
    ...surveyStylingArgTypes,
  },
  decorators: [createCSSVariablesDecorator<StoryProps>()],
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
    dir: "rtl",
  },
};

export const RTLLongAnswer: Story = {
  args: {
    headline: "أخبرنا عن تجربتك",
    description: "يرجى تقديم أكبر قدر ممكن من التفاصيل",
    placeholder: "اكتب ردك التفصيلي هنا...",
    longAnswer: true,
    rows: 5,
    dir: "rtl",
  },
};

export const WithErrorAndRTL: Story = {
  args: {
    headline: "ما هو بريدك الإلكتروني؟",
    inputType: "email",
    placeholder: "email@example.com",
    errorMessage: "يرجى إدخال عنوان بريد إلكتروني صالح",
    required: true,
    dir: "rtl",
  },
};

export const MultipleElements: Story = {
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
